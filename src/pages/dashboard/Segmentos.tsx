import { useState } from 'react'
import { useSegmentos } from '../../hooks/useSegmentos'

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const sourceLabel: Record<string, string> = {
  rd_crm: 'RD CRM', rd_marketing: 'RD Marketing', manual: 'Manual',
}

const syncLabel: Record<string, { label: string; cls: string }> = {
  rd_crm:       { label: 'A cada 2h',           cls: 'st-ok'      },
  rd_marketing: { label: 'Tempo real (webhook)', cls: 'st-ok'      },
  manual:       { label: 'Estático',             cls: 'st-neutral' },
}

export default function Segmentos() {
  const { segmentos, loading, error } = useSegmentos()
  const [abaAtiva, setAbaAtiva] = useState<'segmentos' | 'leads'>('segmentos')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button className={`tab ${abaAtiva === 'segmentos' ? 'active' : ''}`} onClick={() => setAbaAtiva('segmentos')}>Segmentos</button>
          <button className={`tab ${abaAtiva === 'leads' ? 'active' : ''}`} onClick={() => setAbaAtiva('leads')}>Todos os leads</button>
        </div>
        <button className="btn primary">+ Novo segmento</button>
      </div>

      {loading && (
        <div className="panel" style={{ padding: 24, fontSize: 13, color: 'var(--text-2)' }}>Carregando segmentos...</div>
      )}
      {error && (
        <div className="panel" style={{ padding: 24, fontSize: 13, color: '#f28c94' }}>
          Não foi possível carregar os segmentos: {error}
        </div>
      )}

      {!loading && !error && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Segmento</th><th>Fonte</th><th className="r">Leads</th>
              <th>Sincronização</th><th className="r">Última atualização</th><th></th>
            </tr>
          </thead>
          <tbody>
            {segmentos.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32, fontSize: 13 }}>
                  Nenhum segmento criado ainda.
                </td>
              </tr>
            )}
            {segmentos.map((s) => {
              const src = s.source ?? 'manual'
              const sync = syncLabel[src] ?? { label: src, cls: 'st-neutral' }
              // source_ref pode conter descrição como string
              const descricao = typeof s.source_ref === 'string' ? s.source_ref : null
              return (
                <tr key={s.id} className="rowlink">
                  <td>
                    <div className="row-title">{s.name}</div>
                    {descricao && <div className="row-sub">{descricao}</div>}
                  </td>
                  <td><span className="status-txt st-neutral">{sourceLabel[src] ?? src}</span></td>
                  <td className="r cell-num num">{(s.contact_count ?? 0).toLocaleString('pt-BR')}</td>
                  <td><span className={`status-txt ${sync.cls}`}>{sync.label}</span></td>
                  <td className="r row-sub">{formatarData(s.last_synced_at ?? null)}</td>
                  <td className="arrow-cell">›</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
