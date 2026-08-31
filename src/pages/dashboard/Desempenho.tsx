import { useDesempenho } from '../../hooks/useDesempenho'

const rotuloStatus: Record<string, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  running: 'Em andamento',
  completed: 'Concluída',
  failed: 'Falhou',
  paused: 'Pausada',
}

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function Desempenho() {
  const { data, loading, error } = useDesempenho()

  return (
    <div>
      <h1 className="font-display font-semibold text-2xl mb-1">Desempenho</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-8">
        Visão geral de gasto, mensagens enviadas e conversões nas campanhas ativas.
      </p>

      {loading && (
        <div className="glass-card p-6 text-sm text-[var(--color-text-muted)]">Carregando dados...</div>
      )}

      {error && (
        <div className="glass-card p-6 text-sm text-[#f28c94] border-[rgba(232,25,44,0.3)]">
          Não foi possível carregar os dados: {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="glass-card p-5">
              <p className="text-xs text-[var(--color-text-muted)] mb-1">Campanhas</p>
              <p className="font-display text-3xl font-semibold">{data.totalCampanhas}</p>
            </div>
            <div className="glass-card p-5">
              <p className="text-xs text-[var(--color-text-muted)] mb-1">Mensagens enviadas</p>
              <p className="font-display text-3xl font-semibold">{data.totalEnviado}</p>
            </div>
            <div className="glass-card p-5">
              <p className="text-xs text-[var(--color-text-muted)] mb-1">Taxa de entrega</p>
              <p className="font-display text-3xl font-semibold">
                {data.totalEnviado > 0 ? Math.round((data.totalEntregue / data.totalEnviado) * 100) : 0}%
              </p>
            </div>
            <div className="glass-card p-5">
              <p className="text-xs text-[var(--color-text-muted)] mb-1">Custo total</p>
              <p className="font-display text-3xl font-semibold">{formatarMoeda(data.custoTotal)}</p>
            </div>
          </div>

          {data.saudeNumero && (
            <div className="glass-card p-5 mb-8 flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Saúde do número WhatsApp</p>
                <p className="text-sm">
                  Qualidade: <span className="font-medium">{data.saudeNumero.quality_rating}</span> · Tier:{' '}
                  <span className="font-medium">{data.saudeNumero.messaging_tier}</span>
                </p>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                Atualizado em {formatarData(data.saudeNumero.captured_at)}
              </p>
            </div>
          )}

          <h2 className="font-display font-semibold text-lg mb-3">Campanhas recentes</h2>

          {data.campanhasRecentes.length === 0 ? (
            <div className="glass-card p-6 text-sm text-[var(--color-text-muted)]">
              Nenhuma campanha criada ainda.
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--color-text-muted)] text-xs border-b border-white/5">
                    <th className="px-4 py-3 font-medium">Campanha</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Enviados</th>
                    <th className="px-4 py-3 font-medium text-right">Entregues</th>
                    <th className="px-4 py-3 font-medium text-right">Lidos</th>
                    <th className="px-4 py-3 font-medium text-right">Falhas</th>
                    <th className="px-4 py-3 font-medium">Criada em</th>
                  </tr>
                </thead>
                <tbody>
                  {data.campanhasRecentes.map((c) => (
                    <tr key={c.id} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">
                        {rotuloStatus[c.status] ?? c.status}
                      </td>
                      <td className="px-4 py-3 text-right">{c.total_envios}</td>
                      <td className="px-4 py-3 text-right">{c.entregues}</td>
                      <td className="px-4 py-3 text-right">{c.lidos}</td>
                      <td className="px-4 py-3 text-right">{c.falhas > 0 ? c.falhas : '—'}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">{formatarData(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
