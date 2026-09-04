import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDesempenho, getDateRange, PRESET_LABELS, type DatePreset } from '../../hooks/useDesempenho'

declare global { interface Window { Chart: any } }

const rotuloStatus: Record<string, string> = {
  draft: 'Rascunho', scheduled: 'Agendada', running: 'Em andamento',
  completed: 'Concluída', firing: 'Em andamento', failed: 'Falhou', paused: 'Pausada',
}

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDia(iso: string): string {
  const [, m, d] = iso.split('-')
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  return `${parseInt(d)} ${meses[parseInt(m) - 1]}`
}

// ── Filtro de data (mesmo padrão do Radar) ────────────────────────────────────
function DateFilter({ preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo, label }: {
  preset: DatePreset | 'custom'; setPreset: (p: DatePreset | 'custom') => void
  customFrom: string; setCustomFrom: (s: string) => void
  customTo: string; setCustomTo: (s: string) => void; label: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn" onClick={() => setOpen(o => !o)}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>
        </svg>
        {label}
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth={1.6}><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
          background: 'var(--surface-2)', border: '1px solid var(--line)',
          borderRadius: 10, padding: 12, width: 260,
          boxShadow: '0 16px 40px rgba(0,0,0,.55)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 12 }}>
            {(Object.keys(PRESET_LABELS) as DatePreset[]).map(p => (
              <div key={p} onClick={() => { setPreset(p); setOpen(false) }}
                style={{
                  padding: '7px 10px', fontSize: 12.5, borderRadius: 6, cursor: 'pointer', fontWeight: 500,
                  color: preset === p ? 'var(--text)' : 'var(--text-2)',
                  background: preset === p ? 'rgba(255,255,255,0.06)' : 'transparent',
                  boxShadow: preset === p ? 'inset 0 0 0 1px var(--line)' : 'none',
                }}
              >{PRESET_LABELS[p]}</div>
            ))}
          </div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text-3)', marginBottom: 7, fontWeight: 600 }}>
            Período personalizado
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="input" style={{ fontSize: 12.5, padding: '7px 9px' }} />
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="input" style={{ fontSize: 12.5, padding: '7px 9px' }} />
          </div>
          <button className="btn primary" style={{ width: '100%', justifyContent: 'center', fontSize: 12.5 }}
            onClick={() => { if (customFrom && customTo) { setPreset('custom'); setOpen(false) } }}>
            Aplicar
          </button>
        </div>
      )}
    </div>
  )
}

