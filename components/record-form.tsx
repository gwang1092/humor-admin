import Link from 'next/link'
import ImageUploadField from '@/components/image-upload-field'
import { createRow, updateRow } from '@/app/data/actions'
import type { Field, TableConfig } from '@/lib/admin-tables'

const inputClass =
    'mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-normal'

type Option = { id: string; label: string }

function FieldInput({
                        f,
                        values,
                        options,
                        displayValue,
                    }: {
    f: Field
    values: Record<string, any>
    options: Option[]
    displayValue?: string
}) {
    const value = values[f.name]

    switch (f.type) {
        case 'textarea':
            return (
                <textarea
                    name={f.name}
                    defaultValue={value ?? ''}
                    rows={4}
                    required={f.required}
                    className={inputClass}
                />
            )
        case 'number':
            return (
                <input
                    type="number"
                    step="1"
                    name={f.name}
                    defaultValue={value ?? ''}
                    required={f.required}
                    className={inputClass}
                />
            )
        case 'boolean':
            return (
                <input
                    type="checkbox"
                    name={f.name}
                    defaultChecked={value ?? true}
                    className="mt-2 block h-4 w-4"
                />
            )
        case 'select':
            return (
                <select
                    name={f.name}
                    defaultValue={value ?? ''}
                    required={f.required}
                    className={inputClass}
                >
                    {f.required ? (
                        <option value="" disabled>
                            Choose one
                        </option>
                    ) : (
                        <option value="">None</option>
                    )}
                    {options.map(o => (
                        <option key={o.id} value={o.id}>
                            {o.label}
                        </option>
                    ))}
                </select>
            )
        case 'image':
            return (
                <ImageUploadField
                    name={f.name}
                    pathName={f.pathColumn}
                    bucket={f.bucket ?? 'images'}
                    defaultUrl={value ?? ''}
                    defaultPath={f.pathColumn ? (values[f.pathColumn] ?? '') : ''}
                    required={f.required}
                />
            )
        case 'display':
            return (
                <p className="mt-1 rounded bg-zinc-100 px-3 py-2 text-sm font-normal">
                    {displayValue || '—'}
                </p>
            )
        default:
            return (
                <input
                    name={f.name}
                    defaultValue={value ?? ''}
                    required={f.required}
                    className={inputClass}
                />
            )
    }
}

export default function RecordForm({
                                       config,
                                       mode,
                                       values = {},
                                       options = {},
                                       displayValues = {},
                                       id,
                                   }: {
    config: TableConfig
    mode: 'create' | 'update'
    values?: Record<string, any>
    options?: Record<string, Option[]>
    displayValues?: Record<string, string>
    id?: string
}) {
    return (
        <form
            action={mode === 'create' ? createRow : updateRow}
            className="flex max-w-xl flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
            <input type="hidden" name="slug" value={config.slug} />
            {id && <input type="hidden" name="id" value={id} />}

            {config.fields.map(f => (
                <div key={f.name} className="text-sm font-semibold">
          <span>
            {f.label}
              {f.required && <span className="text-red-600"> *</span>}
          </span>
                    <FieldInput
                        f={f}
                        values={values}
                        options={options[f.name] ?? []}
                        displayValue={displayValues[f.name]}
                    />
                    {f.help && <span className="mt-1 block text-xs font-normal text-zinc-500">{f.help}</span>}
                </div>
            ))}

            <div className="flex gap-3">
                <button className="rounded-lg bg-[#0B2545] px-4 py-2 font-semibold text-white hover:bg-[#143a6b]">
                    {mode === 'create' ? 'Create' : 'Save changes'}
                </button>
                <Link
                    href={`/data/${config.slug}`}
                    className="rounded-lg border border-zinc-300 px-4 py-2 font-semibold hover:bg-zinc-200"
                >
                    Cancel
                </Link>
            </div>
        </form>
    )
}