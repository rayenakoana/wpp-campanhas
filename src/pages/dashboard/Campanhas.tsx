import { useMemo, useState } from 'react'
import { useCampanhas } from '../../hooks/useCampanhas'

const rotuloStatus: Record<string, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  running: 'Em andamento',
  completed: 'Concluída',
  firing: 'Em andamento',
  failed: 'Falhou',
  paused: 'Pausada',
}

const statusDot: Record<string, string> = {
  draft: 'st-neutral',
  scheduled: 'st-neutral',
  running: 'st-warn',
  firing: 'st-warn',
  completed: 'st-ok',
  failed: 'st-fail',
  paused: 'st-neutral',
}

const abas = [
  { key: 'todos',    label: 'Todas' },
  { key: 'running',  label: 'Em andamento' },
  { key: 'scheduled',label: 'Agendadas' },
  { key: 'completed',label: 'Concluídas' },
]

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function Campanhas() {
  const { campanhas, loading, error } = useCampanhas()
  const [abaAtiva, setAbaAtiva] = useState('todos')

  const campanhasFiltradas = useMemo(() => {
    if (abaAtiva === 'todos') return campanhas
    return campanhas.filter((c) => c.status === abaAtiva || (abaAtiva === 'running' && c.status === 'firing'))
  }, [campanhas, abaAtiva])

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {abas.map((a) => (
            <button
              key={a.key}
              className={`tab ${abaAtiva === a.key ? 'active' : ''}`}
              onClick={() => setAbaAtiva(a.key)}
            >
              {a.label}
            </button>
          ))}
        </div>
        <button className="btn primary">+ Nova campanha</button>
      </div>

      {loading && (
        <div className="panel" style={{ padding: 24, fontSize: 13, color: 'var(--text-2)' }}>
          Carregando campanhas...
        </div>
      )}

      {error && (
        <div className="panel" style={{ padding: 24, fontSize: 13, color: '#f28c94' }}>
          Não foi possível carregar as campanhas: {error}
        </div>
      )}

      {!loading && !error && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Campanha</th>
              <th>Status</th>
              <th className="r">Leads</th>
              <th className="r">Enviadas</th>
              <th className="r">Entregues</th>
              <th className="r">Lidas</th>
              <th className="r">Custo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {campanhasFiltradas.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32, fontSize: 13 }}>
                  Nenhuma campanha encontrada.
                </td>
              </tr>
            )}
            {campanhasFiltradas.map((c) => (
              <tr key={c.id} className="rowlink">
                <td>
                  <div className="row-title">{c.name}</div>
                  <div className="row-sub">
                    {c.status === 'scheduled' && c.scheduled_at
                      ? `Agendada · ${formatarData(c.scheduled_at)}`
                      : formatarData(c.completed_at)}
                  </div>
                </td>
                <td>
                  <span className={`status-txt ${statusDot[c.status] ?? 'st-neutral'}`}>
                    {rotuloStatus[c.status] ?? c.status}
                  </span>
                </td>
                <td className="r cell-num num">
                  {c.total_envios > 0 ? c.total_envios.toLocaleString('pt-BR') : '—'}
                </td>
                <td className="r num">{c.total_envios > 0 ? c.total_envios.toLocaleString('pt-BR') : '—'}</td>
                <td className="r num">{c.entregues > 0 ? c.entregues.toLocaleString('pt-BR') : '—'}</td>
                <td className="r num">{c.lidos > 0 ? c.lidos.toLocaleString('pt-BR') : '—'}</td>
                <td className="r num">{c.custo_total > 0 ? formatarMoeda(c.custo_total) : '—'}</td>
                <td className="arrow-cell">›</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
