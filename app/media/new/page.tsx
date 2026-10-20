import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import AdminShell from '@/components/admin-shell'
import MediaCreateForm from '@/components/media-create-form'

export default async function NewMediaPage() {
    const { user, profile } = await requireAdmin()

    return (
        <AdminShell active="media" name={profile.display_name ?? 'Admin'}>
            <Link href="/media" className="text-sm text-zinc-600 underline">
                ← Back to media
            </Link>
            <h1 className="mb-6 mt-2 text-3xl font-bold text-[#0B2545]">New post</h1>
            <MediaCreateForm userId={user.id} />
        </AdminShell>
    )
}