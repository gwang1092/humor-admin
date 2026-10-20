import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import AdminShell from '@/components/admin-shell'
import { updateMedia } from '@/app/media/actions'

export default async function EditMediaPage({
                                                params,
                                                searchParams,
                                            }: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ error?: string }>
}) {
    const { supabase, profile } = await requireAdmin()
    const { id } = await params
    const { error } = await searchParams

    const { data: post } = await supabase
        .from('media')
        .select('id, user_id, image_url, caption, prompt, created_at')
        .eq('id', id)
        .single()

    if (!post) notFound()

    const [{ data: author }, { data: votes }] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('id', post.user_id).single(),
        supabase.from('votes').select('value').eq('media_id', id),
    ])

    const up = (votes ?? []).filter(v => v.value === 1).length
    const down = (votes ?? []).filter(v => v.value === -1).length

    return (
        <AdminShell active="media" name={profile.display_name ?? 'Admin'}>
            <Link href="/media" className="text-sm text-zinc-600 underline">
                ← Back to media
            </Link>
            <h1 className="mb-6 mt-2 text-3xl font-bold text-[#0B2545]">Edit post</h1>

            {error && (
                <div className="mb-4 max-w-xl rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                    {error}
                </div>
            )}

            <div className="flex max-w-3xl flex-col gap-6 md:flex-row">
                <div className="md:w-1/2">
                    <img src={post.image_url} alt="" className="w-full rounded-xl border border-zinc-200" />
                    <p className="mt-2 text-xs text-zinc-500">
                        By {author?.display_name ?? 'Unknown'} · 👍 {up} · 👎 {down}
                    </p>
                </div>

                <form
                    action={updateMedia}
                    className="flex flex-1 flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
                >
                    <input type="hidden" name="id" value={post.id} />

                    <label className="text-sm font-semibold">
                        Caption
                        <textarea
                            name="caption"
                            defaultValue={post.caption}
                            rows={4}
                            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal"
                        />
                    </label>

                    <label className="text-sm font-semibold">
                        Prompt used
                        <input
                            name="prompt"
                            defaultValue={post.prompt}
                            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal"
                        />
                    </label>

                    <div className="flex gap-3">
                        <button className="rounded-lg bg-[#0B2545] px-4 py-2 font-semibold text-white hover:bg-[#143a6b]">
                            Save changes
                        </button>
                        <Link
                            href="/media"
                            className="rounded-lg border border-zinc-300 px-4 py-2 font-semibold hover:bg-zinc-200"
                        >
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </AdminShell>
    )
}