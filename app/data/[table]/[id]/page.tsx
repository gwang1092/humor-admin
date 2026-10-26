import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import AdminShell from '@/components/admin-shell'
import Banner from '@/components/banner'
import DeleteButton from '@/components/delete-button'
import RecordForm from '@/components/record-form'
import { deleteRow } from '@/app/data/actions'
import { accessLabel, fetchLabels, fetchOptions, getTable } from '@/lib/admin-tables'

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    })

export default async function RecordPage({
                                             params,
                                             searchParams,
                                         }: {
    params: Promise<{ table: string; id: string }>
    searchParams: Promise<{ error?: string }>
}) {
    const { supabase, profile } = await requireAdmin()
    const { table, id } = await params
    const { error } = await searchParams

    const config = getTable(table)
    if (!config) notFound()

    const db = supabase as any
    const { data } = await db.from(config.table).select('*').eq('id', id).single()
    if (!data) notFound()
    const row = data as Record<string, any>

    const shell = (children: React.ReactNode) => (
        <AdminShell active="data" activeTable={config.slug} name={profile.display_name ?? 'Admin'}>
            <Link href={`/data/${config.slug}`} className="text-sm text-zinc-600 underline">
                ← Back to {config.title.toLowerCase()}
            </Link>
            <h1 className="mb-1 mt-2 text-3xl font-bold text-[#0B2545]">
                {config.can.update ? 'Edit' : 'View'}: {config.title}
            </h1>
            <span className="mb-6 inline-block rounded bg-[#B9D9EB] px-2 py-1 text-xs font-bold text-[#0B2545]">
        {accessLabel(config.can)}
      </span>
            {error && (
                <div className="max-w-xl">
                    <Banner color="red">{error}</Banner>
                </div>
            )}
            {children}
        </AdminShell>
    )

    // Editable tables get a form
    if (config.can.update) {
        const options: Record<string, { id: string; label: string }[]> = {}
        const displayValues: Record<string, string> = {}

        for (const f of config.fields) {
            if (f.type === 'select' && f.ref) {
                options[f.name] = await fetchOptions(supabase, f.ref)
            }
            if (f.type === 'display') {
                const raw = row[f.name]
                if (f.ref && raw) {
                    const m = await fetchLabels(supabase, f.ref, [raw])
                    displayValues[f.name] = m.get(raw) ?? String(raw)
                } else {
                    displayValues[f.name] = raw == null ? '' : String(raw)
                }
            }
        }

        return shell(
            <>
                <RecordForm
                    config={config}
                    mode="update"
                    id={id}
                    values={row}
                    options={options}
                    displayValues={displayValues}
                />
                {config.can.delete && (
                    <form action={deleteRow} className="mt-6">
                        <input type="hidden" name="slug" value={config.slug} />
                        <input type="hidden" name="id" value={id} />
                        <DeleteButton message="Delete this row? This cannot be undone." />
                    </form>
                )}
            </>
        )
    }

    // Read-only tables show every column
    const refLabels = new Map<string, Map<string, string>>()
    for (const col of config.columns) {
        if (col.ref && row[col.key]) {
            refLabels.set(col.key, await fetchLabels(supabase, col.ref, [row[col.key]]))
        }
    }

    return shell(
        <dl className="max-w-3xl divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white shadow-sm">
            {Object.entries(row).map(([key, value]) => {
                const col = config.columns.find(c => c.key === key)
                let shown: React.ReactNode

                if (value === null || value === undefined || value === '') {
                    shown = <span className="text-zinc-400">—</span>
                } else if (col?.ref) {
                    shown = refLabels.get(key)?.get(value as string) ?? String(value)
                } else if (col?.kind === 'image') {
                    shown = <img src={String(value)} alt="" className="h-40 rounded-lg object-cover" />
                } else if (col?.kind === 'date' || key.endsWith('_at')) {
                    shown = fmtDate(String(value))
                } else if (typeof value === 'object') {
                    shown = <pre className="text-xs">{JSON.stringify(value, null, 2)}</pre>
                } else {
                    shown = <p className="whitespace-pre-wrap">{String(value)}</p>
                }

                return (
                    <div key={key} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row">
                        <dt className="w-48 shrink-0 font-semibold text-zinc-500">{key}</dt>
                        <dd className="min-w-0 flex-1">{shown}</dd>
                    </div>
                )
            })}
        </dl>
    )
}