import { useState, useEffect, useCallback } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MetaAdsInsight {
  id: string
  campaign_id: string
  campaign_name: string
  date_start: string
  date_stop: string
  impressions: number
  clicks: number
  spend: number
  leads: number
  purchases: number
  purchase_value: number
  cpl: number
  roas: number
  synced_at: string
}

type Tab = 'geral' | 'campanha' | 'funil'
type SubTab = 'wpp' | 'ads'
type DatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'this_month' | 'last_month'

const SUPABASE_URL = 'https://syecwttpsvrmhdvinjmt.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5ZWN3dHRwc3ZybWhkdmluam10Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzk1NDgxMywiZXhwIjoyMDk5NTMwODEzfQ.4q7pNim34eP-n38pANB9g7Lud-Y20TU4-VFA5f5WaGo'

const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Hoje', yesterday: 'Ontem', '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias', this_month: 'Este mês', last_month: 'Mês passado',
}

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  switch (preset) {
    case 'today': return { from: fmt(now), to: fmt(now) }
    case 'yesterday': { const y = new Date(now); y.setDate(y.getDate() - 1); return { from: fmt(y), to: fmt(y) } }
    case '7d': { const s = new Date(now); s.setDate(s.getDate() - 6); return { from: fmt(s), to: fmt(now) } }
    case '30d': { const s = new Date(now); s.setDate(s.getDate() - 29); return { from: fmt(s), to: fmt(now) } }
    case 'this_month': { const s = new Date(now.getFullYear(), now.getMonth(), 1); return { from: fmt(s), to: fmt(now) } }
    case 'last_month': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const e = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: fmt(s), to: fmt(e) }
    }
  }
}

function fmtBRL(v: number) {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1).replace('.', ',')} mil`
  return `R$ ${Number(v).toFixed(2).replace('.', ',')}`
}
function fmtNum(v: number) { return v.toLocaleString('pt-BR') }
function fmtROAS(v: number) { return `${Number(v).toFixed(1).replace('.', ',')}x` }
function timeSince(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return 'agora'
  if (diff < 60) return `há ${diff} min`
  return `há ${Math.floor(diff / 60)}h`
}

async function fetchInsights(from: string, to: string): Promise<MetaAdsInsight[]> {
  const url = `${SUPABASE_URL}/rest/v1/meta_ads_insights?date_start=gte.${from}&date_stop=lte.${to}&order=spend.desc`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY, 'Accept-Profile': 'wpp' },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}`)
  return res.json()
}

// ─── Date Filter ─────────────────────────────────────────────────────────────

