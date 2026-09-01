import { useState, type FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useUsuarios } from '../../hooks/useUsuarios'
import { supabaseWpp } from '../../lib/supabase'

// ── Constantes ───────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://syecwttpsvrmhdvinjmt.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5ZWN3dHRwc3ZybWhkdmluam10Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzk1NDgxMywiZXhwIjoyMDk5NTMwODEzfQ.4q7pNim34eP-n38pANB9g7Lud-Y20TU4-VFA5f5WaGo'

const PAPEIS = [
  { value: 'admin',     label: 'Admin' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'sdr',       label: 'SDR' },
  { value: 'gestor',    label: 'Gestor de tráfego' },
  { value: 'viewer',    label: 'Visualização' },
]

const rotuloPapel: Record<string, string> = {
  admin:     'Admin',
  sdr:       'SDR',
  gestor:    'Gestor de tráfego',
  marketing: 'Marketing',
  viewer:    'Visualização',
}

function iniciais(nome: string): string {
  return nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

// ── Modal: Convidar usuário ──────────────────────────────────────────────────
interface ModalConviteProps {
  onClose: () => void
  onConvidado: () => void
}

function ModalConvite({ onClose, onConvidado }: ModalConviteProps) {
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState('marketing')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setErro('Informe o e-mail do usuário.'); return }
    setErro(null)
    setEnviando(true)

    try {
      // 1. Envia convite via Supabase Auth Admin API
      const res = await fetch(`${SUPABASE_URL}/auth/v1/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ email: email.trim() }),
      })

      const json = await res.json()

      if (!res.ok) {
        const msg = json.msg ?? json.message ?? json.error_description ?? JSON.stringify(json)
        // Se o usuário já existe, não é erro bloqueante — só insere o papel
        if (!msg.toLowerCase().includes('already')) {
          throw new Error(msg)
        }
      }

      // 2. Insere ou atualiza o papel em user_roles
      // O user_id vem do convite (json.id) ou precisamos buscar pelo email
      let userId: string | null = json.id ?? null

      if (!userId) {
        // Tenta buscar pelo email via Admin API
        const listRes = await fetch(
          `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email.trim())}`,
          {
            headers: {
              'apikey': SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            },
          }
        )
        const listJson = await listRes.json()
        userId = listJson.users?.[0]?.id ?? null
      }

      if (userId) {
        await supabaseWpp.from('user_roles').upsert(
          { user_id: userId, role: papel, email: email.trim() },
          { onConflict: 'user_id' }
        )
      }

      onConvidado()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar convite.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        className="panel"
        style={{ width: 440, maxWidth: '95vw', padding: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 19, letterSpacing: '0.01em' }}>
              Convidar usuário
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
              O usuário receberá um e-mail para criar a senha
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {erro && (
          <div style={{ padding: '10px 14px', background: 'rgba(232,25,44,0.1)', border: '1px solid rgba(232,25,44,0.3)', borderRadius: 8, fontSize: 13, color: '#f28c94', marginBottom: 16 }}>
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>E-mail</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@empresa.com"
              autoFocus
            />
          </div>

          <div className="field" style={{ marginBottom: 24 }}>
            <label>Papel no app</label>
            <select className="input" value={papel} onChange={(e) => setPapel(e.target.value)}>
              {PAPEIS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <div className="hint">
              {papel === 'admin' && 'Acesso total — pode convidar outros usuários e alterar configurações.'}
              {papel === 'marketing' && 'Pode criar e disparar campanhas e gerenciar segmentos.'}
              {papel === 'sdr' && 'Acesso à visualização de leads e campanhas atribuídas.'}
              {papel === 'gestor' && 'Acesso ao Radar de Conversões e relatórios de performance.'}
              {papel === 'viewer' && 'Somente leitura — não pode criar ou disparar campanhas.'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn primary" disabled={enviando}>
              {enviando ? 'Enviando convite...' : 'Enviar convite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Página Configurações ─────────────────────────────────────────────────────
export default function Configuracoes() {
  const { user, signOut } = useAuth()
  const { usuarios, loading, error } = useUsuarios()
  const [modalAberto, setModalAberto] = useState(false)
  const [sucesso, setSucesso] = useState<string | null>(null)

  function onConvidado() {
    setModalAberto(false)
    setSucesso('Convite enviado! O usuário receberá um e-mail para acessar o app.')
    setTimeout(() => setSucesso(null), 5000)
    setTimeout(() => window.location.reload(), 600)
  }

  // Sempre mostra o usuário logado, mesmo sem registro em user_roles
  const usuarioLogado = {
    user_id: user?.id ?? '',
    email: user?.email ?? '',
    role: 'admin',
    nome: user?.email ?? '',
  }

  // Combina: usuário logado + demais de user_roles (sem duplicar)
  const outrosUsuarios = usuarios.filter((u) => u.user_id !== user?.id)

  return (
    <>
      {modalAberto && (
        <ModalConvite
          onClose={() => setModalAberto(false)}
          onConvidado={onConvidado}
        />
      )}

      {sucesso && (
        <div style={{
          padding: '12px 16px', marginBottom: 16,
          background: 'rgba(61,190,123,0.1)', border: '1px solid rgba(61,190,123,0.3)',
          borderRadius: 10, fontSize: 13, color: '#8fe0b6', letterSpacing: '0.01em',
        }}>
          {sucesso}
        </div>
      )}

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Usuários */}
        <div className="panel">
          <div className="config-section" style={{ marginBottom: 0 }}>
            <div className="config-title">Usuários</div>
            <div className="config-desc">Quem pode acessar o app e com qual papel.</div>

            {loading && <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Carregando...</p>}
            {error && <p style={{ fontSize: 13, color: '#f28c94' }}>Erro: {error}</p>}

            {/* Usuário logado — sempre visível */}
            <div className="user-row">
              <span className="avatar" style={{ background: 'rgba(232,25,44,0.15)', color: 'var(--red)', border: '1px solid rgba(232,25,44,0.3)' }}>
                {iniciais(usuarioLogado.email)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>Você</div>
                <div className="row-sub">{usuarioLogado.email}</div>
              </div>
              <span className="role-tag" style={{ background: 'rgba(232,25,44,0.1)', color: 'var(--red)', border: '1px solid rgba(232,25,44,0.2)' }}>
                Admin
              </span>
            </div>

            {/* Outros usuários de user_roles */}
            {!loading && outrosUsuarios.map((u) => {
              const email = (u as any).email ?? ''
              const nome = email.split('@')[0] ?? email
              return (
                <div key={u.user_id} className="user-row">
                  <span className="avatar">{iniciais(nome)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{email || u.user_id.slice(0, 12) + '…'}</div>
                    <div className="row-sub">{rotuloPapel[u.role] ?? u.role}</div>
                  </div>
                  <span className="role-tag">{rotuloPapel[u.role] ?? u.role}</span>
                </div>
              )
            })}

            <button
              className="btn"
              style={{ marginTop: 16 }}
              onClick={() => setModalAberto(true)}
            >
              + Convidar usuário
            </button>
          </div>
        </div>

        {/* WhatsApp + Preferências */}
        <div className="panel">
          <div className="config-section">
            <div className="config-title">Número de WhatsApp</div>
            <div className="config-desc">Número conectado à Cloud API para os disparos.</div>
            <div className="health-row">
              <span>Número</span>
              <span className="num" style={{ fontWeight: 600 }}>+55 11 99774-1514</span>
            </div>
            <div className="health-row">
              <span>WABA ID</span>
              <span className="row-sub num">2130870377837125</span>
            </div>
            <div className="health-row">
              <span>Registro</span>
              <span className="status-txt st-ok">Ativo</span>
            </div>
          </div>

          <div className="config-section" style={{ marginBottom: 0 }}>
            <div className="config-title">Preferências</div>
            <div className="health-row">
              <span>Tema</span>
              <span style={{ color: 'var(--text-2)', fontSize: 12.5 }}>Escuro</span>
            </div>
            <div className="health-row">
              <span>Fuso horário</span>
              <span style={{ color: 'var(--text-2)', fontSize: 12.5 }}>America/Sao_Paulo</span>
            </div>
            <div className="health-row">
              <span>Sessão</span>
              <a style={{ color: 'var(--red)', fontSize: 12.5, cursor: 'pointer' }} onClick={() => signOut()}>
                Encerrar sessão
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
