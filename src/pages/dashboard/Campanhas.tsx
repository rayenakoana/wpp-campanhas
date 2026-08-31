import { useMemo, useState } from 'react'
import { useCampanhas } from '../../hooks/useCampanhas'

const rotuloStatus: Record<string, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  running: 'Em andamento',
  completed: 'Concluída',
  failed: 'Falhou',
  paused: 'Pausada',
}

const corStatus: Record<string, string> = {
  draft: 'bg-white/10 text-[var(--color-text-muted)]',
  scheduled: 'bg-[rgba(201,160,23,0.15)] text-[var(--color-gold)]',
  running: 'bg-[rgba(61,190,123,0.15)] text-[#3DBE7B]',
  completed: 'bg-[rgba(61,190,123,0.15)] text-[#3DBE7B]',
  failed: 'bg-[rgba(232,25,44,0.15)] text-[#f28c94]',
  paused: 'bg-white/10 text-[var(--color-text-muted)]',
}

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function Campanhas() {
  const { campanhas, loading, error } = useCampanhas()
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [busca, setBusca] = useState('')

  const statusDisponiveis = useMemo(() => {
    const set = new Set(campanhas.map((c) => c.status))
    return Array.from(set)
  }, [campanhas])

  const campanhasFiltradas = useMemo(() => {
    return campanhas.filter((c) => {
      const passaStatus = filtroStatus === 'todos' || c.status === filtroStatus
      const passaBusca = c.name.toLowerCase().includes(busca.toLowerCase())
      return passaStatus && passaBusca
    })
  }, [campanhas, filtroStatus, busca])

  return (
    <div>
      <h1 className="font-display font-semibold text-2xl mb-1">Campanhas</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">
        Todas as campanhas criadas, com status de disparo e entrega.
      </p>

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="px-3.5 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-[var(--color-text-primary)] outline-none focus:border-[var(--color-red-bright)] min-w-[220px]"
        />
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="px-3.5 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-[var(--color-text-primary)] outline-none focus:border-[var(--color-red-bright)]"
        >
          <option value="todos">Todos os status</option>
          {statusDisponiveis.map((s) => (
            <option key={s} value={s}>
              {rotuloStatus[s] ?? s}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="glass-card p-6 text-sm text-[var(--color-text-muted)]">Carregando campanhas...</div>
      )}

      {error && (
        <div className="glass-card p-6 text-sm text-[#f28c94] border-[rgba(232,25,44,0.3)]">
          Não foi possível carregar as campanhas: {error}
        </div>
      )}

      {!loading && !error && campanhasFiltradas.length === 0 && (
        <div className="glass-card p-6 text-sm text-[var(--color-text-muted)]">
          Nenhuma campanha encontrada com esse filtro.
        </div>
      )}

      {!loading && !error && campanhasFiltradas.length > 0 && (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--color-text-muted)] text-xs border-b border-white/5">
                <th className="px-4 py-3 font-medium">Campanha</th>
                <th className="px-4 py-3 font-medium">Template</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Envios</th>
                <th className="px-4 py-3 font-medium text-right">Entregues</th>
                <th className="px-4 py-3 font-medium text-right">Lidos</th>
                <th className="px-4 py-3 font-medium text-right">Falhas</th>
                <th className="px-4 py-3 font-medium text-right">Custo</th>
                <th className="px-4 py-3 font-medium">Concluída em</th>
              </tr>
            </thead>
            <tbody>
              {campanhasFiltradas.map((c) => (
                <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium">
                    {c.name}
                    {c.ab_test_enabled && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-[rgba(201,160,23,0.15)] text-[var(--color-gold)]">
                        A/B
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{c.template_nome ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-md font-medium ${corStatus[c.status] ?? 'bg-white/10 text-[var(--color-text-muted)]'}`}>
                      {rotuloStatus[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{c.total_envios}</td>
                  <td className="px-4 py-3 text-right">{c.entregues}</td>
                  <td className="px-4 py-3 text-right">{c.lidos}</td>
                  <td className="px-4 py-3 text-right">{c.falhas > 0 ? c.falhas : '—'}</td>
                  <td className="px-4 py-3 text-right">{formatarMoeda(c.custo_total)}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{formatarData(c.completed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
