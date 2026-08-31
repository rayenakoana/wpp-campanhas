import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
}

const navItems: NavItem[] = [
  {
    to: '/',
    label: 'Desempenho',
    icon: (
      <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>
    ),
  },
  {
    to: '/segmentos',
    label: 'Segmentos e leads',
    icon: (
      <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.8-3 3-4.5 5.5-4.5S13.7 16 14.5 19" /><path d="M16 8h5M16 12h5M16 16h3" /></svg>
    ),
  },
  {
    to: '/criar-campanha',
    label: 'Criar campanha',
    icon: (
      <svg viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
    ),
  },
  {
    to: '/campanhas',
    label: 'Campanhas',
    icon: <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" /></svg>,
  },
  {
    to: '/radar',
    label: 'Radar de Conversões',
    icon: (
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>
    ),
  },
  {
    to: '/integracoes',
    label: 'Integrações',
    icon: (
      <svg viewBox="0 0 24 24"><path d="M8 3v4M16 3v4M8 17v4M16 17v4M3 8h4M3 16h4M17 8h4M17 16h4" /><rect x="8" y="8" width="8" height="8" rx="1" /></svg>
    ),
  },
  {
    to: '/configuracoes',
    label: 'Configurações',
    icon: (
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></svg>
    ),
  },
]

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen flex relative">
      <div className="ambient-glow" />

      <aside className="relative z-10 w-[220px] flex-shrink-0 bg-[rgba(14,14,21,0.72)] backdrop-blur-xl border-r border-white/5 px-3 py-5 flex flex-col">
        <div className="flex items-center gap-2.5 px-2 mb-6 font-display font-semibold text-[15px]">
          <span className="w-[22px] h-[22px] rounded-md bg-[var(--color-red-bright)] flex items-center justify-center text-[11px] font-extrabold text-white">
            W
          </span>
          WPP Campanhas
        </div>

        <nav className="flex-1 flex flex-col gap-px">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] font-medium transition-colors [&_svg]:w-[15px] [&_svg]:h-[15px] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.6] ${
                  isActive
                    ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] [&_svg]:stroke-[var(--color-red-bright)]'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-2.5 pt-3 border-t border-white/5 mt-3">
          <p className="text-[11.5px] text-[var(--color-text-muted)] truncate mb-2">{user?.email}</p>
          <button
            onClick={() => signOut()}
            className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Sair
          </button>
        </div>
      </aside>

      <main className="relative z-10 flex-1 min-w-0 p-8 overflow-y-auto">{children}</main>
    </div>
  )
}
