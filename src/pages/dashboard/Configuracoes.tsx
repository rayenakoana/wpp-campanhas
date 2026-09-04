import { useState, type FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useUsuarios, type UsuarioComPapel } from '../../hooks/useUsuarios'
import { supabaseWpp } from '../../lib/supabase'

const SUPABASE_URL = 'https://syecwttpsvrmhdvinjmt.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5ZWN3dHRwc3ZybWhkdmluam10Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzk1NDgxMywiZXhwIjoyMDk5NTMwODEzfQ.4q7pNim34eP-n38pANB9g7Lud-Y20TU4-VFA5f5WaGo'

const PAPEIS = [
  { value: 'admin',     label: 'Admin',              desc: 'Acesso total — pode convidar e alterar configurações.' },
  { value: 'marketing', label: 'Marketing',           desc: 'Pode criar e disparar campanhas e gerenciar segmentos.' },
  { value: 'sdr',       label: 'SDR',                desc: 'Acesso à visualização de leads e campanhas atribuídas.' },
  { value: 'gestor',    label: 'Gestor de tráfego',  desc: 'Acesso ao Radar de Conversões e relatórios.' },
  { value: 'viewer',    label: 'Visualização',        desc: 'Somente leitura — não pode criar ou disparar campanhas.' },
]

const rotuloPapel: Record<string, string> = {
  admin: 'Admin', sdr: 'SDR', gestor: 'Gestor de tráfego', marketing: 'Marketing', viewer: 'Visualização',
}

