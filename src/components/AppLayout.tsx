import { useState, useEffect, type ReactNode } from 'react'
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
        to: '/templates',
        label: 'Templates',
        icon: (
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="4" rx="1" /><path d="M3 11h18M3 16h12" /></svg>
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
  '/templates': 'Templates',
  '/criar-campanha': 'Criar campanha',
  '/campanhas': 'Campanhas',
  '/radar': 'Radar de Conversões',
  '/integracoes': 'Integrações',
  '/configuracoes': 'Configurações',
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth()
  const location = useLocation()

  // ── Tema ──────────────────────────────────────────────────
  const [tema, setTema] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('cs-tema') as 'dark' | 'light') ?? 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema === 'light' ? 'light' : '')
    localStorage.setItem('cs-tema', tema)
  }, [tema])

  function toggleTema() {
    setTema((t) => t === 'dark' ? 'light' : 'dark')
  }
  const pageTitle = pageTitles[location.pathname] ?? 'WPP Campanhas'

  return (
    <div className="min-h-screen flex relative" style={{ background: 'var(--bg)' }}>
      <div className="ambient-glow" />

      {/* Sidebar */}
      <aside
        className="relative z-10 flex-shrink-0 flex flex-col"
        style={{
          width: 224,
          background: 'var(--glass-sidebar)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid var(--glass-border)',
          padding: '18px 10px 20px',
        }}
      >
        {/* Brand — símbolo C$ (vermelho da marca) + wordmark adaptativo */}
        <div style={{ padding: '6px 10px 18px', borderBottom: '1px solid var(--glass-border)', marginBottom: 6 }}>
          <div className="brand">
            <img src="/logo-cs-symbol.png" alt="" className="brand-symbol" draggable={false} />
            <img src="/logo-cs-wordmark.png" alt="Costurando Sucesso" className="brand-wordmark" draggable={false} />
          </div>
          <div className="t-eyebrow" style={{ marginTop: 12, paddingLeft: 1, letterSpacing: '.12em', fontSize: 10 }}>
            WPP Campanhas
          </div>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 flex flex-col" style={{ overflowY: 'auto' }}>
          {navSections.map((section) => (
            <div key={section.label} style={{ marginBottom: 4 }}>
              <div className="t-eyebrow" style={{ fontSize: 10, padding: '12px 10px 5px' }}>
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
                    gap: 9,
                    padding: '7px 10px',
                    borderRadius: 7,
                    fontSize: 13,
                    fontWeight: isActive ? 500 : 400,
                    marginBottom: 1,
                    textDecoration: 'none',
                    transition: 'background 0.15s, color 0.15s',
                    background: isActive ? 'var(--active)' : 'transparent',
                    color: isActive ? 'var(--text)' : 'var(--text-2)',
                    letterSpacing: '0.01em',
                  })}
                  className="nav-item-link"
                >
                  {({ isActive }) => (
                    <>
                      <span style={{ width: 15, height: 15, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg
                          viewBox="0 0 24 24"
                          width={14}
                          height={14}
                          fill="none"
                          stroke={isActive ? 'var(--red)' : 'currentColor'}
                          strokeWidth={isActive ? 1.8 : 1.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ opacity: isActive ? 1 : 0.7 }}
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

        {/* Rodapé da sidebar — marca sutil */}
        <div style={{
          borderTop: '1px solid var(--glass-border)',
          paddingTop: 14,
          marginTop: 8,
          paddingLeft: 10,
          paddingRight: 10,
        }}>
          <div className="t-muted" style={{ fontSize: 11, opacity: .7, marginBottom: 10 }}>
            costurandosucesso.com
          </div>
          <button
            onClick={() => signOut()}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-3)',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'Inter',
              padding: 0,
              letterSpacing: '0.02em',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-2)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-3)')}
          >
            Sair da conta
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        {/* Topbar sticky */}
        <header
          className="flex items-center justify-between sticky top-0 z-20"
          style={{
            padding: '16px 40px',
            borderBottom: '1px solid var(--glass-border)',
            background: 'var(--glass-header)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <div className="flex items-center gap-3">
            <h1 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              fontSize: 21,
              letterSpacing: '0.01em',
            }}>
              {pageTitle}
            </h1>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              color: 'var(--text-3)',
              fontWeight: 400,
              letterSpacing: '0.02em',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', opacity: 0.9 }} />
              Sincronizado há 2 min
            </span>
          </div>

          {/* Toggle de tema */}
          <button
            onClick={toggleTema}
            title={tema === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            style={{
              background: 'none',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: '5px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--text-3)',
              fontFamily: 'Inter',
              transition: 'border-color .15s, color .15s',
              marginLeft: 'auto',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--line-soft)'; e.currentTarget.style.color = 'var(--text-2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--text-3)' }}
          >
            {tema === 'dark' ? (
              <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
            {tema === 'dark' ? 'Claro' : 'Escuro'}
          </button>
        </header>

        {/* Page content */}
        <main style={{ padding: '28px 40px 72px', flex: 1, overflowY: 'auto', overflowX: 'visible' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
