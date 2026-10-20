import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import AdminShell from '@/components/admin-shell'
import { StatCard } from '@/components/stats'

const filters = [
    { key: '', label: 'All' },
    { key: 'up', label: 'Upvotes' },
    { key: 'down', label: 'Downvotes' },
]

export default async function VotesPage({
                                            searchParams,
                                        }: {
    searchParams: Promise<{ v?: string; user?: string; media?: string }>
}) {
    const { supabase, profile } = await requireAdmin()
    const { v = '', user = '', media: mediaId = '' } = await searchParams

    let query = supabase
        .from('votes')
        .select('id, user_id, media_id, value, created_at')
        .order('created_at', { ascending: false })
        .limit(200)

    if (v === 'up') query = query.eq('value', 1)
    if (v === 'down') query = query.eq('value', -1)
    if (user) query = query.eq('user_id', user)
    if (mediaId) query = query.eq('media_id', mediaId)

    const [votesRes, upRes, downRes] = await Promise.all([
        query,
        supabase.from('votes').select('id', { count: 'exact', head: true }).eq('value', 1),
        supabase.from('votes').select('id', { count: 'exact', head: true }).eq('value', -1),
    ])

    const votes = votesRes.data ?? []
    const ups = upRes.count ?? 0
    const downs = downRes.count ?? 0
    const total = ups + downs
    const approval = total ? Math.round((ups / total) * 100) : 0

    const voterIds = Array.from(new Set(votes.map(x => x.user_id)))
    const mediaIds = Array.from(new Set(votes.map(x => x.media_id)))

    const [votersRes, postsRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name').in('id', voterIds),
        supabase.from('media').select('id, image_url, caption').in('id', mediaIds),
    ])

    const names = new Map(
        (votersRes.data ?? []).map(p => [p.id, p.display_name] as [string, string | null])
    )
    const posts = new Map((postsRes.data ?? []).map(m => [m.id, m]))

    const errors = [votesRes, upRes, downRes, votersRes, postsRes]
        .map(r => r.error?.message)
        .filter(Boolean) as string[]

    // Build a link that keeps the other filters
    const link = (next: { v?: string; user?: string; media?: string }) => {
        const merged: Record<string, string | undefined> = { v, user, media: mediaId, ...next }
        const qs = Object.entries(merged)
            .filter(([, val]) => val)
            .map(([k, val]) => `${k}=${encodeURIComponent(val as string)}`)
            .join('&')
        return qs ? `/votes?${qs}` : '/votes'
    }

    const fmt = (iso: string) =>
        new Date(iso).toLocaleString('en-US', {
            timeZone: 'America/New_York',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        })

    const hasFilter = v || user || mediaId

    return (
        <AdminShell active="votes" name={profile.display_name ?? 'Admin'}>
            <h1 className="text-3xl font-bold text-[#0B2545]">Votes</h1>
            <p className="mb-6 mt-1 text-sm text-zinc-600">
                Every upvote and downvote, newest first. This page is read-only.
            </p>

            {errors.length > 0 && (
                <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
                    Some data could not be loaded: {errors.join(' | ')}
                </div>
            )}

            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatCard label="Total votes" value={total} />
                <StatCard label="Upvotes" value={ups} />
                <StatCard label="Downvotes" value={downs} />
                <StatCard label="Approval" value={`${approval}%`} note="of votes are upvotes" />
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-zinc-500">Show:</span>
                {filters.map(f => (
                    <Link
                        key={f.key}
                        href={link({ v: f.key })}
                        className={`rounded px-3 py-1.5 font-semibold ${
                            v === f.key
                                ? 'bg-[#0B2545] text-white'
                                : 'border border-zinc-300 bg-white hover:bg-zinc-200'
                        }`}
                    >
                        {f.label}
                    </Link>
                ))}

                {user && (
                    <span className="rounded bg-[#B9D9EB] px-2 py-1 text-xs font-bold text-[#0B2545]">
            Voter: {names.get(user) ?? 'unknown'}
          </span>
                )}
                {mediaId && (
                    <span className="rounded bg-[#B9D9EB] px-2 py-1 text-xs font-bold text-[#0B2545]">
            One post only
          </span>
                )}
                {hasFilter && (
                    <Link
                        href="/votes"
                        className="rounded border border-zinc-300 px-3 py-1.5 hover:bg-zinc-200"
                    >
                        Clear filters
                    </Link>
                )}
            </div>

            <p className="mb-2 text-xs text-zinc-500">
                Showing the {votes.length} most recent matching votes (up to 200)
            </p>

            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                        <th className="px-4 py-3">Voter</th>
                        <th className="px-4 py-3">Vote</th>
                        <th className="px-4 py-3">Caption</th>
                        <th className="px-4 py-3">When</th>
                    </tr>
                    </thead>
                    <tbody>
                    {votes.map(x => {
                        const post = posts.get(x.media_id)
                        return (
                            <tr key={x.id} className="border-t border-zinc-200 align-middle">
                                <td className="px-4 py-3">
                                    <Link
                                        href={link({ user: x.user_id })}
                                        className="font-semibold text-[#0B2545] hover:underline"
                                    >
                                        {names.get(x.user_id) ?? 'Unknown'}
                                    </Link>
                                </td>
                                <td className="px-4 py-3">
                                    {x.value === 1 ? (
                                        <span className="rounded bg-green-100 px-2 py-1 text-xs font-bold text-green-800">
                        👍 Upvote
                      </span>
                                    ) : (
                                        <span className="rounded bg-red-100 px-2 py-1 text-xs font-bold text-red-800">
                        👎 Downvote
                      </span>
                                    )}
                                </td>
                                <td className="max-w-md px-4 py-3">
                                    {post ? (
                                        <div className="flex items-center gap-3">
                                            <img
                                                src={post.image_url}
                                                alt=""
                                                className="h-10 w-10 shrink-0 rounded object-cover"
                                            />
                                            <div className="min-w-0">
                                                <p className="truncate">{post.caption}</p>
                                                <div className="flex gap-3 text-xs">
                                                    <Link
                                                        href={link({ media: x.media_id })}
                                                        className="font-semibold text-[#0B2545] underline"
                                                    >
                                                        All votes on this post
                                                    </Link>
                                                    <Link
                                                        href={`/media/${post.id}`}
                                                        className="font-semibold text-[#0B2545] underline"
                                                    >
                                                        Open post
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-zinc-400">Post no longer exists</span>
                                    )}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">{fmt(x.created_at)}</td>
                            </tr>
                        )
                    })}
                    {votes.length === 0 && (
                        <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                                No votes match.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </AdminShell>
    )
}