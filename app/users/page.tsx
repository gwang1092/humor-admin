import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import AdminShell from '@/components/admin-shell'

const sorts = [
    { key: 'joined', label: 'Newest' },
    { key: 'posts', label: 'Most posts' },
    { key: 'upvotes', label: 'Most upvotes' },
    { key: 'name', label: 'Name' },
]

function countBy(rows: { user_id: string }[]) {
    const m = new Map<string, number>()
    rows.forEach(r => m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1))
    return m
}

export default async function UsersPage({
                                            searchParams,
                                        }: {
    searchParams: Promise<{ q?: string; sort?: string }>
}) {
    const { supabase, profile } = await requireAdmin()
    const { q = '', sort = 'joined' } = await searchParams

    const [profilesRes, boardRes, votesRes, commentsRes] = await Promise.all([
        supabase
            .from('profiles')
            .select('id, display_name, first_name, last_name, avatar_url, created_at, is_superadmin'),
        supabase.from('leaderboard').select('user_id, post_count, upvotes'),
        supabase.from('votes').select('user_id'),
        supabase.from('comments').select('user_id'),
    ])

    const errors = [profilesRes, boardRes, votesRes, commentsRes]
        .map(r => r.error?.message)
        .filter(Boolean) as string[]

    const stats = new Map<string, { post_count: number; upvotes: number }>()
    ;(boardRes.data ?? []).forEach(b => stats.set(b.user_id, b))
    const votesCast = countBy(votesRes.data ?? [])
    const letters = countBy(commentsRes.data ?? [])

    const all = (profilesRes.data ?? []).map(p => ({
        ...p,
        posts: stats.get(p.id)?.post_count ?? 0,
        upvotes: stats.get(p.id)?.upvotes ?? 0,
        votesCast: votesCast.get(p.id) ?? 0,
        letters: letters.get(p.id) ?? 0,
    }))

    const needle = q.trim().toLowerCase()
    const rows = needle
        ? all.filter(r =>
            [r.display_name, r.first_name, r.last_name].some(v =>
                (v ?? '').toLowerCase().includes(needle)
            )
        )
        : [...all]

    rows.sort((a, b) => {
        if (sort === 'posts') return b.posts - a.posts
        if (sort === 'upvotes') return b.upvotes - a.upvotes
        if (sort === 'name') return (a.display_name ?? '').localeCompare(b.display_name ?? '')
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    const fmt = (iso: string) =>
        new Date(iso).toLocaleDateString('en-US', {
            timeZone: 'America/New_York',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        })

    return (
        <AdminShell active="users" name={profile.display_name ?? 'Admin'}>
            <h1 className="text-3xl font-bold text-[#0B2545]">Users</h1>
            <p className="mb-6 mt-1 text-sm text-zinc-600">
                Every registered profile. This page is read-only.
            </p>

            {errors.length > 0 && (
                <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
                    Some data could not be loaded: {errors.join(' | ')}
                </div>
            )}

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <form method="get" className="flex gap-2">
                    <input type="hidden" name="sort" value={sort} />
                    <input
                        name="q"
                        defaultValue={q}
                        placeholder="Search by byline or name"
                        className="w-64 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                    />
                    <button className="rounded-lg bg-[#0B2545] px-4 py-2 text-sm font-semibold text-white hover:bg-[#143a6b]">
                        Search
                    </button>
                    {q && (
                        <Link
                            href={`/users?sort=${sort}`}
                            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-200"
                        >
                            Clear
                        </Link>
                    )}
                </form>

                <div className="flex items-center gap-1 text-sm">
                    <span className="mr-1 text-zinc-500">Sort:</span>
                    {sorts.map(s => (
                        <Link
                            key={s.key}
                            href={`/users?sort=${s.key}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                            className={`rounded px-3 py-1.5 font-semibold ${
                                sort === s.key
                                    ? 'bg-[#0B2545] text-white'
                                    : 'border border-zinc-300 bg-white hover:bg-zinc-200'
                            }`}
                        >
                            {s.label}
                        </Link>
                    ))}
                </div>
            </div>

            <p className="mb-2 text-xs text-zinc-500">
                Showing {rows.length} of {all.length} Lions
            </p>

            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                        <th className="px-4 py-3">Lion</th>
                        <th className="px-4 py-3">Real name</th>
                        <th className="px-4 py-3 text-right">Posts</th>
                        <th className="px-4 py-3 text-right">Upvotes</th>
                        <th className="px-4 py-3 text-right">Votes cast</th>
                        <th className="px-4 py-3 text-right">Letters</th>
                        <th className="px-4 py-3">Joined</th>
                        <th className="px-4 py-3"></th>
                    </tr>
                    </thead>
                    <tbody>
                    {rows.map(r => (
                        <tr key={r.id} className="border-t border-zinc-200">
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                    {r.avatar_url ? (
                                        <img src={r.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                                    ) : (
                                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-200">
                        🦁
                      </span>
                                    )}
                                    <div>
                                        <p className="font-semibold text-[#0B2545]">
                                            {r.display_name ?? 'Unassigned'}
                                        </p>
                                        {r.is_superadmin && (
                                            <span className="rounded bg-[#B9D9EB] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#0B2545]">
                          Admin
                        </span>
                                        )}
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-3">
                                {[r.first_name, r.last_name].filter(Boolean).join(' ') || (
                                    <span className="text-zinc-400">not set</span>
                                )}
                            </td>
                            <td className="px-4 py-3 text-right">{r.posts}</td>
                            <td className="px-4 py-3 text-right">{r.upvotes}</td>
                            <td className="px-4 py-3 text-right">{r.votesCast}</td>
                            <td className="px-4 py-3 text-right">{r.letters}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{fmt(r.created_at)}</td>
                            <td className="px-4 py-3 text-right">
                                <Link
                                    href={`/media?user=${r.id}`}
                                    className="text-xs font-semibold text-[#0B2545] underline"
                                >
                                    View posts
                                </Link>
                            </td>
                        </tr>
                    ))}
                    {rows.length === 0 && (
                        <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                                No Lions match that search.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </AdminShell>
    )
}