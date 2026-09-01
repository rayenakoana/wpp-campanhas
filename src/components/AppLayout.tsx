import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const navSections = [
  {
    label: 'VISÃO GERAL',
    items: [
      {
        to: '/',
        label: 'Desempenho',
        icon: (
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>
        ),
      },
    ],
  },
  {
    label: 'CAMPANHAS',
    items: [
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
    ],
  },
  {
    label: 'INTELIGÊNCIA',
    items: [
      {
        to: '/radar',
        label: 'Radar de Conversões',
        icon: (
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>
        ),
      },
    ],
  },
  {
    label: 'SISTEMA',
    items: [
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
    ],
  },
]

const pageTitles: Record<string, string> = {
  '/': 'Desempenho',
  '/segmentos': 'Segmentos e leads',
  '/criar-campanha': 'Criar campanha',
  '/campanhas': 'Campanhas',
  '/radar': 'Radar de Conversões',
  '/integracoes': 'Integrações',
  '/configuracoes': 'Configurações',
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth()
  const location = useLocation()
  const pageTitle = pageTitles[location.pathname] ?? 'WPP Campanhas'

  return (
    <div className="min-h-screen flex relative" style={{ background: 'var(--bg)' }}>
      <div className="ambient-glow" />

      {/* Sidebar */}
      <aside
        className="relative z-10 flex-shrink-0 flex flex-col py-5"
        style={{
          width: 220,
          background: 'rgba(14,14,21,0.72)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          padding: '20px 12px',
        }}
      >
        {/* Brand */}
        <div
          className="flex items-center gap-2.5 px-2.5 mb-6"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 17 }}
        >
          <img
            src="/logo-cs.png"
            alt="CS"
            style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover' }}
          />
          WPP Campanhas
        </div>

        {/* Nav sections */}
        <nav className="flex-1 flex flex-col">
          {navSections.map((section) => (
            <div key={section.label}>
              <div
                className="px-2.5"
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  color: 'var(--text-3)',
                  padding: '14px 10px 6px',
                  fontWeight: 600,
                }}
              >
                {section.label}
              </div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 7,
                    fontSize: 13.5,
                    fontWeight: 500,
                    marginBottom: 1,
                    textDecoration: 'none',
                    transition: 'background 0.15s, color 0.15s',
                    background: isActive ? 'var(--surface-2)' : 'transparent',
                    color: isActive ? 'var(--text)' : 'var(--text-2)',
                  })}
                  className="nav-item-link"
                >
                  {({ isActive }) => (
                    <>
                      <span
                        style={{
                          width: 15,
                          height: 15,
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width={15}
                          height={15}
                          fill="none"
                          stroke={isActive ? 'var(--red)' : 'currentColor'}
                          strokeWidth={1.6}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          {item.icon.props.children}
                        </svg>
                      </span>
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main area */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        {/* Topbar sticky */}
        <header
          className="flex items-center justify-between sticky top-0 z-20"
          style={{
            padding: '18px 40px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(14,14,21,0.55)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <div className="flex items-center">
            <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 22 }}>
              {pageTitle}
            </h1>
            <span
              className="flex items-center gap-1.5 ml-3.5"
              style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--green)',
                  display: 'inline-block',
                }}
              />
              Sincronizado há 2 min
            </span>
          </div>

          <button
            onClick={() => signOut()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.09)',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 500,
              padding: '8px 13px',
              borderRadius: 9,
              cursor: 'pointer',
              fontFamily: 'Inter',
            }}
          >
            Sair
          </button>
        </header>

        {/* Page content */}
        <main style={{ padding: '28px 40px 72px', flex: 1, overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
