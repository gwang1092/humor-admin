'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            const result = reader.result as string
            resolve(result.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })
}

// Shrinks the photo so it fits under Vercel's 4.5 MB request limit
async function shrinkImage(file: File, maxSize = 1024): Promise<Blob> {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not process the image')
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            blob => (blob ? resolve(blob) : reject(new Error('Could not process the image'))),
            'image/jpeg',
            0.8
        )
    })
}

export default function CreateBox({ userId }: { userId: string }) {
    const [file, setFile] = useState<File | null>(null)
    const [prompt, setPrompt] = useState('')
    const [loading, setLoading] = useState(false)
    const [inputKey, setInputKey] = useState(0)
    const router = useRouter()
    const supabase = createClient()

    const handleSubmit = async () => {
        if (!file) return
        setLoading(true)

        try {
            const imageBlob = await shrinkImage(file)
            const imageBase64 = await blobToBase64(imageBlob)

            const captionRes = await fetch('/api/generate-caption', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64, prompt }),
            })

            let captionData: { caption?: string; error?: string; requestId?: string | null } = {}
            try {
                captionData = await captionRes.json()
            } catch {
                captionData = {
                    error: 'The server sent back something unexpected (status ' + captionRes.status + ').',
                }
            }

            // If the AI failed, stop here: nothing gets uploaded or posted
            if (!captionRes.ok || !captionData.caption) {
                alert(
                    'The Alma Mater is overwhelmed right now, so nothing was posted. Try again in a minute!\n\n(' +
                    (captionData.error ?? 'Unknown error') +
                    ')'
                )
                return
            }

            const filePath = `${userId}-${Date.now()}.jpg`
            const { error: uploadError } = await supabase.storage
                .from('media')
                .upload(filePath, imageBlob, { contentType: 'image/jpeg' })

            if (uploadError) {
                alert('Upload failed: ' + uploadError.message)
                return
            }

            const { data: urlData } = supabase.storage.from('media').getPublicUrl(filePath)

            const { error: insertError } = await supabase.from('media').insert({
                user_id: userId,
                image_url: urlData.publicUrl,
                prompt: prompt || 'Write a funny caption for this image.',
                caption: captionData.caption,
                generation_request_id: captionData.requestId ?? null,
            })

            if (insertError) {
                alert('Save failed: ' + insertError.message)
                return
            }

            // Reset the box, then show the new post at the top of the feed
            setFile(null)
            setPrompt('')
            setInputKey(k => k + 1)
            router.push('/feed')
            router.refresh()
        } catch (err) {
            alert('Something went wrong: ' + (err instanceof Error ? err.message : 'unknown error'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col gap-2 border-2 border-dashed border-[#0B2545] bg-white p-3">
            <p className="font-display text-sm font-black tracking-widest text-[#0B2545]">✏️ CREATE</p>
            <p className="text-xs italic text-[#33557a]">
                Submit a photo to the editor. Our AI will write the headline.
            </p>
            <input
                key={inputKey}
                type="file"
                accept="image/*"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs file:mr-2 file:border-0 file:bg-[#B9D9EB] file:px-3 file:py-1 file:text-xs file:font-bold file:text-[#0B2545]"
            />
            <input
                placeholder="Guide the headline (optional)"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                className="border-2 border-[#B9D9EB] px-2 py-1.5 text-xs"
            />
            <button
                onClick={handleSubmit}
                disabled={loading || !file}
                className="font-display border-2 border-[#0B2545] bg-[#0B2545] px-3 py-2 text-sm font-bold tracking-wider text-[#B9D9EB] transition-colors hover:bg-[#B9D9EB] hover:text-[#0B2545] disabled:opacity-50"
            >
                {loading ? '🦉 Setting type...' : '🎓 Publish'}
            </button>
        </div>
    )
}