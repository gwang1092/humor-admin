import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import AdminShell from '@/components/admin-shell'
import DeleteButton from '@/components/delete-button'
import { deleteMedia } from '@/app/media/actions'

export default async function MediaPage({
                                            searchParams,
                                        }: {
    searchParams: Promise<{
        q?: string
        user?: string
        created?: string
        saved?: string
        deleted?: string
        error?: string
    }>
}) {
    const { supabase, profile } = await requireAdmin()
    const { q = '', user = '', created, saved, deleted, error } = await searchParams

    let query = supabase
        .from('media')
        .select('id, user_id, image_url, caption, prompt, created_at')
        .order('created_at', { ascending: false })
        .limit(200)

    if (user) query = query.eq('user_id', user)
    if (q.trim()) query = query.ilike('caption', `%${q.trim()}%`)

    const [mediaRes, votesRes] = await Promise.all([
        query,
        supabase.from('votes').select('media_id, value'),
    ])

    const media = mediaRes.data ?? []
    const userIds = Array.from(new Set(media.map(m => m.user_id)))
    if (user && !userIds.includes(user)) userIds.push(user)

    const { data: authors } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds)

    const names = new Map(
        (authors ?? []).map(a => [a.id, a.display_name] as [string, string | null])
    )

    const scores = new Map<string, { up: number; down: number }>()
    ;(votesRes.data ?? []).forEach(v => {
        const s = scores.get(v.media_id) ?? { up: 0, down: 0 }
        if (v.value === 1) s.up++
        else s.down++
        scores.set(v.media_id, s)
    })

    const fmt = (iso: string) =>
        new Date(iso).toLocaleString('en-US', {
            timeZone: 'America/New_York',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        })

    const loadError = mediaRes.error?.message ?? votesRes.error?.message

    return (
        <AdminShell active="media" name={profile.display_name ?? 'Admin'}>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-[#0B2545]">Media</h1>
                    <p className="mt-1 text-sm text-zinc-600">
                        Every AI-generated post. Create, edit and delete them here.
                    </p>
                </div>
                <Link
                    href="/media/new"
                    className="rounded-lg bg-[#0B2545] px-4 py-2 text-sm font-semibold text-white hover:bg-[#143a6b]"
                >
                    + New post
                </Link>
            </div>

            {created && <Banner color="green">Post created.</Banner>}
            {saved && <Banner color="green">Changes saved.</Banner>}
            {deleted && <Banner color="green">Post deleted.</Banner>}
            {error && <Banner color="red">{error}</Banner>}
            {loadError && <Banner color="red">Could not load media: {loadError}</Banner>}

            <div className="mb-4 flex flex-wrap items-center gap-3">
                <form method="get" className="flex gap-2">
                    {user && <input type="hidden" name="user" value={user} />}
                    <input
                        name="q"
                        defaultValue={q}
                        placeholder="Search captions"
                        className="w-64 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                    />
                    <button className="rounded-lg bg-[#0B2545] px-4 py-2 text-sm font-semibold text-white hover:bg-[#143a6b]">
                        Search
                    </button>
                </form>

                {(user || q) && (
                    <Link
                        href="/media"
                        className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-200"
                    >
                        Clear filters
                    </Link>
                )}

                {user && (
                    <span className="rounded bg-[#B9D9EB] px-2 py-1 text-xs font-bold text-[#0B2545]">
            Posts by {names.get(user) ?? 'this Lion'}
          </span>
                )}
            </div>

            <p className="mb-2 text-xs text-zinc-500">Showing {media.length} posts</p>

            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                        <th className="px-4 py-3">Image</th>
                        <th className="px-4 py-3">Caption</th>
                        <th className="px-4 py-3">Author</th>
                        <th className="px-4 py-3">Votes</th>
                        <th className="px-4 py-3">Created</th>
                        <th className="px-4 py-3"></th>
                    </tr>
                    </thead>
                    <tbody>
                    {media.map(m => {
                        const s = scores.get(m.id) ?? { up: 0, down: 0 }
                        return (
                            <tr key={m.id} className="border-t border-zinc-200 align-top">
                                <td className="px-4 py-3">
                                    <img src={m.image_url} alt="" className="h-16 w-16 rounded object-cover" />
                                </td>
                                <td className="max-w-md px-4 py-3">
                                    <p className="font-medium">{m.caption}</p>
                                    <p className="mt-1 text-xs text-zinc-500">Prompt: {m.prompt}</p>
                                </td>
                                <td className="px-4 py-3">{names.get(m.user_id) ?? 'Unknown'}</td>
                                <td className="whitespace-nowrap px-4 py-3">
                                    👍 {s.up} · 👎 {s.down}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">{fmt(m.created_at)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-4">
                                        <Link
                                            href={`/media/${m.id}`}
                                            className="text-xs font-semibold text-[#0B2545] underline"
                                        >
                                            Edit
                                        </Link>
                                        <form action={deleteMedia}>
                                            <input type="hidden" name="id" value={m.id} />
                                            <DeleteButton />
                                        </form>
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                    {media.length === 0 && (
                        <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                                No posts found.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </AdminShell>
    )
}

function Banner({ color, children }: { color: 'green' | 'red'; children: React.ReactNode }) {
    const styles =
        color === 'green'
            ? 'border-green-300 bg-green-50 text-green-800'
            : 'border-red-300 bg-red-50 text-red-800'
    return <div className={`mb-4 rounded-lg border p-3 text-sm ${styles}`}>{children}</div>
}