// ── Gráfico de linha estilo CS Dash ───────────────────────────────────────────
function GraficoLinha({ porDia }: { porDia: { dia: string; enviadas: number; entregues: number; lidas: number }[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<any>(null)

  useEffect(() => {
    function buildChart() {
      if (!ref.current || porDia.length === 0) return
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
      const ctx = ref.current.getContext('2d')!

      function grad(r: number, g: number, b: number) {
        const gr = ctx.createLinearGradient(0, 0, 0, 220)
        gr.addColorStop(0, `rgba(${r},${g},${b},0.18)`)
        gr.addColorStop(1, `rgba(${r},${g},${b},0)`)
        return gr
      }

      chartRef.current = new window.Chart(ref.current, {
        type: 'line',
        data: {
          labels: porDia.map(p => fmtDia(p.dia)),
          datasets: [
            {
              label: 'Enviadas',
              data: porDia.map(p => p.enviadas),
              borderColor: '#E8192C', borderWidth: 2,
              backgroundColor: grad(232, 25, 44),
              fill: true, tension: 0.4,
              pointRadius: 4, pointBackgroundColor: '#E8192C',
              pointBorderColor: '#0E0E15', pointBorderWidth: 2,
              pointHoverRadius: 6,
            },
            {
              label: 'Entregues',
              data: porDia.map(p => p.entregues),
              borderColor: '#8F8FA3', borderWidth: 1.5,
              fill: false, tension: 0.4,
              pointRadius: 4, pointBackgroundColor: '#8F8FA3',
              pointBorderColor: '#0E0E15', pointBorderWidth: 2,
              pointHoverRadius: 6,
            },
            {
              label: 'Lidas',
              data: porDia.map(p => p.lidas),
              borderColor: '#C9A017', borderWidth: 1.5,
              fill: false, tension: 0.4,
              pointRadius: 4, pointBackgroundColor: '#C9A017',
              pointBorderColor: '#0E0E15', pointBorderWidth: 2,
              pointHoverRadius: 6,
            },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#13131C',
              borderColor: '#232330', borderWidth: 1,
              titleColor: '#EDEDF2', bodyColor: '#8F8FA3',
              padding: 10,
              callbacks: {
                label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.parsed.y}`,
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              border: { color: '#232330' },
              ticks: { color: '#5C5C70', font: { family: 'Inter', size: 11 }, maxTicksLimit: 10 }
            },
            y: {
              grid: { color: 'rgba(255,255,255,0.04)' },
              border: { display: false },
              ticks: { color: '#5C5C70', font: { family: 'Inter', size: 11 }, maxTicksLimit: 5 },
              beginAtZero: true,
            },
          },
        },
      })
    }

    if (window.Chart) { buildChart(); return }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js'
    script.onload = buildChart
    document.head.appendChild(script)
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [porDia])

  if (porDia.length === 0) {
    return (
      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--text-3)' }}>
        Nenhum envio no período selecionado.
      </div>
    )
  }

  return <canvas ref={ref} />
}

// ── Legenda do gráfico ────────────────────────────────────────────────────────
function LegendaGrafico() {
  return (
    <div style={{ display: 'flex', gap: 18, fontSize: 12, color: 'var(--text-2)' }}>
      {[
        { label: 'Enviadas', color: '#E8192C' },
        { label: 'Entregues', color: '#8F8FA3' },
        { label: 'Lidas', color: '#C9A017' },
      ].map(s => (
        <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: 'inline-block' }} />
          {s.label}
        </span>
      ))}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Desempenho() {
  const navigate = useNavigate()

  const [preset, setPreset] = useState<DatePreset | 'custom'>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [dateLabel, setDateLabel] = useState(PRESET_LABELS['30d'])

  const { from, to } = preset === 'custom'
    ? { from: customFrom, to: customTo }
    : getDateRange(preset as DatePreset)

  useEffect(() => {
    setDateLabel(preset === 'custom' ? `${customFrom} – ${customTo}` : PRESET_LABELS[preset as DatePreset])
  }, [preset, customFrom, customTo])

  const { data, loading, error } = useDesempenho(from, to)

  const taxaEntrega = data && data.totalEnviado > 0
    ? Math.round((data.totalEntregue / data.totalEnviado) * 100) : 0
  const taxaLeitura = data && data.totalEntregue > 0
    ? Math.round((data.totalLido / data.totalEntregue) * 100) : 0

  return (
    <div>
      {/* Cabeçalho com filtro de período */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <DateFilter
          preset={preset} setPreset={setPreset}
          customFrom={customFrom} setCustomFrom={setCustomFrom}
          customTo={customTo} setCustomTo={setCustomTo}
          label={dateLabel}
        />
      </div>

      {loading && (
        <div className="panel" style={{ padding: 24, fontSize: 13, color: 'var(--text-2)' }}>Carregando dados...</div>
      )}
      {error && (
        <div className="panel" style={{ padding: 24, fontSize: 13, color: '#f28c94' }}>
          Não foi possível carregar os dados: {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* KPIs */}
          <div className="kpi-row">
            <div className="kpi-card">
              <div className="kpi-label">Mensagens enviadas</div>
              <div className="kpi-value num">{data.totalEnviado.toLocaleString('pt-BR')}</div>
              <div className="kpi-sub">{dateLabel}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Taxa de entrega</div>
              <div className="kpi-value num">{taxaEntrega}%</div>
              <div className="kpi-sub num">{data.totalFalha} falhas</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Taxa de leitura</div>
              <div className="kpi-value num">{taxaLeitura}%</div>
              <div className="kpi-sub num">{data.totalLido.toLocaleString('pt-BR')} leituras</div>
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

          {/* Gráfico + Saúde */}
          <div className="grid-2">
            <div className="panel">
              <div className="panel-head">
                <div className="panel-title">Mensagens por dia</div>
                <LegendaGrafico />
              </div>
              <div className="chart-wrap" style={{ height: 220 }}>
                <GraficoLinha porDia={data.porDia} />
              </div>
            </div>
            <div className="panel">
              <div className="panel-head"><div className="panel-title">Saúde do número</div></div>
              {data.saudeNumero ? (
                <>
                  <div className="health-row"><span>Qualidade (Meta)</span><span className="status-txt st-ok">{data.saudeNumero.quality_rating}</span></div>
                  <div className="health-row"><span>Tier de envio</span><span className="num" style={{ fontWeight: 600 }}>{data.saudeNumero.messaging_tier}</span></div>
                  <div className="health-row"><span>Status do template ativo</span><span className="status-txt st-ok">Aprovado</span></div>
                  <div className="health-row"><span>Última verificação</span><span style={{ color: 'var(--text-3)', fontSize: 12.5 }}>{formatarData(data.saudeNumero.captured_at)}</span></div>
                </>
              ) : (
                <div className="health-row"><span style={{ color: 'var(--text-3)', fontSize: 12.5 }}>Nenhum dado de saúde registrado ainda.</span></div>
              )}
            </div>
          </div>

          {/* Alertas dinâmicos */}
          {(() => {
            const alertas: { msg: string; tipo: 'warn' | 'neutral'; label: string; rota: string }[] = []
            data.campanhasRecentes.forEach(c => {
              const total = c.total_envios ?? 0
              const falhas = c.falhas ?? 0
              if (total > 0 && falhas / total > 0.05) {
                alertas.push({ msg: `Campanha "${c.name}" com taxa de falha acima de 5%`, tipo: 'warn', label: 'Ver campanha →', rota: '/campanhas' })
              }
            })
            if (alertas.length === 0) return null
            return (
              <div className="panel" style={{ marginBottom: 20 }}>
                <div className="panel-head"><div className="panel-title">Alertas</div></div>
                {alertas.map((a, i) => (
                  <div key={i} className="health-row">
                    <span className={`status-txt st-${a.tipo}`}>{a.msg}</span>
                    <a onClick={() => navigate(a.rota)}
                      style={{ color: 'var(--text-2)', fontSize: 12.5, cursor: 'pointer', textDecoration: 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}>
                      {a.label}
                    </a>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Campanhas recentes */}
          {data.campanhasRecentes.length > 0 && (
            <>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Campanhas recentes</div>
              <div style={{overflowX:'auto',borderRadius:14}}>
                <table className="data-table">
                <thead>
                  <tr>
                    <th>Campanha</th><th>Status</th>
                    <th className="r">Enviados</th><th className="r">Entregues</th>
                    <th className="r">Lidos</th><th className="r">Falhas</th><th>Criada em</th>
                  </tr>
                </thead>
                <tbody>
                  {data.campanhasRecentes.map((c) => (
                    <tr key={c.id} className="rowlink" onClick={() => navigate('/campanhas')}>
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
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
