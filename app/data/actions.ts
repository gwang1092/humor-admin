'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { getTable, type Field, type TableConfig } from '@/lib/admin-tables'

function coerce(field: Field, formData: FormData) {
    const raw = formData.get(field.name)
    if (field.type === 'boolean') return raw === 'on' || raw === 'true'
    const s = raw == null ? '' : String(raw).trim()
    if (field.type === 'number') return s === '' ? null : Number(s)
    if (s === '') return null
    return field.lowercase ? s.toLowerCase() : s
}

function buildPayload(config: TableConfig, formData: FormData) {
    const payload: Record<string, unknown> = {}
    const problems: string[] = []

    for (const field of config.fields) {
        if (field.type === 'display') continue

        const value = coerce(field, formData)
        if (typeof value === 'number' && Number.isNaN(value)) {
            problems.push(`${field.label} must be a number`)
            continue
        }
        if (field.required && value === null) {
            problems.push(`${field.label} is required`)
        }
        payload[field.name] = value

        if (field.type === 'image' && field.pathColumn) {
            const p = String(formData.get(field.pathColumn) ?? '').trim()
            payload[field.pathColumn] = p === '' ? null : p
        }
    }

    return { payload, problems }
}

function imageField(config: TableConfig) {
    return config.fields.find(f => f.type === 'image' && f.pathColumn && f.bucket)
}

export async function createRow(formData: FormData) {
    const { supabase, user } = await requireAdmin()
    const slug = String(formData.get('slug') ?? '')
    const config = getTable(slug)
    if (!config || !config.can.create) redirect('/')

    const { payload, problems } = buildPayload(config, formData)
    if (problems.length) {
        redirect(`/data/${slug}/new?error=${encodeURIComponent(problems.join('. '))}`)
    }
    if (config.createdByColumn) payload[config.createdByColumn] = user.id

    const { error } = await (supabase as any).from(config.table).insert(payload)
    if (error) {
        redirect(`/data/${slug}/new?error=${encodeURIComponent(error.message)}`)
    }

    revalidatePath(`/data/${slug}`)
    redirect(`/data/${slug}?created=1`)
}

export async function updateRow(formData: FormData) {
    const { supabase } = await requireAdmin()
    const slug = String(formData.get('slug') ?? '')
    const id = String(formData.get('id') ?? '')
    const config = getTable(slug)
    if (!config || !config.can.update || !id) redirect('/')

    const { payload, problems } = buildPayload(config, formData)
    if (problems.length) {
        redirect(`/data/${slug}/${id}?error=${encodeURIComponent(problems.join('. '))}`)
    }
    if (config.touchUpdatedAt) payload.updated_at = new Date().toISOString()

    const db = supabase as any
    const img = imageField(config)

    // Remember the old file so it can be removed if it was replaced
    let oldPath: string | null = null
    if (img?.pathColumn) {
        const { data: before } = await db.from(config.table).select(img.pathColumn).eq('id', id).single()
        oldPath = before?.[img.pathColumn] ?? null
    }

    const { data, error } = await db.from(config.table).update(payload).eq('id', id).select('id')
    if (error || !data?.length) {
        redirect(
            `/data/${slug}/${id}?error=${encodeURIComponent(
                error?.message ?? 'Update was blocked or the row no longer exists'
            )}`
        )
    }

    if (img?.pathColumn && img.bucket && oldPath && oldPath !== payload[img.pathColumn]) {
        await db.storage.from(img.bucket).remove([oldPath])
    }

    revalidatePath(`/data/${slug}`)
    redirect(`/data/${slug}?saved=1`)
}

export async function deleteRow(formData: FormData) {
    const { supabase } = await requireAdmin()
    const slug = String(formData.get('slug') ?? '')
    const id = String(formData.get('id') ?? '')
    const config = getTable(slug)
    if (!config || !config.can.delete || !id) redirect('/')

    const db = supabase as any
    const img = imageField(config)

    let oldPath: string | null = null
    if (img?.pathColumn) {
        const { data: before } = await db.from(config.table).select(img.pathColumn).eq('id', id).single()
        oldPath = before?.[img.pathColumn] ?? null
    }

    const { data, error } = await db.from(config.table).delete().eq('id', id).select('id')
    if (error || !data?.length) {
        redirect(
            `/data/${slug}?error=${encodeURIComponent(
                error?.message ?? 'Delete was blocked or the row no longer exists'
            )}`
        )
    }

    if (img?.bucket && oldPath) {
        await db.storage.from(img.bucket).remove([oldPath])
    }

    revalidatePath(`/data/${slug}`)
    redirect(`/data/${slug}?deleted=1`)
}