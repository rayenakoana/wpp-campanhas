import { useState, useEffect, useCallback, useRef } from 'react'
import { supabaseWpp } from '../../lib/supabase'

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

interface WppCampanha {
  id: string
  name: string
  status: string
  started_at: string | null
  completed_at: string | null
  created_at: string
  total_envios: number
  entregues: number
  lidos: number
  falhas: number
  custo_total: number
}

interface DealStageRow {
  stage_id: string
  pipeline_id: string
  last_fired_stage_id: string | null
}

interface FunilStep {
  label: string
  sub: string
  gold: boolean
  count: number
}

// Série diária agrupada por data
interface DailyPoint {
  date: string
  leads: number
  spend: number
  cpl: number
  impressions: number
  clicks: number
}

interface CampaignSeries {
  campaign_id: string
  campaign_name: string
  color: string
  points: DailyPoint[]
  total_leads: number
  total_spend: number
  total_impressions: number
  total_clicks: number
  avg_cpl: number
}

type Tab = 'geral' | 'campanha' | 'funil'
type SubTab = 'wpp' | 'ads'
type DatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'this_month' | 'last_month'
type ChartMetric = 'leads' | 'spend' | 'cpl'

const SUPABASE_URL = 'https://syecwttpsvrmhdvinjmt.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5ZWN3dHRwc3ZybWhkdmluam10Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzk1NDgxMywiZXhwIjoyMDk5NTMwODEzfQ.4q7pNim34eP-n38pANB9g7Lud-Y20TU4-VFA5f5WaGo'

const CAMPAIGN_COLORS = ['#C8172A', '#E8A020', '#2E7D52', '#5B6EE8', '#9C27B0']

const STAGE_EVENT_MAP: Record<string, string> = {
  '69d7f7289d0388002677317a': 'Lead',
}

const EVENT_ORDER = ['Lead', 'CompleteRegistration', 'Schedule', 'InitiateCheckout', 'Purchase']
const EVENT_LABELS: Record<string, { label: string; sub: string; gold: boolean }> = {
  Lead:                 { label: 'Lead',                 sub: 'Contato Feito / Realizado',  gold: false },
  CompleteRegistration: { label: 'CompleteRegistration', sub: 'Identificação de Interesse', gold: false },
  Schedule:             { label: 'Schedule',             sub: 'Reunião',                    gold: false },
  InitiateCheckout:     { label: 'InitiateCheckout',     sub: 'Negociação',                 gold: false },
  Purchase:             { label: 'Purchase',             sub: 'Fechado',                    gold: true  },
}

const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Hoje', yesterday: 'Ontem', '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias', this_month: 'Este mês', last_month: 'Mês passado',
}

const FUNIL_MAP = [
  { name: 'Segredos da Confecção', pixel: '2078737449416859', kws: ['SEGREDOS', 'SC |', 'SC|'] },
  { name: 'Imersão Paraguai',       pixel: '1012804927965896', kws: ['PARAGUAI', 'PY |', 'PY|'] },
  { name: 'Supplytex',              pixel: '961390553583140',  kws: ['SUPPLYTEX', 'SX |', 'SX|'] },
  { name: 'Funil Diagnóstico',      pixel: '2006103380028816', kws: ['DIAGNÓSTICO', 'DIAG |', 'DIAG|'] },
]

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  switch (preset) {
    case 'today':       return { from: fmt(now), to: fmt(now) }
    case 'yesterday': { const y = new Date(now); y.setDate(y.getDate() - 1); return { from: fmt(y), to: fmt(y) } }
    case '7d':        { const s = new Date(now); s.setDate(s.getDate() - 6); return { from: fmt(s), to: fmt(now) } }
    case '30d':       { const s = new Date(now); s.setDate(s.getDate() - 29); return { from: fmt(s), to: fmt(now) } }
    case 'this_month':{ const s = new Date(now.getFullYear(), now.getMonth(), 1); return { from: fmt(s), to: fmt(now) } }
    case 'last_month':{ const s = new Date(now.getFullYear(), now.getMonth()-1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); return { from: fmt(s), to: fmt(e) } }
  }
}

function fmtBRL(v: number) {
  if (v >= 1000) return `R$ ${(v/1000).toFixed(1).replace('.', ',')} mil`
  return `R$ ${Number(v).toFixed(2).replace('.', ',')}`
}
function fmtNum(v: number) { return v.toLocaleString('pt-BR') }
function fmtROAS(v: number) { return `${Number(v).toFixed(1).replace('.', ',')}x` }
function fmtShortDate(d: string) {
  const [,m,day] = d.split('-')
  return `${day}/${m}`
}
function timeSince(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return 'agora'
  if (diff < 60) return `há ${diff} min`
  return `há ${Math.floor(diff/60)}h`
}

// ─── Fetches ─────────────────────────────────────────────────────────────────

