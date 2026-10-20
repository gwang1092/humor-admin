import { requireAdmin } from '@/lib/admin'
import AdminShell from '@/components/admin-shell'
import { StatCard, Panel, BarList, Histogram, CaptionRow } from '@/components/stats'

const TZ = 'America/New_York'

// Campus references to look for in captions
const LANDMARKS: [string, RegExp][] = [
    ['Butler', /\bbutler\b/i],
    ['Avery', /\bavery\b/i],
    ['NoCo', /\bnoco\b|northwest corner/i],
    ['John Jay', /\bjohn jay\b|\bjj\b/i],
    ['Carman', /\bcarman\b/i],
    ['Furnald', /\bfurnald\b/i],
    ['Wallach', /\bwallach\b/i],
    ['Wien / Wieners', /\bwien\b|\bwieners?\b/i],
    ['Hartley', /\bhartley\b/i],
    ['Low Steps / Alma Mater', /\blow steps\b|\balma mater\b/i],
    ['Sundial', /\bsundial\b/i],
    ['Koronet', /\bkoronets?\b/i],
    ['Core / Lit Hum', /\bcore\b|\blit hum\b/i],
    ['Umbrellas', /\bumbrellas?\b/i],
    ['Cardboard rafts', /\brafts?\b/i],
    ['Rats', /\brats?\b/i],
    ['Elevators', /\belevators?\b/i],
    ['Barnard', /\bbarnard\b/i],
    ['Bwog', /\bbwog\b/i],
    ['Cafe East', /\bcafe east\b/i],
]

// Bylines look like "Antisocial Butterfly from Furnald"
function dormOf(name: string | null) {
    if (!name) return null
    const parts = name.split(' from ')
    return parts.length > 1 ? parts[parts.length - 1].trim() : null
}