function iniciais(str: string): string {
  return str.split(/[@\s]/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

// ── Ícone lápis ──────────────────────────────────────────────────────────────
function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

// ── Modal: Convidar usuário ──────────────────────────────────────────────────
function ModalConvite({ onClose, onConvidado }: { onClose: () => void; onConvidado: () => void }) {
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState('marketing')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setErro('Informe o e-mail.'); return }
    setErro(null); setEnviando(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ email: email.trim(), redirect_to: 'https://wppcampanhas.costurandosucesso.com/redefinir-senha' }),
      })
      const json = await res.json()
      if (!res.ok) {
        const msg = json.msg ?? json.message ?? json.error_description ?? JSON.stringify(json)
        if (!msg.toLowerCase().includes('already')) throw new Error(msg)
      }
      let userId: string | null = json.id ?? null
      if (!userId) {
        const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email.trim())}`, {
          headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
        })
        const listJson = await listRes.json()
        userId = listJson.users?.[0]?.id ?? null
      }
      if (userId) {
        await supabaseWpp.from('user_roles').upsert({ user_id: userId, role: papel, email: email.trim() }, { onConflict: 'user_id' })
      }
      onConvidado()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar convite.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <ModalBase titulo="Convidar usuário" subtitulo="O usuário receberá um e-mail para criar a senha" onClose={onClose}>
      {erro && <MsgErro>{erro}</MsgErro>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>E-mail</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@empresa.com" autoFocus />
        </div>
        <SeletorPapel papel={papel} onChange={setPapel} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={enviando}>{enviando ? 'Enviando...' : 'Enviar convite'}</button>
        </div>
      </form>
    </ModalBase>
  )
}

// ── Modal: Editar usuário ────────────────────────────────────────────────────
function ModalEditar({ usuario, onClose, onSalvo }: { usuario: UsuarioComPapel & { email?: string }; onClose: () => void; onSalvo: () => void }) {
  const [papel, setPapel] = useState(usuario.role)
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState(false)
  const [confirmarRemover, setConfirmarRemover] = useState(false)
  const [reenviando, setReenviando] = useState(false)
  const [sucessoReenvio, setSucessoReenvio] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function reenviarConvite() {
    const email = (usuario as any).email ?? ''
    if (!email) { setErro('E-mail do usuário não encontrado.'); return }
    setReenviando(true); setErro(null); setSucessoReenvio(false)
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ email, redirect_to: 'https://wppcampanhas.costurandosucesso.com/redefinir-senha' }),
      })
      const json = await res.json()
      if (!res.ok) {
        const msg = json.msg ?? json.message ?? json.error_description ?? JSON.stringify(json)
        throw new Error(msg)
      }
      setSucessoReenvio(true)
      setTimeout(() => setSucessoReenvio(false), 4000)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao reenviar convite.')
    } finally {
      setReenviando(false)
    }
  }

  async function handleSalvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro(null)
    try {
      const { error } = await supabaseWpp
        .from('user_roles')
        .update({ role: papel })
        .eq('user_id', usuario.user_id)
      if (error) throw error
      onSalvo()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleRemover() {
    setRemovendo(true); setErro(null)
    try {
      const { error } = await supabaseWpp
        .from('user_roles')
        .delete()
        .eq('user_id', usuario.user_id)
      if (error) throw error
      onSalvo()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao remover acesso.')
      setRemovendo(false)
    }
  }

  const email = (usuario as any).email ?? ''

  return (
    <ModalBase titulo="Editar usuário" subtitulo={email} onClose={onClose}>
      {erro && <MsgErro>{erro}</MsgErro>}

      {confirmarRemover ? (
        <div>
          <div style={{ fontSize: 13.5, color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.6 }}>
            Tem certeza que deseja remover o acesso de <b>{email}</b>? O usuário não conseguirá mais acessar o app.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setConfirmarRemover(false)}>Cancelar</button>
            <button
              className="btn"
              style={{ background: 'rgba(232,25,44,0.15)', borderColor: 'rgba(232,25,44,0.3)', color: 'var(--red)' }}
              disabled={removendo}
              onClick={handleRemover}
            >
              {removendo ? 'Removendo...' : 'Confirmar remoção'}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSalvar}>
          <SeletorPapel papel={papel} onChange={setPapel} />

          {sucessoReenvio && (
            <div style={{ padding: '9px 13px', background: 'rgba(61,190,123,0.1)', border: '1px solid rgba(61,190,123,0.3)', borderRadius: 8, fontSize: 12.5, color: 'var(--green)', marginBottom: 14, letterSpacing: '0.01em' }}>
              Convite reenviado com sucesso!
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Inter', padding: 0, letterSpacing: '0.01em', transition: 'color 0.15s' }}
                disabled={reenviando}
                onClick={reenviarConvite}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-3)')}
              >
                {reenviando ? 'Reenviando...' : 'Reenviar convite'}
              </button>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'Inter', padding: 0, letterSpacing: '0.01em' }}
                onClick={() => setConfirmarRemover(true)}
              >
                Remover acesso
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn primary" disabled={salvando || papel === usuario.role}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </form>
      )}
    </ModalBase>
  )
}

// ── Componentes utilitários ──────────────────────────────────────────────────
function ModalBase({ titulo, subtitulo, onClose, children }: { titulo: string; subtitulo?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div className="panel" style={{ width: 440, maxWidth: '95vw', padding: 28 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 19, letterSpacing: '0.01em' }}>{titulo}</div>
            {subtitulo && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{subtitulo}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function MsgErro({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '10px 14px', background: 'rgba(232,25,44,0.1)', border: '1px solid rgba(232,25,44,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>
      {children}
    </div>
  )
}

function SeletorPapel({ papel, onChange }: { papel: string; onChange: (v: string) => void }) {
  const papelInfo = PAPEIS.find((p) => p.value === papel)
  return (
    <div className="field" style={{ marginBottom: 20 }}>
      <label>Papel no app</label>
      <select className="input" value={papel} onChange={(e) => onChange(e.target.value)}>
        {PAPEIS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>
      {papelInfo && <div className="hint">{papelInfo.desc}</div>}
    </div>
  )
}

// ── Página Configurações ─────────────────────────────────────────────────────
export default function Configuracoes() {
  const { user, signOut } = useAuth()
  const { usuarios, loading, error } = useUsuarios()
  const [modal, setModal] = useState<'convite' | 'editar' | null>(null)
  const [usuarioEditando, setUsuarioEditando] = useState<(UsuarioComPapel & { email?: string }) | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  function onConvidado() {
    setModal(null)
    setSucesso('Convite enviado! O usuário receberá um e-mail para acessar o app.')
    setTimeout(() => setSucesso(null), 5000)
    setTimeout(() => window.location.reload(), 600)
  }

  function onSalvo() {
    setModal(null); setUsuarioEditando(null)
    setSucesso('Alterações salvas com sucesso.')
    setTimeout(() => setSucesso(null), 4000)
    setTimeout(() => window.location.reload(), 600)
  }

  function abrirEditar(u: UsuarioComPapel & { email?: string }) {
    setUsuarioEditando(u)
    setModal('editar')
  }

  const outrosUsuarios = usuarios.filter((u) => u.user_id !== user?.id)

  return (
    <>
      {modal === 'convite' && <ModalConvite onClose={() => setModal(null)} onConvidado={onConvidado} />}
      {modal === 'editar' && usuarioEditando && (
        <ModalEditar usuario={usuarioEditando} onClose={() => { setModal(null); setUsuarioEditando(null) }} onSalvo={onSalvo} />
      )}

      {sucesso && (
        <div style={{ padding: '12px 16px', marginBottom: 16, background: 'rgba(61,190,123,0.1)', border: '1px solid rgba(61,190,123,0.3)', borderRadius: 10, fontSize: 13, color: 'var(--green)', letterSpacing: '0.01em' }}>
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
            {error && <p style={{ fontSize: 13, color: 'var(--danger)' }}>Erro: {error}</p>}

            {/* Usuário logado */}
            <div className="user-row">
              <span className="avatar" style={{ background: 'rgba(232,25,44,0.15)', color: 'var(--red)', border: '1px solid rgba(232,25,44,0.2)', flexShrink: 0 }}>
                {iniciais(user?.email ?? 'R')}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>Você</div>
                <div className="row-sub">{user?.email}</div>
              </div>
              <span className="role-tag" style={{ background: 'rgba(232,25,44,0.1)', color: 'var(--red)', border: '1px solid rgba(232,25,44,0.2)' }}>Admin</span>
            </div>

            {/* Outros usuários */}
            {!loading && outrosUsuarios.map((u) => {
              const email = (u as any).email ?? ''
              return (
                <div key={u.user_id} className="user-row" style={{ gap: 10 }}>
                  <span className="avatar" style={{ flexShrink: 0 }}>{iniciais(email)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {email || u.user_id.slice(0, 12) + '…'}
                    </div>
                    <div className="row-sub">{rotuloPapel[u.role] ?? u.role}</div>
                  </div>
                  <span className="role-tag">{rotuloPapel[u.role] ?? u.role}</span>
                  {/* Botão editar */}
                  <button
                    onClick={() => abrirEditar(u as any)}
                    title="Editar acesso"
                    style={{
                      background: 'none', border: '1px solid var(--line)', borderRadius: 6,
                      color: 'var(--text-3)', padding: '5px 7px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', flexShrink: 0,
                      transition: 'color 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = '#3a3a4c' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'var(--line)' }}
                  >
                    <IconEdit />
                  </button>
                </div>
              )
            })}

            <button className="btn" style={{ marginTop: 16 }} onClick={() => setModal('convite')}>
              + Convidar usuário
            </button>
          </div>
        </div>

        {/* WhatsApp + Preferências */}
        <div className="panel">
          <div className="config-section">
            <div className="config-title">Número de WhatsApp</div>
            <div className="config-desc">Número conectado à Cloud API para os disparos.</div>
            <div className="health-row"><span>Número</span><span className="num" style={{ fontWeight: 600 }}>+55 11 99774-1514</span></div>
            <div className="health-row"><span>WABA ID</span><span className="row-sub num">2130870377837125</span></div>
            <div className="health-row"><span>Registro</span><span className="status-txt st-ok">Ativo</span></div>
          </div>
          <div className="config-section" style={{ marginBottom: 0 }}>
            <div className="config-title">Preferências</div>
            <div className="health-row"><span>Tema</span><span style={{ color: 'var(--text-2)', fontSize: 12.5 }}>Escuro</span></div>
            <div className="health-row"><span>Fuso horário</span><span style={{ color: 'var(--text-2)', fontSize: 12.5 }}>America/Sao_Paulo</span></div>
            <div className="health-row">
              <span>Sessão</span>
              <a style={{ color: 'var(--red)', fontSize: 12.5, cursor: 'pointer' }} onClick={() => signOut()}>Encerrar sessão</a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
