import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import AdminShell from '@/components/admin-shell'
import Banner from '@/components/banner'
import DeleteButton from '@/components/delete-button'
import { deleteRow } from '@/app/data/actions'
import { accessLabel, fetchLabels, getTable, type Column } from '@/lib/admin-tables'

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    })

export default async function DataListPage({
                                               params,
                                               searchParams,
                                           }: {
    params: Promise<{ table: string }>
    searchParams: Promise<Record<string, string | undefined>>
}) {
    const { supabase, profile } = await requireAdmin()
    const { table } = await params
    const sp = await searchParams

    const config = getTable(table)
    if (!config) notFound()

    const db = supabase as any
    let query = db
        .from(config.table)
        .select('*')
        .order(config.orderBy, { ascending: config.ascending ?? false })
        .limit(200)

    const activeFilters: { key: string; value: string }[] = []
    for (const key of config.filters ?? []) {
        const value = sp[key]
        if (value) {
            query = query.eq(key, value)
            activeFilters.push({ key, value })
        }
    }

    const q = (sp.q ?? '').trim()
    if (config.search && q) query = query.ilike(config.search, `%${q}%`)

    const { data, error: loadError } = await query
    const rows: Record<string, any>[] = data ?? []

    // Look up readable names for foreign keys
    const labels = new Map<string, Map<string, string>>()
    for (const col of config.columns) {
        if (!col.ref) continue
        const ids = Array.from(new Set(rows.map(r => r[col.key]).filter(Boolean))) as string[]
        labels.set(col.key, await fetchLabels(supabase, col.ref, ids))
    }

    const filterHref = (key: string, value: string) =>
        `/data/${config.slug}?${key}=${encodeURIComponent(value)}`

    const cell = (col: Column, row: Record<string, any>) => {
        const value = row[col.key]
        if (value === null || value === undefined || value === '') {
            return <span className="text-zinc-400">—</span>
        }

        if (col.ref) {
            const label = labels.get(col.key)?.get(value) ?? String(value).slice(0, 8)
            const text = label.length > 60 ? label.slice(0, 60) + '…' : label
            return config.filters?.includes(col.key) ? (
                <Link
                    href={filterHref(col.key, value)}
                    className="font-semibold text-[#0B2545] hover:underline"
                >
                    {text}
                </Link>
            ) : (
                text
            )
        }

        switch (col.kind) {
            case 'bool':
                return value ? 'Yes' : 'No'
            case 'date':
                return fmtDate(value)
            case 'image':
                return <img src={value} alt="" className="h-12 w-12 rounded object-cover" />
            case 'long': {
                const s = String(value)
                return <span title={s}>{s.length > 120 ? s.slice(0, 120) + '…' : s}</span>
            }
            case 'shortid': {
                const t = <span className="font-mono text-xs">{String(value).slice(0, 8)}</span>
                return config.filters?.includes(col.key) ? (
                    <Link href={filterHref(col.key, value)} className="underline">
                        {t}
                    </Link>
                ) : (
                    t
                )
            }
            default:
                return String(value)
        }
    }

    return (
        <AdminShell active="data" activeTable={config.slug} name={profile.display_name ?? 'Admin'}>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-[#0B2545]">{config.title}</h1>
                    <p className="mt-1 text-sm text-zinc-600">{config.description}</p>
                    <span className="mt-2 inline-block rounded bg-[#B9D9EB] px-2 py-1 text-xs font-bold text-[#0B2545]">
            {accessLabel(config.can)}
          </span>
                </div>
                {config.can.create && (
                    <Link
                        href={`/data/${config.slug}/new`}
                        className="rounded-lg bg-[#0B2545] px-4 py-2 text-sm font-semibold text-white hover:bg-[#143a6b]"
                    >
                        + New
                    </Link>
                )}
            </div>

            {sp.created && <Banner color="green">Created.</Banner>}
            {sp.saved && <Banner color="green">Changes saved.</Banner>}
            {sp.deleted && <Banner color="green">Deleted.</Banner>}
            {sp.error && <Banner color="red">{sp.error}</Banner>}
            {loadError && <Banner color="red">Could not load data: {loadError.message}</Banner>}

            <div className="mb-4 flex flex-wrap items-center gap-3">
                {config.search && (
                    <form method="get" className="flex gap-2">
                        {activeFilters.map(f => (
                            <input key={f.key} type="hidden" name={f.key} value={f.value} />
                        ))}
                        <input
                            name="q"
                            defaultValue={q}
                            placeholder="Search"
                            className="w-64 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                        />
                        <button className="rounded-lg bg-[#0B2545] px-4 py-2 text-sm font-semibold text-white hover:bg-[#143a6b]">
                            Search
                        </button>
                    </form>
                )}
                {(activeFilters.length > 0 || q) && (
                    <Link
                        href={`/data/${config.slug}`}
                        className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-200"
                    >
                        Clear filters
                    </Link>
                )}
                {activeFilters.map(f => (
                    <span
                        key={f.key}
                        className="rounded bg-[#B9D9EB] px-2 py-1 text-xs font-bold text-[#0B2545]"
                    >
            {f.key}: {f.value.slice(0, 8)}
          </span>
                ))}
            </div>

            <p className="mb-2 text-xs text-zinc-500">Showing {rows.length} rows (up to 200)</p>

            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                        {config.columns.map(c => (
                            <th key={c.key} className="px-4 py-3">
                                {c.label}
                            </th>
                        ))}
                        <th className="px-4 py-3"></th>
                    </tr>
                    </thead>
                    <tbody>
                    {rows.map(row => (
                        <tr key={row.id} className="border-t border-zinc-200 align-top">
                            {config.columns.map(c => (
                                <td key={c.key} className="max-w-xs px-4 py-3">
                                    {cell(c, row)}
                                </td>
                            ))}
                            <td className="whitespace-nowrap px-4 py-3">
                                <div className="flex items-center gap-4">
                                    <Link
                                        href={`/data/${config.slug}/${row.id}`}
                                        className="text-xs font-semibold text-[#0B2545] underline"
                                    >
                                        {config.can.update ? 'Edit' : 'View'}
                                    </Link>
                                    {config.can.delete && (
                                        <form action={deleteRow}>
                                            <input type="hidden" name="slug" value={config.slug} />
                                            <input type="hidden" name="id" value={row.id} />
                                            <DeleteButton message="Delete this row? This cannot be undone." />
                                        </form>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                    {rows.length === 0 && (
                        <tr>
                            <td
                                colSpan={config.columns.length + 1}
                                className="px-4 py-8 text-center text-zinc-500"
                            >
                                Nothing here yet.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </AdminShell>
    )
}