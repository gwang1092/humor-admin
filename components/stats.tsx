export function StatCard({
                             label,
                             value,
                             note,
                         }: {
    label: string
    value: string | number
    note?: string
}) {
    return (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-3xl font-bold text-[#0B2545]">{value}</p>
            {note && <p className="mt-1 text-xs text-zinc-500">{note}</p>}
        </div>
    )
}

export function Panel({
                          title,
                          subtitle,
                          children,
                      }: {
    title: string
    subtitle?: string
    children: React.ReactNode
}) {
    return (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[#0B2545]">{title}</h2>
            {subtitle && <p className="mb-4 text-xs text-zinc-500">{subtitle}</p>}
            {!subtitle && <div className="mb-4" />}
            {children}
        </section>
    )
}

export function BarList({
                            items,
                            empty = 'Nothing to show yet.',
                        }: {
    items: { label: string; value: number; note?: string }[]
    empty?: string
}) {
    if (!items.length) return <p className="text-sm text-zinc-500">{empty}</p>

    const max = Math.max(1, ...items.map(i => i.value))

    return (
        <ul className="flex flex-col gap-3">
            {items.map(item => (
                <li key={item.label}>
                    <div className="flex justify-between gap-2 text-sm">
                        <span className="font-medium">{item.label}</span>
                        <span className="text-zinc-500">
              {item.note ? `${item.note} · ` : ''}
                            {item.value}
            </span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded bg-zinc-200">
                        <div
                            className="h-2 rounded"
                            style={{ width: `${(item.value / max) * 100}%`, background: '#0B2545' }}
                        />
                    </div>
                </li>
            ))}
        </ul>
    )
}

export function Histogram({
                              data,
                              color = '#0B2545',
                          }: {
    data: { label: string; value: number }[]
    color?: string
}) {
    const max = Math.max(1, ...data.map(d => d.value))

    return (
        <div className="flex items-end gap-1" style={{ height: 150 }}>
            {data.map((d, i) => {
                const h = Math.round((d.value / max) * 110)
                return (
                    <div
                        key={i}
                        className="flex flex-1 flex-col items-center justify-end"
                        title={`${d.label}: ${d.value}`}
                    >
                        <span className="text-[10px] text-zinc-500">{d.value || ''}</span>
                        <div
                            className="w-full rounded-t"
                            style={{ height: d.value > 0 ? Math.max(h, 4) : 1, background: color }}
                        />
                        <span className="mt-1 h-3 text-[10px] text-zinc-500">{d.label}</span>
                    </div>
                )
            })}
        </div>
    )
}

export function CaptionRow({
                               imageUrl,
                               caption,
                               up,
                               down,
                           }: {
    imageUrl: string
    caption: string
    up: number
    down: number
}) {
    return (
        <div className="flex gap-3">
            <img src={imageUrl} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
            <div className="min-w-0">
                <p className="text-sm font-medium leading-snug">{caption}</p>
                <p className="text-xs text-zinc-500">
                    👍 {up} · 👎 {down}
                </p>
            </div>
        </div>
    )
}