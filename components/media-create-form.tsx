'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function MediaCreateForm({ userId }: { userId: string }) {
    const [file, setFile] = useState<File | null>(null)
    const [caption, setCaption] = useState('')
    const [prompt, setPrompt] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const router = useRouter()
    const supabase = createClient()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!file || !caption.trim()) {
            setError('Choose an image and write a caption.')
            return
        }

        setSaving(true)
        setError('')

        const ext = file.name.split('.').pop() || 'jpg'
        const path = `${userId}-${Date.now()}.${ext}`

        const { error: uploadError } = await supabase.storage
            .from('media')
            .upload(path, file, { contentType: file.type })

        if (uploadError) {
            setError('Upload failed: ' + uploadError.message)
            setSaving(false)
            return
        }

        const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)

        const { error: insertError } = await supabase.from('media').insert({
            user_id: userId,
            image_url: urlData.publicUrl,
            caption: caption.trim(),
            prompt: prompt.trim() || 'Added by an admin',
        })

        if (insertError) {
            setError('Save failed: ' + insertError.message)
            setSaving(false)
            return
        }

        router.push('/media?created=1')
        router.refresh()
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="flex max-w-xl flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
            {error && (
                <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>
            )}

            <label className="text-sm font-semibold">
                Image
                <input
                    type="file"
                    accept="image/*"
                    onChange={e => setFile(e.target.files?.[0] ?? null)}
                    className="mt-1 block w-full text-sm font-normal"
                />
            </label>

            <label className="text-sm font-semibold">
                Caption
                <textarea
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    rows={3}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal"
                />
            </label>

            <label className="text-sm font-semibold">
                Prompt used (optional)
                <input
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal"
                />
            </label>

            <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#0B2545] px-4 py-2 font-semibold text-white hover:bg-[#143a6b] disabled:opacity-50"
            >
                {saving ? 'Saving...' : 'Create post'}
            </button>
        </form>
    )
}