function formatHour(h: number) {
    return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`
}

export default async function Home() {
    const { supabase, profile } = await requireAdmin()

    const [profilesRes, mediaRes, votesRes, commentsRes, boardRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name, created_at'),
        supabase.from('media').select('id, user_id, image_url, caption, prompt, created_at'),
        supabase.from('votes').select('media_id, user_id, value, created_at'),
        supabase.from('comments').select('user_id, created_at'),
        supabase.from('leaderboard').select('user_id, display_name, post_count, upvotes'),
    ])

    const errors = [profilesRes, mediaRes, votesRes, commentsRes, boardRes]
        .map(r => r.error?.message)
        .filter(Boolean) as string[]

    const profiles = profilesRes.data ?? []
    const media = mediaRes.data ?? []
    const votes = votesRes.data ?? []
    const comments = commentsRes.data ?? []
    const board = boardRes.data ?? []

    // ---- Headline numbers ----
    const totalUps = votes.filter(v => v.value === 1).length
    const approval = votes.length ? Math.round((totalUps / votes.length) * 100) : 0
    const votesPerPost = media.length ? (votes.length / media.length).toFixed(1) : '0'
    const customHints = media.filter(m => !/funny caption for this image/i.test(m.prompt ?? '')).length
    const hintPct = media.length ? Math.round((customHints / media.length) * 100) : 0

    // ---- Activity over the last 14 days (New York time) ----
    const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ })
    const days: string[] = []
    for (let i = 13; i >= 0; i--) {
        const d = new Date()
        d.setUTCHours(12, 0, 0, 0)
        d.setUTCDate(d.getUTCDate() - i)
        days.push(dayFmt.format(d))
    }
    const dayOf = (iso: string) => dayFmt.format(new Date(iso))
    const postsByDay = days.map(day => ({
        label: day.slice(8),
        value: media.filter(m => dayOf(m.created_at) === day).length,
    }))
    const votesByDay = days.map(day => ({
        label: day.slice(8),
        value: votes.filter(v => dayOf(v.created_at) === day).length,
    }))

    // ---- When do Lions vote? ----
    const hourFmt = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hourCycle: 'h23',
        timeZone: TZ,
    })
    const hourCounts = Array.from({ length: 24 }, () => 0)
    votes.forEach(v => {
        const h = parseInt(hourFmt.format(new Date(v.created_at)), 10) % 24
        if (!Number.isNaN(h)) hourCounts[h]++
    })
    const hourData = hourCounts.map((value, h) => ({
        label: h % 3 === 0 ? formatHour(h).replace(' ', '') : '',
        value,
    }))
    const peakCount = Math.max(...hourCounts)
    const peakHour = hourCounts.indexOf(peakCount)

    // ---- Per-caption scores ----
    const scores = new Map<string, { up: number; down: number }>()
    votes.forEach(v => {
        const s = scores.get(v.media_id) ?? { up: 0, down: 0 }
        if (v.value === 1) s.up++
        else s.down++
        scores.set(v.media_id, s)
    })
    const ranked = media.map(m => {
        const s = scores.get(m.id) ?? { up: 0, down: 0 }
        return { ...m, up: s.up, down: s.down, net: s.up - s.down }
    })
    const hallOfFame = [...ranked].sort((a, b) => b.net - a.net).filter(m => m.up > 0).slice(0, 3)
    const hallOfShame = [...ranked].sort((a, b) => a.net - b.net).filter(m => m.net < 0).slice(0, 3)
    const mostDivisive = ranked
        .filter(m => m.up > 0 && m.down > 0)
        .sort((a, b) => Math.min(b.up, b.down) - Math.min(a.up, a.down) || b.up + b.down - (a.up + a.down))
        .slice(0, 1)

    // ---- Dorm Wars (from the generated bylines) ----
    const dorms = new Map<string, { posts: number; upvotes: number; lions: number }>()
    board.forEach(b => {
        const dorm = dormOf(b.display_name)
        if (!dorm) return
        const t = dorms.get(dorm) ?? { posts: 0, upvotes: 0, lions: 0 }
        t.posts += b.post_count
        t.upvotes += b.upvotes
        t.lions += 1
        dorms.set(dorm, t)
    })
    const dormRows = Array.from(dorms.entries())
        .map(([label, t]) => ({
            label,
            value: t.upvotes,
            note: `${t.posts} posts · ${t.lions} ${t.lions === 1 ? 'Lion' : 'Lions'}`,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)

    // ---- Campus references in captions ----
    const landmarkRows = LANDMARKS.map(([label, re]) => ({
        label,
        value: media.filter(m => re.test(m.caption ?? '')).length,
    }))
        .filter(r => r.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)

    // ---- Badge census ----
    const census = [
        ...[10, 20, 30].map(n => ({
            label: `${n}+ posts`,
            value: board.filter(b => b.post_count >= n).length,
        })),
        ...[5, 10, 15].map(n => ({
            label: `${n}+ upvotes`,
            value: board.filter(b => b.upvotes >= n).length,
        })),
    ]

    return (
        <AdminShell active="dashboard" name={profile.display_name ?? 'Admin'}>
            <h1 className="text-3xl font-bold text-[#0B2545]">Dashboard</h1>
            <p className="mb-6 mt-1 text-sm text-zinc-600">
                Live numbers from the Alma Memer database.
            </p>

            {errors.length > 0 && (
                <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
                    Some data could not be loaded: {errors.join(' | ')}
                </div>
            )}

            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <StatCard label="Lions" value={profiles.length} note="registered profiles" />
                <StatCard label="Posts" value={media.length} />
                <StatCard label="Votes" value={votes.length} note={`${votesPerPost} per post`} />
                <StatCard label="Letters" value={comments.length} note="comments" />
                <StatCard label="Approval" value={`${approval}%`} note="of votes are upvotes" />
                <StatCard label="Custom hints" value={`${hintPct}%`} note="of posts used one" />
            </div>

            <div className="mb-6 grid gap-6 md:grid-cols-2">
                <Panel title="Posts per day" subtitle="Last 14 days, New York time">
                    <Histogram data={postsByDay} />
                </Panel>
                <Panel title="Votes per day" subtitle="Last 14 days, New York time">
                    <Histogram data={votesByDay} color="#4F8FBF" />
                </Panel>
            </div>

            <div className="mb-6 grid gap-6 md:grid-cols-2">
                <Panel title="Dorm Wars" subtitle="Upvotes earned by each byline's residence hall">
                    <BarList items={dormRows} empty="No bylines with a dorm yet." />
                </Panel>
                <Panel title="Campus references" subtitle="How many captions mention each landmark">
                    <BarList items={landmarkRows} empty="No landmarks mentioned in captions yet." />
                </Panel>
            </div>

            <div className="mb-6">
                <Panel
                    title="When do Lions vote?"
                    subtitle={
                        peakCount > 0
                            ? `Peak roar hour: ${formatHour(peakHour)} (New York time), ${peakCount} votes`
                            : 'No votes yet'
                    }
                >
                    <Histogram data={hourData} color="#0B2545" />
                </Panel>
            </div>

            <div className="mb-6 grid gap-6 lg:grid-cols-3">
                <Panel title="Hall of Fame" subtitle="Highest net score">
                    <div className="flex flex-col gap-4">
                        {hallOfFame.length === 0 && <p className="text-sm text-zinc-500">No upvotes yet.</p>}
                        {hallOfFame.map(m => (
                            <CaptionRow key={m.id} imageUrl={m.image_url} caption={m.caption} up={m.up} down={m.down} />
                        ))}
                    </div>
                </Panel>
                <Panel title="Hall of Shame" subtitle="Lowest net score">
                    <div className="flex flex-col gap-4">
                        {hallOfShame.length === 0 && (
                            <p className="text-sm text-zinc-500">Nobody has been shamed yet.</p>
                        )}
                        {hallOfShame.map(m => (
                            <CaptionRow key={m.id} imageUrl={m.image_url} caption={m.caption} up={m.up} down={m.down} />
                        ))}
                    </div>
                </Panel>
                <Panel title="Most divisive" subtitle="Closest to a perfect split">
                    <div className="flex flex-col gap-4">
                        {mostDivisive.length === 0 && (
                            <p className="text-sm text-zinc-500">No caption has both upvotes and downvotes yet.</p>
                        )}
                        {mostDivisive.map(m => (
                            <CaptionRow key={m.id} imageUrl={m.image_url} caption={m.caption} up={m.up} down={m.down} />
                        ))}
                    </div>
                </Panel>
            </div>

            <Panel title="Badge census" subtitle="How many Lions have reached each reward tier">
                <BarList items={census} />
            </Panel>
        </AdminShell>
    )
}