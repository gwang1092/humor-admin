import Link from 'next/link'
import LogoutButton from '@/components/logout-button'

const links = [
    { href: '/', label: 'Dashboard', key: 'dashboard' },
    { href: '/users', label: 'Users', key: 'users' },
    { href: '/media', label: 'Media', key: 'media' },
    { href: '/votes', label: 'Votes', key: 'votes' },
]

export default function AdminShell({
                                       active,
                                       name,
                                       children,
                                   }: {
    active: string
    name: string
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-zinc-100 text-zinc-900">
            <header className="bg-[#0B2545] text-white">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-3">
                    <p className="text-lg font-bold">🦁 Alma Memer · Admin</p>

                    <nav className="flex items-center gap-1 text-sm font-semibold">
                        {links.map(l => (
                            <Link
                                key={l.key}
                                href={l.href}
                                className={`rounded px-3 py-1.5 ${
                                    active === l.key ? 'bg-[#B9D9EB] text-[#0B2545]' : 'hover:bg-white/10'
                                }`}
                            >
                                {l.label}
                            </Link>
                        ))}
                    </nav>

                    <div className="flex items-center gap-3 text-xs">
                        <span>{name}</span>
                        <LogoutButton className="rounded border border-white/40 px-3 py-1.5 hover:bg-white/10" />
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </div>
    )
}