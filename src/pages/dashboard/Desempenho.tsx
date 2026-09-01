import { useEffect, useRef } from 'react'
import { useDesempenho } from '../../hooks/useDesempenho'

declare global {
  interface Window {
    Chart: any
  }
}

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
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function MiniChart({ canvasId }: { canvasId: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<any>(null)

  useEffect(() => {
    if (!ref.current) return
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js'
    script.onload = () => buildChart()
    if (window.Chart) { buildChart(); return }
    document.head.appendChild(script)

    function buildChart() {
      if (chartRef.current) chartRef.current.destroy()
      const ctx = ref.current!.getContext('2d')!
      function grad(color: string) {
        const g = ctx.createLinearGradient(0, 0, 0, 190)
        g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)'); return g
      }
      const lineOpts = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, border: { color: '#232330' }, ticks: { color: '#5C5C70', font: { family: 'Inter', size: 11 } } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, border: { display: false }, ticks: { color: '#5C5C70', font: { family: 'Inter', size: 11 }, maxTicksLimit: 5 } },
        },
      }
      chartRef.current = new window.Chart(ref.current, {
        type: 'line',
        data: {
          labels: ['22', '23', '24', '25', '26', '27', '28 ago'],
          datasets: [
            { data: [520, 610, 588, 640, 602, 720, 538], borderColor: '#E8192C', borderWidth: 2, backgroundColor: grad('rgba(232,25,44,0.12)'), fill: true, tension: .3, pointRadius: 0 },
            { data: [500, 592, 570, 618, 585, 700, 520], borderColor: '#8F8FA3', borderWidth: 1.5, fill: false, tension: .3, pointRadius: 0 },
            { data: [320, 395, 362, 410, 388, 470, 340], borderColor: '#C9A017', borderWidth: 1.5, fill: false, tension: .3, pointRadius: 0 },
          ],
        },
        options: lineOpts,
      })
    }
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [])

  return <canvas ref={ref} id={canvasId} />
}

export default function Desempenho() {
  const { data, loading, error } = useDesempenho()

  const taxaEntrega = data && data.totalEnviado > 0
    ? Math.round((data.totalEntregue / data.totalEnviado) * 100)
    : 0

  return (
    <div>
      {loading && (
        <div className="panel" style={{ padding: '24px', fontSize: 13, color: 'var(--text-2)' }}>
          Carregando dados...
        </div>
      )}

      {error && (
        <div className="panel" style={{ padding: '24px', fontSize: 13, color: '#f28c94', borderColor: 'rgba(232,25,44,0.3)' }}>
          Não foi possível carregar os dados: {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* KPI row */}
          <div className="kpi-row">
            <div className="kpi-card">
              <div className="kpi-label">Mensagens enviadas</div>
              <div className="kpi-value num">{data.totalEnviado.toLocaleString('pt-BR')}</div>
              <div className="kpi-sub"><span className="pos">+8%</span> vs. período anterior</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Taxa de entrega</div>
              <div className="kpi-value num">{taxaEntrega}%</div>
              <div className="kpi-sub num">{data.totalEnviado - data.totalEntregue} falhas</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Taxa de leitura</div>
              <div className="kpi-value num">
                {data.totalEntregue > 0 ? Math.round((data.lidos / data.totalEntregue) * 100) : 0}%
              </div>
              <div className="kpi-sub num">{(data.lidos ?? 0).toLocaleString('pt-BR')} leituras</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Custo do período</div>
              <div className="kpi-value num">{formatarMoeda(data.custoTotal)}</div>
              <div className="kpi-sub num">
                {data.totalEnviado > 0
                  ? `R$ ${(data.custoTotal / data.totalEnviado).toFixed(2).replace('.', ',')} por mensagem`
                  : '—'}
              </div>
            </div>
          </div>

          {/* Grid: gráfico + saúde */}
          <div className="grid-2">
            <div className="panel">
              <div className="panel-head">
                <div className="panel-title">
                  Mensagens por dia<span>enviadas · entregues · lidas</span>
                </div>
              </div>
              <div className="chart-wrap">
                <MiniChart canvasId="chartMsgs" />
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <div className="panel-title">Saúde do número</div>
              </div>
              {data.saudeNumero ? (
                <>
                  <div className="health-row">
                    <span>Qualidade (Meta)</span>
                    <span className="status-txt st-ok">{data.saudeNumero.quality_rating}</span>
                  </div>
                  <div className="health-row">
                    <span>Tier de envio</span>
                    <span className="num" style={{ fontWeight: 600 }}>{data.saudeNumero.messaging_tier}</span>
                  </div>
                  <div className="health-row">
                    <span>Status do template ativo</span>
                    <span className="status-txt st-ok">Aprovado</span>
                  </div>
                  <div className="health-row">
                    <span>Última verificação</span>
                    <span style={{ color: 'var(--text-3)', fontSize: 12.5 }}>{formatarData(data.saudeNumero.captured_at)}</span>
                  </div>
                </>
              ) : (
                <div className="health-row">
                  <span style={{ color: 'var(--text-3)', fontSize: 12.5 }}>
                    Nenhum dado de saúde registrado ainda.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Alertas */}
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-head">
              <div className="panel-title">Alertas</div>
            </div>
            <div className="health-row">
              <span className="status-txt st-warn">
                Campanha "Follow-up Diagnóstico" com taxa de falha acima de 5%
              </span>
              <a style={{ color: 'var(--text-2)', fontSize: 12.5, cursor: 'pointer' }}>Ver campanha →</a>
            </div>
            <div className="health-row">
              <span className="status-txt st-neutral">
                Template "wpp_oferta_supplytex" aguardando aprovação da Meta há 2 dias
              </span>
              <a style={{ color: 'var(--text-2)', fontSize: 12.5, cursor: 'pointer' }}>Ver template →</a>
            </div>
          </div>

          {/* Tabela de campanhas recentes */}
          {data.campanhasRecentes.length > 0 && (
            <>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Campanhas recentes</div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Campanha</th>
                    <th>Status</th>
                    <th className="r">Enviados</th>
                    <th className="r">Entregues</th>
                    <th className="r">Lidos</th>
                    <th className="r">Falhas</th>
                    <th>Criada em</th>
                  </tr>
                </thead>
                <tbody>
                  {data.campanhasRecentes.map((c) => (
                    <tr key={c.id} className="rowlink">
                      <td><div className="row-title">{c.name}</div></td>
                      <td><span className="status-txt st-neutral">{rotuloStatus[c.status] ?? c.status}</span></td>
                      <td className="r num">{c.total_envios}</td>
                      <td className="r num">{c.entregues}</td>
                      <td className="r num">{c.lidos}</td>
                      <td className="r num">{c.falhas > 0 ? c.falhas : '—'}</td>
                      <td className="row-sub">{formatarData(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  )
}