function DateFilter({ preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo, label }: {
  preset: DatePreset | 'custom'; setPreset: (p: DatePreset | 'custom') => void
  customFrom: string; setCustomFrom: (s: string) => void
  customTo: string; setCustomTo: (s: string) => void; label: string
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const h = () => setOpen(false)
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [])

  return (
    <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
      <button className="btn" onClick={() => setOpen(o => !o)}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>
        </svg>
        {label}
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth={1.6}><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200,
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

// ─── Barra proporcional ───────────────────────────────────────────────────────

function BarFill({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="bartrack">
      <div className="barfill" style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── Funis mapeados ──────────────────────────────────────────────────────────

const FUNIL_MAP = [
  { name: 'Segredos da Confecção', pixel: '2078737449416859', kws: ['SEGREDOS', 'SC |'] },
  { name: 'Imersão Paraguai',       pixel: '1012804927965896', kws: ['PARAGUAI', 'PY |'] },
  { name: 'Supplytex',              pixel: '961390553583140',  kws: ['SUPPLYTEX', 'SX |'] },
  { name: 'Funil Diagnóstico',      pixel: '2006103380028816', kws: ['DIAGNÓSTICO', 'DIAG |'] },
]

// ─── Main ────────────────────────────────────────────────────────────────────

export default function Radar() {
  const [tab, setTab] = useState<Tab>('geral')
  const [subTab, setSubTab] = useState<SubTab>('wpp')
  const [preset, setPreset] = useState<DatePreset | 'custom'>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [insights, setInsights] = useState<MetaAdsInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [detail, setDetail] = useState<MetaAdsInsight | null>(null)
  const [dateLabel, setDateLabel] = useState('Últimos 30 dias')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const range = preset === 'custom' ? { from: customFrom, to: customTo } : getDateRange(preset as DatePreset)
      const data = await fetchInsights(range.from, range.to)
      setInsights(data)
      if (data.length > 0) setSyncedAt(data[0].synced_at)
      setDateLabel(preset === 'custom' ? `${customFrom} – ${customTo}` : PRESET_LABELS[preset as DatePreset])
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [preset, customFrom, customTo])

  useEffect(() => { load() }, [load])

  // KPIs globais
  const totalLeads  = insights.reduce((s, r) => s + r.leads, 0)
  const totalSpend  = insights.reduce((s, r) => s + Number(r.spend), 0)
  const totalRev    = insights.reduce((s, r) => s + Number(r.purchase_value), 0)
  const avgCPL      = totalLeads > 0 ? totalSpend / totalLeads : 0
  const avgROAS     = totalSpend > 0 ? totalRev / totalSpend : 0
  const maxSpend    = Math.max(...insights.map(r => Number(r.spend)), 1)

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="font-display font-semibold text-2xl">Radar de Conversões</h1>
            <span className="status-txt st-ok" style={{ fontSize: 11.5 }}>
              {syncedAt ? `Sincronizado ${timeSince(syncedAt)}` : 'Aguardando sync'}
            </span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-3)', marginTop: 4 }}>
            Gasto, CPL e ROAS das campanhas Meta Ads com WhatsApp · {dateLabel}
          </p>
        </div>
        <DateFilter
          preset={preset} setPreset={setPreset}
          customFrom={customFrom} setCustomFrom={setCustomFrom}
          customTo={customTo} setCustomTo={setCustomTo}
          label={dateLabel}
        />
      </div>

      {/* Tabs */}
      <div className="tabs">
        {(['geral', 'campanha', 'funil'] as Tab[]).map(t => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`}
            onClick={() => { setTab(t); setDetail(null) }}>
            {t === 'geral' ? 'Visão Geral' : t === 'campanha' ? 'Por Campanha' : 'Por Funil'}
          </button>
        ))}
      </div>

      {error && (
        <div className="panel" style={{ padding: '12px 16px', marginBottom: 20, color: '#f87171', fontSize: 13 }}>
          Erro ao carregar dados: {error}
        </div>
      )}

      {loading ? (
        <div className="panel" style={{ padding: 32, fontSize: 13, color: 'var(--text-2)', textAlign: 'center' }}>
          Carregando...
        </div>
      ) : detail ? (
        <DetailView campaign={detail} onBack={() => setDetail(null)} />
      ) : tab === 'geral' ? (
        <GeralView insights={insights} totalLeads={totalLeads} totalSpend={totalSpend} totalRev={totalRev} avgCPL={avgCPL} avgROAS={avgROAS} maxSpend={maxSpend} />
      ) : tab === 'campanha' ? (
        <CampanhaView insights={insights} subTab={subTab} setSubTab={setSubTab} onDetail={setDetail} />
      ) : (
        <FunilView insights={insights} onDetail={setDetail} />
      )}
    </div>
  )
}

// ─── Visão Geral ─────────────────────────────────────────────────────────────

function GeralView({ insights, totalLeads, totalSpend, totalRev, avgCPL, avgROAS, maxSpend }: {
  insights: MetaAdsInsight[]; totalLeads: number; totalSpend: number; totalRev: number
  avgCPL: number; avgROAS: number; maxSpend: number
}) {
  return (
    <>
      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-label"><span className="base-mark"/> Leads (Meta Ads)</div>
          <div className="kpi-value num">{fmtNum(totalLeads)}</div>
          <div className="kpi-sub">campanhas com whatsapp</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><span className="base-mark"/> Gasto total</div>
          <div className="kpi-value num">{fmtBRL(totalSpend)}</div>
          <div className="kpi-sub num">CPL médio {fmtBRL(avgCPL)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><span className="base-mark"/> Receita atribuída</div>
          <div className="kpi-value num" style={{ color: 'var(--gold)' }}>{fmtBRL(totalRev)}</div>
          <div className="kpi-sub">eventos Purchase</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><span className="base-mark"/> ROAS médio</div>
          <div className="kpi-value num">{fmtROAS(avgROAS)}</div>
          <div className="kpi-sub">{insights.length} campanhas no período</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-head">
          <div className="panel-title">Campanhas WhatsApp <span>por gasto</span></div>
        </div>
        {insights.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '24px 0', textAlign: 'center' }}>
            Nenhuma campanha no período selecionado.
          </div>
        ) : (
          <div className="funnel-list">
            {insights.map(r => (
              <div className="funnel-row" key={r.id}>
                <div className="flabel">
                  <b>{r.campaign_name}</b>
                  <span>{fmtBRL(Number(r.spend))}</span>
                </div>
                <BarFill value={Number(r.spend)} max={maxSpend} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Funil CRM → CAPI <span>% sobre leads gerados</span></div>
        </div>
        <div className="conv-funnel">
          {[
            { label: 'Lead', sub: 'Contato Feito / Realizado', pct: 100, gold: false },
            { label: 'CompleteRegistration', sub: 'Identificação de Interesse', pct: 0, gold: false },
            { label: 'Schedule', sub: 'Reunião', pct: 0, gold: false },
            { label: 'InitiateCheckout', sub: 'Negociação', pct: 0, gold: false },
            { label: 'Purchase', sub: 'Fechado', pct: 0, gold: true },
          ].map(step => (
            <div className="conv-step" key={step.label}>
              <div className="step-name">{step.label}<small>{step.sub}</small></div>
              <div className="conv-track">
                <div className="conv-fill" style={{ width: `${step.pct}%`, background: step.gold ? 'var(--gold)' : 'var(--red)', opacity: step.pct === 0 ? 0.15 : 1 }} />
              </div>
              <div className="conv-nums">
                <span className="conv-abs num" style={{ color: step.pct === 0 ? 'var(--text-3)' : step.gold ? 'var(--gold)' : 'var(--text)' }}>—</span>
                <span className="conv-rel num">aguardando</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
          Os eventos CRM → CAPI serão exibidos aqui automaticamente conforme o workflow N8N registrar os disparos.
        </div>
      </div>
    </>
  )
}

// ─── Por Campanha ─────────────────────────────────────────────────────────────

function CampanhaView({ insights, subTab, setSubTab, onDetail }: {
  insights: MetaAdsInsight[]; subTab: SubTab; setSubTab: (s: SubTab) => void
  onDetail: (c: MetaAdsInsight) => void
}) {
  return (
    <>
      <div style={{ display: 'flex', gap: 18, marginBottom: 18, borderBottom: '1px solid var(--line-soft)' }}>
        {(['wpp', 'ads'] as SubTab[]).map(s => (
          <div key={s} onClick={() => setSubTab(s)} style={{
            padding: '0 2px 10px', fontSize: 13, fontWeight: 500, cursor: 'pointer', marginBottom: -1,
            color: subTab === s ? 'var(--text)' : 'var(--text-3)',
            borderBottom: subTab === s ? '1.5px solid var(--red)' : '1.5px solid transparent',
          }}>
            {s === 'wpp' ? 'Campanhas de WhatsApp' : 'Campanhas Meta Ads'}
          </div>
        ))}
      </div>

      {subTab === 'wpp' ? (
        <div className="panel" style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: 40 }}>
          Os dados de performance das campanhas de WhatsApp serão exibidos aqui conforme os disparos forem registrados.
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Campanha (Meta Ads)</th>
              <th className="r">Leads</th>
              <th className="r">Gasto</th>
              <th className="r">CPL</th>
              <th className="r">Receita</th>
              <th className="r">ROAS</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {insights.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', fontSize: 13 }}>Nenhuma campanha no período.</td></tr>
            ) : insights.map(r => (
              <tr key={r.id} className="rowlink" onClick={() => onDetail(r)}>
                <td>
                  <div className="row-title">{r.campaign_name}</div>
                  <div className="row-sub">{r.date_start} → {r.date_stop}</div>
                </td>
                <td className="r cell-num num">{fmtNum(r.leads)}</td>
                <td className="r num">{fmtBRL(Number(r.spend))}</td>
                <td className="r num">{fmtBRL(Number(r.cpl))}</td>
                <td className="r cell-gold num">{Number(r.purchase_value) > 0 ? fmtBRL(Number(r.purchase_value)) : '—'}</td>
                <td className="r num">{Number(r.roas) > 0 ? fmtROAS(Number(r.roas)) : '—'}</td>
                <td className="arrow-cell">›</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

// ─── Por Funil ────────────────────────────────────────────────────────────────

function FunilView({ insights, onDetail }: { insights: MetaAdsInsight[]; onDetail: (c: MetaAdsInsight) => void }) {
  const funis = FUNIL_MAP.map(f => {
    const rows = insights.filter(r => f.kws.some(kw => r.campaign_name.toUpperCase().includes(kw.toUpperCase())))
    const leads    = rows.reduce((s, r) => s + r.leads, 0)
    const spend    = rows.reduce((s, r) => s + Number(r.spend), 0)
    const revenue  = rows.reduce((s, r) => s + Number(r.purchase_value), 0)
    const cpl      = leads > 0 ? spend / leads : 0
    const roas     = spend > 0 ? revenue / spend : 0
    return { ...f, leads, spend, revenue, cpl, roas, rows }
  })

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Funil (RD CRM)</th>
          <th className="r">Leads</th>
          <th className="r">Gasto</th>
          <th className="r">CPL</th>
          <th className="r">Receita</th>
          <th className="r">ROAS</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {funis.map(f => (
          <tr key={f.name} className={f.leads > 0 ? 'rowlink' : ''} onClick={() => f.rows.length > 0 && onDetail(f.rows[0])}>
            <td style={{ color: f.leads === 0 ? 'var(--text-3)' : 'var(--text)' }}>
              <div className="row-title" style={{ color: 'inherit' }}>{f.name}</div>
              <div className="row-sub">Pixel {f.pixel}</div>
            </td>
            <td className="r num" style={{ color: f.leads === 0 ? 'var(--text-3)' : 'var(--text)' }}>{f.leads > 0 ? fmtNum(f.leads) : '—'}</td>
            <td className="r num" style={{ color: f.spend === 0 ? 'var(--text-3)' : 'var(--text)' }}>{f.spend > 0 ? fmtBRL(f.spend) : '—'}</td>
            <td className="r num" style={{ color: f.cpl === 0 ? 'var(--text-3)' : 'var(--text)' }}>{f.cpl > 0 ? fmtBRL(f.cpl) : '—'}</td>
            <td className="r cell-gold num">{f.revenue > 0 ? fmtBRL(f.revenue) : <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
            <td className="r num" style={{ color: f.roas === 0 ? 'var(--text-3)' : 'var(--text)' }}>{f.roas > 0 ? fmtROAS(f.roas) : '—'}</td>
            <td className="arrow-cell">{f.leads > 0 ? '›' : ''}</td>
          </tr>
        ))}
        <tr>
          <td colSpan={7} style={{ color: 'var(--text-3)' }}>
            <div className="row-title" style={{ color: 'var(--text-3)' }}>Europa · China · C$ Club</div>
            <div className="row-sub">Aguardando compartilhamento dos pixels</div>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

// ─── Detalhe ──────────────────────────────────────────────────────────────────

function DetailView({ campaign, onBack }: { campaign: MetaAdsInsight; onBack: () => void }) {
  const ctr = campaign.impressions > 0 ? ((campaign.clicks / campaign.impressions) * 100).toFixed(2).replace('.', ',') + '%' : '—'

  return (
    <>
      <div onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer', marginBottom: 16, fontWeight: 500 }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}>
        ← Voltar
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: 22 }}>{campaign.campaign_name}</h2>
          <div style={{ color: 'var(--text-3)', fontSize: 12.5, marginTop: 4 }}>
            {campaign.date_start} → {campaign.date_stop} · Sincronizado {timeSince(campaign.synced_at)}
          </div>
        </div>
      </div>

      <div className="kpi-row" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-label"><span className="base-mark"/> Leads</div>
          <div className="kpi-value num">{fmtNum(campaign.leads)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><span className="base-mark"/> Impressões</div>
          <div className="kpi-value num">{fmtNum(campaign.impressions)}</div>
          <div className="kpi-sub num">{fmtNum(campaign.clicks)} cliques · CTR {ctr}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><span className="base-mark"/> Gasto</div>
          <div className="kpi-value num">{fmtBRL(Number(campaign.spend))}</div>
          <div className="kpi-sub num">CPL {fmtBRL(Number(campaign.cpl))}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><span className="base-mark"/> ROAS</div>
          <div className="kpi-value num" style={{ color: Number(campaign.roas) > 0 ? 'var(--gold)' : 'var(--text)' }}>
            {Number(campaign.roas) > 0 ? fmtROAS(Number(campaign.roas)) : '—'}
          </div>
          <div className="kpi-sub num">{Number(campaign.purchase_value) > 0 ? fmtBRL(Number(campaign.purchase_value)) : 'sem receita atribuída'}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><div className="panel-title">Todas as métricas</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {[
            { l: 'Impressões',   v: fmtNum(campaign.impressions) },
            { l: 'Cliques',      v: fmtNum(campaign.clicks) },
            { l: 'CTR',          v: ctr },
            { l: 'Leads',        v: fmtNum(campaign.leads) },
            { l: 'Compras',      v: fmtNum(campaign.purchases) },
            { l: 'Receita',      v: Number(campaign.purchase_value) > 0 ? fmtBRL(Number(campaign.purchase_value)) : '—' },
            { l: 'Gasto',        v: fmtBRL(Number(campaign.spend)) },
            { l: 'CPL',          v: fmtBRL(Number(campaign.cpl)) },
            { l: 'ROAS',         v: Number(campaign.roas) > 0 ? fmtROAS(Number(campaign.roas)) : '—' },
          ].map(m => (
            <div key={m.l}>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 4, fontWeight: 500 }}>{m.l}</div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: 20 }}>{m.v}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
