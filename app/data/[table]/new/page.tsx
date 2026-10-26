import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import AdminShell from '@/components/admin-shell'
import Banner from '@/components/banner'
import RecordForm from '@/components/record-form'
import { fetchOptions, getTable } from '@/lib/admin-tables'

export default async function NewRecordPage({
                                                params,
                                                searchParams,
                                            }: {
    params: Promise<{ table: string }>
    searchParams: Promise<{ error?: string }>
}) {
    const { supabase, profile } = await requireAdmin()
    const { table } = await params
    const { error } = await searchParams

    const config = getTable(table)
    if (!config || !config.can.create) notFound()

    const options: Record<string, { id: string; label: string }[]> = {}
    for (const f of config.fields) {
        if (f.type === 'select' && f.ref) options[f.name] = await fetchOptions(supabase, f.ref)
    }

    return (
        <AdminShell active="data" activeTable={config.slug} name={profile.display_name ?? 'Admin'}>
            <Link href={`/data/${config.slug}`} className="text-sm text-zinc-600 underline">
                ← Back to {config.title.toLowerCase()}
            </Link>
            <h1 className="mb-6 mt-2 text-3xl font-bold text-[#0B2545]">New: {config.title}</h1>

            {error && (
                <div className="max-w-xl">
                    <Banner color="red">{error}</Banner>
                </div>
            )}

            <RecordForm config={config} mode="create" options={options} />
        </AdminShell>
    )
}