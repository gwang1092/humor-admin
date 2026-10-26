import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_MODEL = 'gemini-3.8-flash'

// Only used if the database has no active prompt chain
const FALLBACK_INSTRUCTION = `You write captions for a meme site run by Columbia University students.
Write ONE funny caption for the photo that is specific to life at Columbia. Pick the single reference below that best fits what is actually in the photo. If nothing fits, tie it to a general Columbia experience.

Places and food: Butler Library (all-nighters, treated like a social club, smokers out front), Avery Library (sweats who shush you), NoCo, the Northwest Corner library that closes absurdly early, the Music and Arts Library that nobody knows exists, the Low Steps and the Alma Mater statue with its hidden owl, the Sundial, College Walk, Lerner, Koronet pizza slices, Cafe East.
Housing: Carman is the party dorm. Furnald is quiet and antisocial. John Jay has the slowest elevators in the world, the worst bathrooms, and cockroaches. Wallach has rats. Wien residents are Wieners.
Academics: the Core Curriculum, Sparknotes, office hours. SEAS students do not have to know how to swim and build cardboard rafts instead.
Campus life: nobody at Columbia can use an umbrella properly, Roar Lion Roar, Bwog, the 1 train.

Rules:
- Exactly one sentence, under 20 words. Output ONLY the caption: no options, no quotation marks, no markdown, no explanation.
- Name real campus places and institutions, never real people.
- Make fun of buildings, food, systems and situations. Never make fun of any group of people for their race, religion, nationality, gender, sexuality or politics.

Optional hint from the poster (follow it if given): {{hint}}`

type Step = {
    step_order: number
    name: string
    instruction: string
    model_key: string | null
}

type Config = {
    chain_id: string | null
    chain_name: string
    steps: Step[]
    terms: { term: string; definition: string }[]
    examples: { caption: string }[]
}

type StepLog = {
    model_key: string
    prompt_text: string
    response_text: string | null
    error_message: string | null
    latency_ms: number
    input_tokens: number | null
    output_tokens: number | null
}

function render(template: string, vars: Record<string, string>) {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? '')
}

async function callGemini(modelKey: string, parts: Record<string, unknown>[]) {
    const started = Date.now()

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelKey}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts }] }),
        }
    )

    const data = await response.json().catch(() => ({}))

    const text = ((data?.candidates?.[0]?.content?.parts ?? []) as { text?: string; thought?: boolean }[])
        .filter(p => typeof p.text === 'string' && !p.thought)
        .map(p => p.text as string)
        .join('')
        .trim()

    return {
        ok: response.ok && text.length > 0,
        text,
        error:
            (data?.error?.message as string | undefined) ??
            (response.ok ? 'The model returned no text' : `Request failed (${response.status})`),
        latency: Date.now() - started,
        inputTokens: (data?.usageMetadata?.promptTokenCount as number | undefined) ?? null,
        outputTokens: (data?.usageMetadata?.candidatesTokenCount as number | undefined) ?? null,
    }
}

export async function POST(request: Request) {
    const supabase = await createClient()

    // Only signed-in users may spend the Gemini quota
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
    }

    const { imageBase64, prompt } = await request.json()
    const hint = typeof prompt === 'string' ? prompt.trim() : ''

    // Ask the database which chain to run (picked by the mix weights)
    const { data: rpcData } = await supabase.rpc('get_caption_config')

    const config: Config =
        rpcData && rpcData.steps?.length
            ? (rpcData as Config)
            : {
                chain_id: null,
                chain_name: 'Built-in fallback',
                steps: [
                    { step_order: 1, name: 'Write caption', instruction: FALLBACK_INSTRUCTION, model_key: null },
                ],
                terms: [],
                examples: [],
            }

    const termsText = config.terms.map(t => `- ${t.term}: ${t.definition}`).join('\n') || '(none)'
    const examplesText = config.examples.map(e => `- ${e.caption}`).join('\n') || '(none yet)'

    const logs: StepLog[] = []
    let previous = ''
    let caption = ''
    let failure = ''

    for (const [index, step] of config.steps.entries()) {
        const modelKey =
            step.model_key && step.model_key.startsWith('gemini') ? step.model_key : DEFAULT_MODEL

        const text = render(step.instruction, {
            terms: termsText,
            examples: examplesText,
            hint: hint || 'none',
            previous,
        })

        // Only the first step sees the photo
        const parts: Record<string, unknown>[] = [{ text }]
        if (index === 0) {
            parts.push({ inline_data: { mime_type: 'image/jpeg', data: imageBase64 } })
        }

        const result = await callGemini(modelKey, parts)

        logs.push({
            model_key: modelKey,
            prompt_text: text,
            response_text: result.ok ? result.text : null,
            error_message: result.ok ? null : result.error,
            latency_ms: result.latency,
            input_tokens: result.inputTokens,
            output_tokens: result.outputTokens,
        })

        if (!result.ok) {
            failure = result.error
            break
        }

        previous = result.text
        caption = result.text
    }

    caption = caption.replace(/^["“”]+|["“”]+$/g, '').trim()
    if (!failure && !caption) failure = 'The model returned an empty caption'

    // Log the attempt. A logging problem must never block the caption itself.
    let requestId: string | null = null
    const { data: logged, error: logError } = await supabase.rpc('log_generation', {
        p_chain_id: config.chain_id,
        p_hint: hint,
        p_status: failure ? 'failed' : 'succeeded',
        p_steps: logs,
    })
    if (logError) {
        console.error('Could not log generation:', logError.message)
    } else {
        requestId = logged as string
    }

    if (failure) {
        console.error('Caption generation failed:', failure)
        return NextResponse.json({ error: failure, requestId }, { status: 502 })
    }

    return NextResponse.json({ caption, requestId, chain: config.chain_name })
}