async function fetchMetaInsights(from: string, to: string): Promise<MetaAdsInsight[]> {
  // Busca dados diários no intervalo
  const url = `${SUPABASE_URL}/rest/v1/meta_ads_insights?date_start=gte.${from}&date_start=lte.${to}&order=date_start.asc&limit=1000`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY, 'Accept-Profile': 'wpp' },
  })
  if (!res.ok) throw new Error(`meta_ads_insights ${res.status}`)
  const rows: MetaAdsInsight[] = await res.json()

  // Se não há dados no intervalo, pega o mais recente disponível (fallback)
  if (rows.length === 0) {
    const url2 = `${SUPABASE_URL}/rest/v1/meta_ads_insights?order=synced_at.desc&limit=100`
    const res2 = await fetch(url2, {
      headers: { Authorization: `Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY, 'Accept-Profile': 'wpp' },
    })
    if (!res2.ok) return []
    const rows2: MetaAdsInsight[] = await res2.json()
    // dedup por campaign_id — só o mais recente
    const seen = new Set<string>()
    return rows2.filter(r => { if (seen.has(r.campaign_id)) return false; seen.add(r.campaign_id); return true })
      .map(r => ({ ...r, spend: Number(r.spend), leads: Number(r.leads), impressions: Number(r.impressions), clicks: Number(r.clicks), cpl: Number(r.cpl), roas: Number(r.roas), purchase_value: Number(r.purchase_value), purchases: Number(r.purchases) }))
  }

  return rows.map(r => ({
    ...r,
    spend: Number(r.spend), leads: Number(r.leads), impressions: Number(r.impressions),
    clicks: Number(r.clicks), cpl: Number(r.cpl), roas: Number(r.roas),
    purchase_value: Number(r.purchase_value), purchases: Number(r.purchases),
  }))
}

function buildCampaignSeries(rows: MetaAdsInsight[]): CampaignSeries[] {
  // Agrupa por campaign_id, constrói série diária
  const byCampaign: Record<string, MetaAdsInsight[]> = {}
  for (const r of rows) {
    if (!byCampaign[r.campaign_id]) byCampaign[r.campaign_id] = []
    byCampaign[r.campaign_id].push(r)
  }

  return Object.entries(byCampaign).map(([cid, rs], idx) => {
    const sorted = [...rs].sort((a, b) => a.date_start.localeCompare(b.date_start))
    const points: DailyPoint[] = sorted.map(r => ({
      date: r.date_start,
      leads: r.leads,
      spend: r.spend,
      cpl: r.cpl,
      impressions: r.impressions,
      clicks: r.clicks,
    }))
    const total_leads = rs.reduce((s, r) => s + r.leads, 0)
    const total_spend = rs.reduce((s, r) => s + r.spend, 0)
    const total_impressions = rs.reduce((s, r) => s + r.impressions, 0)
    const total_clicks = rs.reduce((s, r) => s + r.clicks, 0)
    return {
      campaign_id: cid,
      campaign_name: rs[0].campaign_name,
      color: CAMPAIGN_COLORS[idx % CAMPAIGN_COLORS.length],
      points,
      total_leads,
      total_spend,
      total_impressions,
      total_clicks,
      avg_cpl: total_leads > 0 ? total_spend / total_leads : 0,
    }
  }).sort((a, b) => b.total_spend - a.total_spend)
}

async function fetchWppCampanhas(from: string, to: string): Promise<WppCampanha[]> {
  const { data: campanhas, error: err1 } = await supabaseWpp
    .from('campaigns')
    .select('id, name, status, started_at, completed_at, created_at')
    .gte('created_at', `${from}T00:00:00Z`)
    .lte('created_at', `${to}T23:59:59Z`)
    .order('created_at', { ascending: false })
  if (err1) throw new Error(`campaigns: ${err1.message}`)
  if (!campanhas || campanhas.length === 0) return []
  const ids = campanhas.map((c: any) => c.id)
  const { data: envios, error: err2 } = await supabaseWpp.from('campaign_sends').select('campaign_id, status, cost').in('campaign_id', ids)
  if (err2) throw new Error(`campaign_sends: ${err2.message}`)
  const ep: Record<string, any[]> = {}
  for (const e of (envios ?? []) as any[]) { if (!ep[e.campaign_id]) ep[e.campaign_id] = []; ep[e.campaign_id].push(e) }
  return (campanhas as any[]).map((c: any) => {
    const es = ep[c.id] ?? []
    return { id: c.id, name: c.name, status: c.status, started_at: c.started_at, completed_at: c.completed_at, created_at: c.created_at,
      total_envios: es.length, entregues: es.filter((e: any) => ['delivered','read'].includes(e.status)).length,
      lidos: es.filter((e: any) => e.status === 'read').length, falhas: es.filter((e: any) => e.status === 'failed').length,
      custo_total: es.reduce((s: number, e: any) => s + (e.cost ? Number(e.cost) : 0), 0) }
  })
}

async function fetchFunilSteps(): Promise<FunilStep[]> {
  const url = `${SUPABASE_URL}/rest/v1/deal_stage_tracking?select=stage_id,pipeline_id,last_fired_stage_id&limit=5000`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY, 'Accept-Profile': 'public' } })
  if (!res.ok) throw new Error(`deal_stage_tracking ${res.status}`)
  const rows: DealStageRow[] = await res.json()
  const counts: Record<string, number> = {}
  for (const ev of EVENT_ORDER) counts[ev] = 0
  for (const row of rows) {
    const sid = row.last_fired_stage_id ?? row.stage_id
    const ev = STAGE_EVENT_MAP[sid]
    if (ev) counts[ev]++
  }
  return EVENT_ORDER.map(ev => ({ ...EVENT_LABELS[ev], count: counts[ev] }))
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

function LineChart({ series, metric, height = 180 }: {
  series: CampaignSeries[]
  metric: ChartMetric
  height?: number
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; values: { name: string; color: string; value: number }[] } | null>(null)
  const [width, setWidth] = useState(800)

  useEffect(() => {
    if (!svgRef.current) return
    const obs = new ResizeObserver(es => setWidth(es[0].contentRect.width))
    obs.observe(svgRef.current.parentElement!)
    setWidth(svgRef.current.parentElement!.clientWidth)
    return () => obs.disconnect()
  }, [])

  if (series.length === 0 || series.every(s => s.points.length === 0)) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 13 }}>Sem dados</div>
  }

  // Coletar todas as datas únicas ordenadas
  const allDates = [...new Set(series.flatMap(s => s.points.map(p => p.date)))].sort()
  const getValue = (p: DailyPoint) => metric === 'leads' ? p.leads : metric === 'spend' ? p.spend : p.cpl

  // Construir lookup data→value por série
  const seriesData = series.map(s => {
    const map: Record<string, number> = {}
    for (const p of s.points) map[p.date] = getValue(p)
    return { ...s, map }
  })

  const pad = { top: 12, right: 16, bottom: 32, left: 52 }
  const W = width - pad.left - pad.right
  const H = height - pad.top - pad.bottom

  const allValues = seriesData.flatMap(s => allDates.map(d => s.map[d] ?? 0))
  const maxVal = Math.max(...allValues, 0.01)

  const xPos = (i: number) => allDates.length > 1 ? (i / (allDates.length - 1)) * W : W / 2
  const yPos = (v: number) => H - (v / maxVal) * H

  const pathD = (s: typeof seriesData[0]) => {
    const pts = allDates.map((d, i) => ({ x: xPos(i), y: yPos(s.map[d] ?? 0) }))
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  }

  const areaD = (s: typeof seriesData[0]) => {
    const pts = allDates.map((d, i) => ({ x: xPos(i), y: yPos(s.map[d] ?? 0) }))
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    return `${line} L${pts[pts.length-1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`
  }

  // Ticks Y
  const yTicks = 4
  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) => (maxVal / yTicks) * i)

  // Ticks X — mostrar no máximo 8 labels
  const step = Math.max(1, Math.ceil(allDates.length / 8))
  const xTickIdxs = allDates.map((_, i) => i).filter(i => i % step === 0 || i === allDates.length - 1)

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const mx = e.clientX - rect.left - pad.left
    const idx = Math.round((mx / W) * (allDates.length - 1))
    const clamped = Math.max(0, Math.min(allDates.length - 1, idx))
    const date = allDates[clamped]
    const values = seriesData.map(s => ({ name: s.campaign_name.replace(/\[|\]/g, ' ').trim(), color: s.color, value: s.map[date] ?? 0 }))
    setTooltip({ x: xPos(clamped) + pad.left, y: e.clientY - rect.top, date, values })
  }

  const fmtY = (v: number) => metric === 'spend' ? `R$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v.toFixed(0)}` : metric === 'cpl' ? `R$${v.toFixed(0)}` : String(Math.round(v))

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg ref={svgRef} width="100%" height={height} onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)} style={{ overflow: 'visible', display: 'block' }}>
        <defs>
          {seriesData.map(s => (
            <linearGradient key={s.campaign_id} id={`grad-${s.campaign_id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.15"/>
              <stop offset="100%" stopColor={s.color} stopOpacity="0"/>
            </linearGradient>
          ))}
        </defs>
        <g transform={`translate(${pad.left},${pad.top})`}>
          {/* Grid Y */}
          {yTickVals.map((v, i) => (
            <g key={i}>
              <line x1={0} y1={yPos(v)} x2={W} y2={yPos(v)} stroke="var(--line-soft)" strokeWidth={0.5} strokeDasharray="3,3"/>
              <text x={-6} y={yPos(v)+4} textAnchor="end" fontSize={10} fill="var(--text-3)">{fmtY(v)}</text>
            </g>
          ))}
          {/* Grid X labels */}
          {xTickIdxs.map(i => (
            <text key={i} x={xPos(i)} y={H+20} textAnchor="middle" fontSize={10} fill="var(--text-3)">{fmtShortDate(allDates[i])}</text>
          ))}
          {/* Área */}
          {seriesData.map(s => (
            <path key={`area-${s.campaign_id}`} d={areaD(s)} fill={`url(#grad-${s.campaign_id})`}/>
          ))}
          {/* Linhas */}
          {seriesData.map(s => (
            <path key={`line-${s.campaign_id}`} d={pathD(s)} fill="none" stroke={s.color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"/>
          ))}
          {/* Crosshair */}
          {tooltip && (
            <line
              x1={tooltip.x - pad.left} y1={0}
              x2={tooltip.x - pad.left} y2={H}
              stroke="var(--text-3)" strokeWidth={0.8} strokeDasharray="3,3"
            />
          )}
        </g>
      </svg>
      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'absolute', top: Math.max(8, tooltip.y - 70), left: Math.min(tooltip.x + 10, width - 180),
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8,
          padding: '8px 12px', fontSize: 12, pointerEvents: 'none', zIndex: 50,
          boxShadow: '0 8px 24px rgba(0,0,0,.2)',
        }}>
          <div style={{ color: 'var(--text-3)', marginBottom: 5, fontWeight: 600 }}>{fmtShortDate(tooltip.date)}</div>
          {tooltip.values.map(v => (
            <div key={v.name} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.color, flexShrink: 0 }}/>
              <span style={{ color: 'var(--text-2)', flex: 1, fontSize: 11 }}>{v.name.split(' ').slice(0,2).join(' ')}</span>
              <span style={{ fontWeight: 600, fontFamily: 'Barlow Condensed, sans-serif' }}>
                {metric === 'spend' || metric === 'cpl' ? fmtBRL(v.value) : fmtNum(v.value)}
              </span>
            </div>
          ))}
        </div>
      )}
      {/* Legenda */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
        {seriesData.map(s => (
          <div key={s.campaign_id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-2)' }}>
            <span style={{ width: 20, height: 2, background: s.color, display: 'inline-block', borderRadius: 1 }}/>
            {s.campaign_name.replace(/\[|\]/g, ' ').replace(/\s+/g, ' ').trim()}
          </div>
        ))}
      </div>
    </div>
  )
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
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
        {label}
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth={1.6}><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: 12, width: 300, boxShadow: '0 16px 40px rgba(0,0,0,.25)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 12 }}>
            {(Object.keys(PRESET_LABELS) as DatePreset[]).map(p => (
              <div key={p} onClick={() => { setPreset(p); setOpen(false) }}
                style={{ padding: '7px 10px', fontSize: 12.5, borderRadius: 6, cursor: 'pointer', fontWeight: 500, color: preset === p ? 'var(--text)' : 'var(--text-2)', background: preset === p ? 'rgba(255,255,255,0.06)' : 'transparent', boxShadow: preset === p ? 'inset 0 0 0 1px var(--line)' : 'none' }}
              >{PRESET_LABELS[p]}</div>
            ))}
          </div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text-3)', marginBottom: 7, fontWeight: 600 }}>Período personalizado</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="input" style={{ fontSize: 12.5, padding: '7px 9px', width: '100%', minWidth: 0, boxSizing: 'border-box' }} />
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="input" style={{ fontSize: 12.5, padding: '7px 9px', width: '100%', minWidth: 0, boxSizing: 'border-box' }} />
          </div>
          <button className="btn primary" style={{ width: '100%', justifyContent: 'center', fontSize: 12.5 }} onClick={() => { if (customFrom && customTo) { setPreset('custom'); setOpen(false) } }}>Aplicar</button>
        </div>
      )}
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function Radar() {
  const [tab, setTab] = useState<Tab>('geral')
  const [subTab, setSubTab] = useState<SubTab>('wpp')
  const [preset, setPreset] = useState<DatePreset | 'custom'>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const [allRows, setAllRows] = useState<MetaAdsInsight[]>([])
  const [campaignSeries, setCampaignSeries] = useState<CampaignSeries[]>([])
  const [wppCampanhas, setWppCampanhas] = useState<WppCampanha[]>([])
  const [funilSteps, setFunilSteps] = useState<FunilStep[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [detail, setDetail] = useState<CampaignSeries | null>(null)
  const [dateLabel, setDateLabel] = useState('Últimos 30 dias')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const range = preset === 'custom' ? { from: customFrom, to: customTo } : getDateRange(preset as DatePreset)
      const [rows, wppData, funilData] = await Promise.all([
        fetchMetaInsights(range.from, range.to),
        fetchWppCampanhas(range.from, range.to),
        fetchFunilSteps(),
      ])
      setAllRows(rows)
      setCampaignSeries(buildCampaignSeries(rows))
      setWppCampanhas(wppData)
      setFunilSteps(funilData)
      const latest = rows.reduce((a, b) => a.synced_at > b.synced_at ? a : b, rows[0])
      setSyncedAt(latest?.synced_at ?? new Date().toISOString())
      setDateLabel(preset === 'custom' ? `${customFrom} – ${customTo}` : PRESET_LABELS[preset as DatePreset])
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [preset, customFrom, customTo])

  useEffect(() => { load() }, [load])

  // KPIs globais
  const totalLeads  = campaignSeries.reduce((s, c) => s + c.total_leads, 0)
  const totalSpend  = campaignSeries.reduce((s, c) => s + c.total_spend, 0)
  const totalRev    = allRows.reduce((s, r) => s + r.purchase_value, 0)
  const avgCPL      = totalLeads > 0 ? totalSpend / totalLeads : 0
  const avgROAS     = totalSpend > 0 ? totalRev / totalSpend : 0
  const leadCount   = funilSteps.find(s => s.label === 'Lead')?.count ?? 0

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 className="font-display font-semibold text-2xl">Radar de Conversões</h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: campaignSeries.length > 0 ? 'var(--green)' : 'var(--text-3)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: campaignSeries.length > 0 ? 'var(--green)' : 'var(--text-3)', display: 'inline-block' }}/>
              {loading ? 'Sincronizando...' : syncedAt ? `Sincronizado ${timeSince(syncedAt)}` : 'Aguardando dados'}
            </span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-3)', marginTop: 4 }}>Gasto, CPL e ROAS · Meta Ads + Campanhas WhatsApp · {dateLabel}</p>
        </div>
        <DateFilter preset={preset} setPreset={setPreset} customFrom={customFrom} setCustomFrom={setCustomFrom} customTo={customTo} setCustomTo={setCustomTo} label={dateLabel} />
      </div>

      {!detail && (
        <div className="tabs">
          {(['geral', 'campanha', 'funil'] as Tab[]).map(t => (
            <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t === 'geral' ? 'Visão Geral' : t === 'campanha' ? 'Por Campanha' : 'Por Funil'}
            </button>
          ))}
        </div>
      )}

      {error && <div className="panel" style={{ padding: '12px 16px', marginBottom: 20, color: '#f87171', fontSize: 13 }}>⚠ Erro ao carregar: {error}</div>}

      {loading ? (
        <div className="panel" style={{ padding: 40, fontSize: 13, color: 'var(--text-2)', textAlign: 'center' }}>Carregando...</div>
      ) : detail ? (
        <DetailView series={detail} onBack={() => setDetail(null)} />
      ) : tab === 'geral' ? (
        <GeralView campaignSeries={campaignSeries} wppCampanhas={wppCampanhas} funilSteps={funilSteps} totalLeads={totalLeads} totalSpend={totalSpend} totalRev={totalRev} avgCPL={avgCPL} avgROAS={avgROAS} leadCount={leadCount} />
      ) : tab === 'campanha' ? (
        <CampanhaView campaignSeries={campaignSeries} wppCampanhas={wppCampanhas} subTab={subTab} setSubTab={setSubTab} onDetail={setDetail} />
      ) : (
        <FunilView campaignSeries={campaignSeries} onDetail={setDetail} />
      )}
    </div>
  )
}

