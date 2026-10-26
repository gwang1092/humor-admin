'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ImageUploadField({
                                             name,
                                             pathName,
                                             bucket,
                                             defaultUrl = '',
                                             defaultPath = '',
                                             required,
                                         }: {
    name: string
    pathName?: string
    bucket: string
    defaultUrl?: string
    defaultPath?: string
    required?: boolean
}) {
    const [url, setUrl] = useState(defaultUrl)
    const [path, setPath] = useState(defaultPath)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')
    const supabase = createClient()

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        setError('')

        const ext = file.name.split('.').pop() || 'jpg'
        const filePath = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(filePath, file, { contentType: file.type })

        if (uploadError) {
            setError('Upload failed: ' + uploadError.message)
            setUploading(false)
            return
        }

        const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
        setUrl(data.publicUrl)
        setPath(filePath)
        setUploading(false)
    }

    return (
        <div className="mt-1 flex flex-col gap-2">
            {url && (
                <img src={url} alt="" className="h-40 w-40 rounded-lg border border-zinc-300 object-cover" />
            )}
            <input
                type="file"
                accept="image/*"
                onChange={handleFile}
                disabled={uploading}
                className="text-sm font-normal"
            />
            <input
                name={name}
                value={url}
                onChange={e => {
                    setUrl(e.target.value)
                    setPath('')
                }}
                required={required}
                placeholder="...or paste an image URL"
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-normal"
            />
            {pathName && <input type="hidden" name={pathName} value={path} />}
            {uploading && <p className="text-xs font-normal text-zinc-500">Uploading...</p>}
            {error && <p className="text-xs font-normal text-red-700">{error}</p>}
        </div>
    )
}