'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'

export async function updateMedia(formData: FormData) {
    // Server actions are public endpoints, so re-check admin status here
    const { supabase } = await requireAdmin()

    const id = String(formData.get('id') ?? '')
    const caption = String(formData.get('caption') ?? '').trim()
    const prompt = String(formData.get('prompt') ?? '').trim()

    if (!id) redirect('/media?error=Missing%20post%20id')
    if (!caption) {
        redirect(`/media/${id}?error=${encodeURIComponent('Caption cannot be empty')}`)
    }

    const { data, error } = await supabase
        .from('media')
        .update({ caption, prompt })
        .eq('id', id)
        .select('id')

    if (error || !data?.length) {
        redirect(
            `/media/${id}?error=${encodeURIComponent(
                error?.message ?? 'Update was blocked or the post no longer exists'
            )}`
        )
    }

    revalidatePath('/media')
    redirect('/media?saved=1')
}

export async function deleteMedia(formData: FormData) {
    const { supabase } = await requireAdmin()

    const id = String(formData.get('id') ?? '')
    if (!id) redirect('/media?error=Missing%20post%20id')

    const { data: row } = await supabase
        .from('media')
        .select('image_url')
        .eq('id', id)
        .single()

    // Votes and comments on this post are deleted automatically (cascade)
    const { data, error } = await supabase.from('media').delete().eq('id', id).select('id')

    if (error || !data?.length) {
        redirect(
            `/media?error=${encodeURIComponent(
                error?.message ?? 'Delete was blocked or the post no longer exists'
            )}`
        )
    }

    // Remove the image file too, unless another post still uses the same image
    if (row?.image_url) {
        const marker = '/object/public/media/'
        const idx = row.image_url.indexOf(marker)
        if (idx !== -1) {
            const path = decodeURIComponent(row.image_url.slice(idx + marker.length))
            const { count } = await supabase
                .from('media')
                .select('id', { count: 'exact', head: true })
                .eq('image_url', row.image_url)
            if (!count) {
                await supabase.storage.from('media').remove([path])
            }
        }
    }

    revalidatePath('/media')
    redirect('/media?deleted=1')
}