// ─── Visão Geral ─────────────────────────────────────────────────────────────

function GeralView({ campaignSeries, wppCampanhas, funilSteps, totalLeads, totalSpend, totalRev, avgCPL, avgROAS, leadCount }: {
  campaignSeries: CampaignSeries[]; wppCampanhas: WppCampanha[]; funilSteps: FunilStep[]
  totalLeads: number; totalSpend: number; totalRev: number; avgCPL: number; avgROAS: number; leadCount: number
}) {
  const [metric, setMetric] = useState<ChartMetric>('leads')
  const totalWppEnvios    = wppCampanhas.reduce((s, c) => s + c.total_envios, 0)
  const totalWppEntregues = wppCampanhas.reduce((s, c) => s + c.entregues, 0)
  const totalWppLidos     = wppCampanhas.reduce((s, c) => s + c.lidos, 0)
  const totalWppCusto     = wppCampanhas.reduce((s, c) => s + c.custo_total, 0)

  const METRIC_OPTS: { key: ChartMetric; label: string }[] = [
    { key: 'leads', label: 'Leads / dia' },
    { key: 'spend', label: 'Gasto / dia' },
    { key: 'cpl',   label: 'CPL / dia' },
  ]

  return (
    <>
      {/* KPIs Meta Ads */}
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-3)', fontWeight: 600, marginBottom: 8 }}>Meta Ads</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Leads gerados', value: fmtNum(totalLeads), sub: `${campaignSeries.length} campanhas` },
          { label: 'Gasto total', value: fmtBRL(totalSpend), sub: `CPL médio ${fmtBRL(avgCPL)}` },
          { label: 'Receita atribuída', value: fmtBRL(totalRev), sub: 'eventos Purchase (CAPI)', gold: true },
          { label: 'ROAS médio', value: fmtROAS(avgROAS), sub: 'receita ÷ gasto' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label"><span className="base-mark"/> {k.label}</div>
            <div className="kpi-value num" style={k.gold ? { color: 'var(--gold)' } : {}}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Gráfico principal */}
      {campaignSeries.length > 0 && campaignSeries[0].points.length > 1 && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="panel-title">Evolução diária <span>por campanha</span></div>
            <div style={{ display: 'flex', gap: 4 }}>
              {METRIC_OPTS.map(m => (
                <button key={m.key} onClick={() => setMetric(m.key)}
                  style={{ padding: '4px 10px', fontSize: 11.5, borderRadius: 5, border: 'none', cursor: 'pointer', fontWeight: 500,
                    background: metric === m.key ? 'var(--red)' : 'transparent',
                    color: metric === m.key ? '#fff' : 'var(--text-3)' }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <LineChart series={campaignSeries} metric={metric} height={200} />
        </div>
      )}

      {/* Tabela resumo campanhas */}
      {campaignSeries.length > 0 && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="panel-head"><div className="panel-title">Campanhas Meta Ads <span>resumo do período</span></div></div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Campanha</th>
                <th className="r">Leads</th>
                <th className="r">Impressões</th>
                <th className="r">Cliques</th>
                <th className="r">CTR</th>
                <th className="r">Gasto</th>
                <th className="r">CPL</th>
              </tr>
            </thead>
            <tbody>
              {campaignSeries.map(s => {
                const ctr = s.total_impressions > 0 ? `${((s.total_clicks / s.total_impressions) * 100).toFixed(2).replace('.', ',')}%` : '—'
                return (
                  <tr key={s.campaign_id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }}/>
                        <div className="row-title" style={{ fontSize: 12.5 }}>{s.campaign_name.replace(/\[|\]/g,' ').replace(/\s+/g,' ').trim()}</div>
                      </div>
                    </td>
                    <td className="r cell-num num">{fmtNum(s.total_leads)}</td>
                    <td className="r num">{fmtNum(s.total_impressions)}</td>
                    <td className="r num">{fmtNum(s.total_clicks)}</td>
                    <td className="r num">{ctr}</td>
                    <td className="r num">{fmtBRL(s.total_spend)}</td>
                    <td className="r num">{fmtBRL(s.avg_cpl)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* KPIs WPP */}
      {wppCampanhas.length > 0 && (
        <>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-3)', fontWeight: 600, marginBottom: 8 }}>Campanhas WhatsApp</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
            {[
              { label: 'Disparos totais', value: fmtNum(totalWppEnvios), sub: `${wppCampanhas.length} campanhas` },
              { label: 'Entregues', value: fmtNum(totalWppEntregues), sub: totalWppEnvios > 0 ? `${((totalWppEntregues/totalWppEnvios)*100).toFixed(1).replace('.',',')}% de entrega` : '—' },
              { label: 'Taxa de leitura', value: totalWppEntregues > 0 ? `${((totalWppLidos/totalWppEntregues)*100).toFixed(1).replace('.',',')}%` : '—', sub: `${fmtNum(totalWppLidos)} lidas` },
              { label: 'Custo WPP', value: fmtBRL(totalWppCusto), sub: totalWppEnvios > 0 ? `${fmtBRL(totalWppCusto/totalWppEnvios)} por disparo` : '—' },
            ].map(k => (
              <div key={k.label} className="kpi-card">
                <div className="kpi-label"><span className="base-mark"/> {k.label}</div>
                <div className="kpi-value num">{k.value}</div>
                <div className="kpi-sub">{k.sub}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Funil CRM → CAPI */}
      <div className="panel">
        <div className="panel-head"><div className="panel-title">Funil CRM → CAPI <span>disparos registrados</span></div></div>
        {funilSteps.every(s => s.count === 0) ? (
          <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '16px 0', textAlign: 'center' }}>Aguardando disparos registrados pelo workflow N8N.</div>
        ) : (
          <div className="conv-funnel">
            {funilSteps.map(step => {
              const pct = leadCount > 0 ? (step.count / leadCount) * 100 : step.count > 0 ? 100 : 0
              return (
                <div className="conv-step" key={step.label}>
                  <div className="step-name">{step.label}<small>{step.sub}</small></div>
                  <div className="conv-track">
                    <div className="conv-fill" style={{ width: `${Math.min(pct, 100)}%`, background: step.gold ? 'var(--gold)' : 'var(--red)', opacity: pct === 0 ? 0.15 : 1 }}/>
                  </div>
                  <div className="conv-nums">
                    <span className="conv-abs num" style={{ color: step.gold ? 'var(--gold)' : step.count === 0 ? 'var(--text-3)' : 'var(--text)' }}>{step.count > 0 ? fmtNum(step.count) : '—'}</span>
                    <span className="conv-rel num">{pct > 0 ? `${pct.toFixed(1).replace('.',',')}%` : 'aguardando'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Por Campanha ─────────────────────────────────────────────────────────────

function CampanhaView({ campaignSeries, wppCampanhas, subTab, setSubTab, onDetail }: {
  campaignSeries: CampaignSeries[]; wppCampanhas: WppCampanha[]
  subTab: SubTab; setSubTab: (s: SubTab) => void; onDetail: (s: CampaignSeries) => void
}) {
  return (
    <>
      <div style={{ display: 'flex', gap: 18, marginBottom: 18, borderBottom: '1px solid var(--line-soft)' }}>
        {(['wpp', 'ads'] as SubTab[]).map(s => (
          <div key={s} onClick={() => setSubTab(s)} style={{ padding: '0 2px 10px', fontSize: 13, fontWeight: 500, cursor: 'pointer', marginBottom: -1, color: subTab === s ? 'var(--text)' : 'var(--text-3)', borderBottom: subTab === s ? '1.5px solid var(--red)' : '1.5px solid transparent' }}>
            {s === 'wpp' ? 'Campanhas de WhatsApp' : 'Campanhas Meta Ads'}
          </div>
        ))}
      </div>

      {subTab === 'wpp' ? (
        wppCampanhas.length === 0 ? (
          <div className="panel" style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: 40 }}>Nenhuma campanha de WhatsApp no período.</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Campanha WhatsApp</th><th className="r">Disparos</th><th className="r">Entregues</th><th className="r">Lidos</th><th className="r">Falhas</th><th className="r">Custo</th></tr></thead>
            <tbody>
              {wppCampanhas.map(c => (
                <tr key={c.id}>
                  <td>
                    <div className="row-title">{c.name}</div>
                    <div className="row-sub">{c.status === 'completed' ? 'Concluída' : c.status === 'running' ? 'Em andamento' : c.status}{c.completed_at ? ` · ${new Date(c.completed_at).toLocaleDateString('pt-BR')}` : ''}</div>
                  </td>
                  <td className="r cell-num num">{fmtNum(c.total_envios)}</td>
                  <td className="r num">{fmtNum(c.entregues)} <span style={{ color: 'var(--text-3)', fontSize: 11.5 }}>{c.total_envios > 0 ? `${((c.entregues/c.total_envios)*100).toFixed(0)}%` : ''}</span></td>
                  <td className="r num">{fmtNum(c.lidos)} <span style={{ color: 'var(--text-3)', fontSize: 11.5 }}>{c.entregues > 0 ? `${((c.lidos/c.entregues)*100).toFixed(0)}%` : ''}</span></td>
                  <td className="r num" style={{ color: c.falhas > 0 ? '#f87171' : 'var(--text-3)' }}>{c.falhas > 0 ? fmtNum(c.falhas) : '—'}</td>
                  <td className="r num">{c.custo_total > 0 ? fmtBRL(c.custo_total) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : (
        campaignSeries.length === 0 ? (
          <div className="panel" style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: 40 }}>Nenhuma campanha Meta Ads no período.</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Campanha</th><th className="r">Leads</th><th className="r">Impressões</th><th className="r">Cliques</th><th className="r">CTR</th><th className="r">Gasto</th><th className="r">CPL</th><th></th></tr></thead>
            <tbody>
              {campaignSeries.map(s => {
                const ctr = s.total_impressions > 0 ? `${((s.total_clicks/s.total_impressions)*100).toFixed(2).replace('.',',')}%` : '—'
                return (
                  <tr key={s.campaign_id} className="rowlink" onClick={() => onDetail(s)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }}/>
                        <div className="row-title">{s.campaign_name.replace(/\[|\]/g,' ').replace(/\s+/g,' ').trim()}</div>
                      </div>
                    </td>
                    <td className="r cell-num num">{fmtNum(s.total_leads)}</td>
                    <td className="r num">{fmtNum(s.total_impressions)}</td>
                    <td className="r num">{fmtNum(s.total_clicks)}</td>
                    <td className="r num">{ctr}</td>
                    <td className="r num">{fmtBRL(s.total_spend)}</td>
                    <td className="r num">{fmtBRL(s.avg_cpl)}</td>
                    <td className="arrow-cell">›</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )
      )}
    </>
  )
}

// ─── Por Funil ────────────────────────────────────────────────────────────────

function FunilView({ campaignSeries, onDetail }: { campaignSeries: CampaignSeries[]; onDetail: (s: CampaignSeries) => void }) {
  const funis = FUNIL_MAP.map(f => {
    const matching = campaignSeries.filter(s => f.kws.some(kw => s.campaign_name.toUpperCase().includes(kw.toUpperCase())))
    const leads  = matching.reduce((s, c) => s + c.total_leads, 0)
    const spend  = matching.reduce((s, c) => s + c.total_spend, 0)
    const cpl    = leads > 0 ? spend / leads : 0
    return { ...f, leads, spend, cpl, matching }
  })
  return (
    <table className="data-table">
      <thead><tr><th>Funil (RD CRM)</th><th className="r">Leads</th><th className="r">Impressões</th><th className="r">Gasto</th><th className="r">CPL</th><th className="r">Receita</th><th className="r">ROAS</th><th></th></tr></thead>
      <tbody>
        {funis.map(f => (
          <tr key={f.name} className={f.leads > 0 ? 'rowlink' : ''} onClick={() => f.matching.length > 0 && onDetail(f.matching[0])}>
            <td style={{ color: f.leads === 0 ? 'var(--text-3)' : 'var(--text)' }}>
              <div className="row-title" style={{ color: 'inherit' }}>{f.name}</div>
              <div className="row-sub">Pixel {f.pixel}</div>
            </td>
            <td className="r num" style={{ color: f.leads === 0 ? 'var(--text-3)' : undefined }}>{f.leads > 0 ? fmtNum(f.leads) : '—'}</td>
            <td className="r num" style={{ color: f.leads === 0 ? 'var(--text-3)' : undefined }}>{f.matching.length > 0 ? fmtNum(f.matching.reduce((s,c) => s+c.total_impressions, 0)) : '—'}</td>
            <td className="r num" style={{ color: f.spend === 0 ? 'var(--text-3)' : undefined }}>{f.spend > 0 ? fmtBRL(f.spend) : '—'}</td>
            <td className="r num" style={{ color: f.cpl === 0 ? 'var(--text-3)' : undefined }}>{f.cpl > 0 ? fmtBRL(f.cpl) : '—'}</td>
            <td className="r cell-gold num"><span style={{ color: 'var(--text-3)' }}>—</span></td>
            <td className="r num" style={{ color: 'var(--text-3)' }}>—</td>
            <td className="arrow-cell">{f.leads > 0 ? '›' : ''}</td>
          </tr>
        ))}
        <tr>
          <td colSpan={8} style={{ color: 'var(--text-3)' }}>
            <div className="row-title" style={{ color: 'var(--text-3)' }}>Europa · China · C$ Club</div>
            <div className="row-sub">Aguardando compartilhamento dos pixels</div>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

// ─── Detalhe de campanha ──────────────────────────────────────────────────────

function DetailView({ series, onBack }: { series: CampaignSeries; onBack: () => void }) {
  const [metric, setMetric] = useState<ChartMetric>('leads')
  const ctr = series.total_impressions > 0 ? `${((series.total_clicks/series.total_impressions)*100).toFixed(2).replace('.',',')}%` : '—'

  const METRIC_OPTS: { key: ChartMetric; label: string }[] = [
    { key: 'leads', label: 'Leads' },
    { key: 'spend', label: 'Gasto' },
    { key: 'cpl',   label: 'CPL' },
  ]

  return (
    <div style={{ maxWidth: '100%' }}>
      <div onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer', marginBottom: 20, fontWeight: 500 }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}>
        ← Voltar
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: series.color, flexShrink: 0 }}/>
          <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: 'clamp(18px,3vw,26px)', lineHeight: 1.2, wordBreak: 'break-word' }}>
            {series.campaign_name.replace(/\[|\]/g,' ').replace(/\s+/g,' ').trim()}
          </h2>
        </div>
        <div style={{ color: 'var(--text-3)', fontSize: 12.5 }}>
          {series.points[0]?.date} → {series.points[series.points.length-1]?.date} · {series.points.length} dias de dados
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Leads', value: fmtNum(series.total_leads) },
          { label: 'Impressões', value: fmtNum(series.total_impressions), sub: `${fmtNum(series.total_clicks)} cliques · CTR ${ctr}` },
          { label: 'Gasto total', value: fmtBRL(series.total_spend), sub: `CPL ${fmtBRL(series.avg_cpl)}` },
          { label: 'Melhor dia', value: (() => { const best = [...series.points].sort((a,b) => b.leads - a.leads)[0]; return best ? `${fmtNum(best.leads)} leads` : '—' })(), sub: (() => { const best = [...series.points].sort((a,b) => b.leads - a.leads)[0]; return best ? fmtShortDate(best.date) : '' })() },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label"><span className="base-mark"/> {k.label}</div>
            <div className="kpi-value num">{k.value}</div>
            {k.sub && <div className="kpi-sub num">{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Gráfico detalhe */}
      {series.points.length > 1 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="panel-title">Evolução diária</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {METRIC_OPTS.map(m => (
                <button key={m.key} onClick={() => setMetric(m.key)}
                  style={{ padding: '4px 10px', fontSize: 11.5, borderRadius: 5, border: 'none', cursor: 'pointer', fontWeight: 500, background: metric === m.key ? 'var(--red)' : 'transparent', color: metric === m.key ? '#fff' : 'var(--text-3)' }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <LineChart series={[series]} metric={metric} height={200} />
        </div>
      )}

      {/* Tabela diária */}
      <div className="panel">
        <div className="panel-head"><div className="panel-title">Dados diários</div></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>Data</th><th className="r">Leads</th><th className="r">Impressões</th><th className="r">Cliques</th><th className="r">CTR</th><th className="r">Gasto</th><th className="r">CPL</th></tr></thead>
            <tbody>
              {[...series.points].reverse().map(p => {
                const ctr = p.impressions > 0 ? `${((p.clicks/p.impressions)*100).toFixed(2).replace('.',',')}%` : '—'
                return (
                  <tr key={p.date}>
                    <td style={{ fontWeight: 500 }}>{fmtShortDate(p.date)}</td>
                    <td className="r cell-num num">{fmtNum(p.leads)}</td>
                    <td className="r num">{fmtNum(p.impressions)}</td>
                    <td className="r num">{fmtNum(p.clicks)}</td>
                    <td className="r num">{ctr}</td>
                    <td className="r num">{fmtBRL(p.spend)}</td>
                    <td className="r num">{p.cpl > 0 ? fmtBRL(p.cpl) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
