import { useAuth } from '../../contexts/AuthContext'
import { useUsuarios } from '../../hooks/useUsuarios'

const rotuloPapel: Record<string, string> = {
  admin: 'Administrador',
  sdr: 'SDR',
  gestor: 'Gestor de tráfego',
  viewer: 'Visualização',
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Configuracoes() {
  const { user } = useAuth()
  const { usuarios, loading, error } = useUsuarios()

  return (
    <div>
      <h1 className="font-display font-semibold text-2xl mb-1">Configurações</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">
        Configurações gerais do WPP Campanhas, incluindo SDRs e permissões.
      </p>

      <div className="glass-card p-5 mb-5">
        <h2 className="font-display font-semibold text-lg mb-3">Sua conta</h2>
        <p className="text-sm text-[var(--color-text-muted)]">{user?.email}</p>
      </div>

      <div className="glass-card p-5">
        <h2 className="font-display font-semibold text-lg mb-4">Usuários e permissões</h2>

        {loading && <p className="text-sm text-[var(--color-text-muted)]">Carregando...</p>}

        {error && <p className="text-sm text-[#f28c94]">Não foi possível carregar: {error}</p>}

        {!loading && !error && usuarios.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)]">
            Nenhum papel configurado ainda na tabela user_roles.
          </p>
        )}

        {!loading && !error && usuarios.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--color-text-muted)] text-xs border-b border-white/5">
                <th className="px-3 py-2 font-medium">Usuário (ID)</th>
                <th className="px-3 py-2 font-medium">Papel</th>
                <th className="px-3 py-2 font-medium">Desde</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.user_id} className="border-b border-white/5 last:border-0">
                  <td className="px-3 py-2 font-mono text-xs text-[var(--color-text-muted)]">
                    {u.user_id === user?.id ? 'Você' : u.user_id.slice(0, 8) + '...'}
                  </td>
                  <td className="px-3 py-2 font-medium">{rotuloPapel[u.role] ?? u.role}</td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">{formatarData(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
