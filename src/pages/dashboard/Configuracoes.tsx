import { useAuth } from '../../contexts/AuthContext'
import { useUsuarios } from '../../hooks/useUsuarios'

const rotuloPapel: Record<string, string> = {
  admin: 'Admin',
  sdr: 'SDR',
  gestor: 'Gestor de tráfego',
  marketing: 'Marketing',
  viewer: 'Visualização',
}

function iniciais(email: string): string {
  return email.slice(0, 2).toUpperCase()
}

export default function Configuracoes() {
  const { user, signOut } = useAuth()
  const { usuarios, loading, error } = useUsuarios()

  // Usuários fixos que sabemos que existem (vêm do user_roles + dados conhecidos)
  const usuariosExibidos = usuarios.length > 0
    ? usuarios
    : [
        { user_id: user?.id ?? '', email: user?.email ?? '', role: 'admin', created_at: new Date().toISOString() },
      ]

  // Enriquecer com nomes conhecidos
  const nomes: Record<string, { nome: string; email: string }> = {
    'rayena@costurandosucesso.com':  { nome: 'Rayena Koana',    email: 'rayena@costurandosucesso.com' },
    'mariana@costurandosucesso.com': { nome: 'Mariana Dalmaso', email: 'mariana@costurandosucesso.com' },
    'leirynecomercial@gmail.com':    { nome: 'Leiryne',         email: 'leirynecomercial@gmail.com' },
    'rkoana61@gmail.com':            { nome: 'Rayena Koana',    email: 'rayena@costurandosucesso.com' },
  }

  return (
    <div>
      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Usuários */}
        <div className="panel">
          <div className="config-section" style={{ marginBottom: 0 }}>
            <div className="config-title">Usuários</div>
            <div className="config-desc">Quem pode acessar o app e com qual papel.</div>

            {loading && <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Carregando...</p>}
            {error && <p style={{ fontSize: 13, color: '#f28c94' }}>Não foi possível carregar: {error}</p>}

            {!loading && !error && usuariosExibidos.map((u) => {
              const email = (u as any).email ?? user?.email ?? ''
              const info = nomes[email] ?? { nome: email, email }
              const ini = info.nome.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()
              return (
                <div key={u.user_id} className="user-row">
                  <span className="avatar">{ini || iniciais(email)}</span>
                  <div>
                    <div>{info.nome}</div>
                    <div className="row-sub">{info.email}</div>
                  </div>
                  <span className="role-tag">{rotuloPapel[u.role] ?? u.role}</span>
                </div>
              )
            })}

            <button className="btn" style={{ marginTop: 14 }}>+ Convidar usuário</button>
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
              <a
                style={{ color: 'var(--red)', fontSize: 12.5, cursor: 'pointer' }}
                onClick={() => signOut()}
              >
                Encerrar sessão
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
