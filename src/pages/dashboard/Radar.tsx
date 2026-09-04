import { useState, useEffect, useCallback } from 'react'
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

type Tab = 'geral' | 'campanha' | 'funil'
type SubTab = 'wpp' | 'ads'
type DatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'this_month' | 'last_month'

const SUPABASE_URL = 'https://syecwttpsvrmhdvinjmt.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5ZWN3dHRwc3ZybWhkdmluam10Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzk1NDgxMywiZXhwIjoyMDk5NTMwODEzfQ.4q7pNim34eP-n38pANB9g7Lud-Y20TU4-VFA5f5WaGo'

// ─── Mapa stage_id → evento CAPI ─────────────────────────────────────────────
// stage_id confirmado na memória: Diagnóstico BASE = Lead
// Demais pipelines: adicionar IDs reais após GET /deal_pipelines no N8N
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
    case 'last_month':{
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

// ─── Fetches ─────────────────────────────────────────────────────────────────

async function fetchMetaInsights(from: string, to: string): Promise<MetaAdsInsight[]> {
  const url = `${SUPABASE_URL}/rest/v1/meta_ads_insights?date_start=gte.${from}&date_stop=lte.${to}&order=spend.desc&limit=1000`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      'Accept-Profile': 'wpp',
    },
  })
  if (!res.ok) throw new Error(`meta_ads_insights ${res.status}`)
  const rows: MetaAdsInsight[] = await res.json()

  // Agregar por campaign_id (múltiplas linhas diárias → uma por campanha)
  const byId: Record<string, MetaAdsInsight> = {}
  for (const r of rows) {
    if (!byId[r.campaign_id]) {
      byId[r.campaign_id] = { ...r, impressions: 0, clicks: 0, spend: 0, leads: 0, purchases: 0, purchase_value: 0 }
    }
    const agg = byId[r.campaign_id]
    agg.impressions    += Number(r.impressions)
    agg.clicks         += Number(r.clicks)
    agg.spend          += Number(r.spend)
    agg.leads          += Number(r.leads)
    agg.purchases      += Number(r.purchases)
    agg.purchase_value += Number(r.purchase_value)
  }

  return Object.values(byId).map(r => ({
    ...r,
    cpl:  r.leads > 0 ? r.spend / r.leads : 0,
    roas: r.spend > 0 ? r.purchase_value / r.spend : 0,
  })).sort((a, b) => b.spend - a.spend)
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

  const { data: envios, error: err2 } = await supabaseWpp
    .from('campaign_sends')
    .select('campaign_id, status, cost')
    .in('campaign_id', ids)

  if (err2) throw new Error(`campaign_sends: ${err2.message}`)

  const enviosPorCampanha: Record<string, Array<{ status: string; cost: number | null }>> = {}
  for (const e of (envios ?? []) as any[]) {
    if (!enviosPorCampanha[e.campaign_id]) enviosPorCampanha[e.campaign_id] = []
    enviosPorCampanha[e.campaign_id].push(e)
  }

  return (campanhas as any[]).map((c: any) => {
    const es = enviosPorCampanha[c.id] ?? []
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      started_at: c.started_at,
      completed_at: c.completed_at,
      created_at: c.created_at,
      total_envios: es.length,
      entregues: es.filter((e: any) => e.status === 'delivered' || e.status === 'read').length,
      lidos: es.filter((e: any) => e.status === 'read').length,
      falhas: es.filter((e: any) => e.status === 'failed').length,
      custo_total: es.reduce((s: number, e: any) => s + (e.cost ? Number(e.cost) : 0), 0),
    }
  })
}

async function fetchFunilSteps(): Promise<FunilStep[]> {
  const url = `${SUPABASE_URL}/rest/v1/deal_stage_tracking?select=stage_id,pipeline_id,last_fired_stage_id&limit=5000`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      'Accept-Profile': 'public',
    },
  })
  if (!res.ok) throw new Error(`deal_stage_tracking ${res.status}`)
  const rows: DealStageRow[] = await res.json()

  const counts: Record<string, number> = {}
  for (const ev of EVENT_ORDER) counts[ev] = 0

  for (const row of rows) {
    const stageId = row.last_fired_stage_id ?? row.stage_id
    const evento = STAGE_EVENT_MAP[stageId]
    if (evento && counts[evento] !== undefined) counts[evento]++
  }

  return EVENT_ORDER.map(ev => ({ ...EVENT_LABELS[ev], count: counts[ev] }))
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
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 10, padding: 12, width: 300,
          boxShadow: '0 16px 40px rgba(0,0,0,.25)',
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8, overflow: 'hidden' }}>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="input" style={{ fontSize: 12.5, padding: '7px 9px', width: '100%', minWidth: 0, boxSizing: 'border-box' }} />
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="input" style={{ fontSize: 12.5, padding: '7px 9px', width: '100%', minWidth: 0, boxSizing: 'border-box' }} />
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

function BarFill({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="bartrack">
      <div className="barfill" style={{ width: `${pct}%` }} />
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

  const [insights, setInsights] = useState<MetaAdsInsight[]>([])
  const [wppCampanhas, setWppCampanhas] = useState<WppCampanha[]>([])
  const [funilSteps, setFunilSteps] = useState<FunilStep[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [detail, setDetail] = useState<MetaAdsInsight | null>(null)
  const [dateLabel, setDateLabel] = useState('Últimos 30 dias')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const range = preset === 'custom'
        ? { from: customFrom, to: customTo }
        : getDateRange(preset as DatePreset)

      const [metaData, wppData, funilData] = await Promise.all([
        fetchMetaInsights(range.from, range.to),
        fetchWppCampanhas(range.from, range.to),
        fetchFunilSteps(),
      ])

      setInsights(metaData)
      setWppCampanhas(wppData)
      setFunilSteps(funilData)
      setSyncedAt(metaData.length > 0 ? metaData[0].synced_at : new Date().toISOString())
      setDateLabel(preset === 'custom'
        ? `${customFrom} – ${customTo}`
        : PRESET_LABELS[preset as DatePreset])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [preset, customFrom, customTo])

  useEffect(() => { load() }, [load])

  const totalLeads = insights.reduce((s, r) => s + r.leads, 0)
  const totalSpend = insights.reduce((s, r) => s + Number(r.spend), 0)
  const totalRev   = insights.reduce((s, r) => s + Number(r.purchase_value), 0)
  const avgCPL     = totalLeads > 0 ? totalSpend / totalLeads : 0
  const avgROAS    = totalSpend > 0 ? totalRev / totalSpend : 0
  const maxSpend   = Math.max(...insights.map(r => Number(r.spend)), 1)
  const leadCount  = funilSteps.find(s => s.label === 'Lead')?.count ?? 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="font-display font-semibold text-2xl">Radar de Conversões</h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: insights.length > 0 ? 'var(--green)' : 'var(--text-3)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: insights.length > 0 ? 'var(--green)' : 'var(--text-3)', display: 'inline-block' }} />
              {loading ? 'Sincronizando...' : syncedAt ? `Sincronizado ${timeSince(syncedAt)}` : 'Aguardando dados'}
            </span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-3)', marginTop: 4 }}>
            Gasto, CPL e ROAS · Meta Ads + Campanhas WhatsApp · {dateLabel}
          </p>
        </div>
        <DateFilter preset={preset} setPreset={setPreset} customFrom={customFrom} setCustomFrom={setCustomFrom} customTo={customTo} setCustomTo={setCustomTo} label={dateLabel} />
      </div>

      <div className="tabs">
        {(['geral', 'campanha', 'funil'] as Tab[]).map(t => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => { setTab(t); setDetail(null) }}>
            {t === 'geral' ? 'Visão Geral' : t === 'campanha' ? 'Por Campanha' : 'Por Funil'}
          </button>
        ))}
      </div>

      {error && (
        <div className="panel" style={{ padding: '12px 16px', marginBottom: 20, color: '#f87171', fontSize: 13 }}>
          ⚠ Erro ao carregar: {error}
        </div>
      )}

      {loading ? (
        <div className="panel" style={{ padding: 40, fontSize: 13, color: 'var(--text-2)', textAlign: 'center' }}>Carregando...</div>
      ) : detail ? (
        <DetailView campaign={detail} onBack={() => setDetail(null)} />
      ) : tab === 'geral' ? (
        <GeralView insights={insights} wppCampanhas={wppCampanhas} funilSteps={funilSteps} totalLeads={totalLeads} totalSpend={totalSpend} totalRev={totalRev} avgCPL={avgCPL} avgROAS={avgROAS} maxSpend={maxSpend} leadCount={leadCount} />
      ) : tab === 'campanha' ? (
        <CampanhaView insights={insights} wppCampanhas={wppCampanhas} subTab={subTab} setSubTab={setSubTab} onDetail={setDetail} />
      ) : (
        <FunilView insights={insights} onDetail={setDetail} />
      )}
    </div>
  )
}

// ─── Visão Geral ─────────────────────────────────────────────────────────────

function GeralView({ insights, wppCampanhas, funilSteps, totalLeads, totalSpend, totalRev, avgCPL, avgROAS, maxSpend, leadCount }: {
  insights: MetaAdsInsight[]; wppCampanhas: WppCampanha[]; funilSteps: FunilStep[]
  totalLeads: number; totalSpend: number; totalRev: number
  avgCPL: number; avgROAS: number; maxSpend: number; leadCount: number
}) {
  const totalWppEnvios    = wppCampanhas.reduce((s, c) => s + c.total_envios, 0)
  const totalWppEntregues = wppCampanhas.reduce((s, c) => s + c.entregues, 0)
  const totalWppLidos     = wppCampanhas.reduce((s, c) => s + c.lidos, 0)
  const totalWppCusto     = wppCampanhas.reduce((s, c) => s + c.custo_total, 0)
  const maxWppEnvios      = Math.max(...wppCampanhas.map(c => c.total_envios), 1)

  return (
    <>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-3)', fontWeight: 600, marginBottom: 8 }}>Meta Ads</div>
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-label"><span className="base-mark"/> Leads gerados</div>
          <div className="kpi-value num">{fmtNum(totalLeads)}</div>
          <div className="kpi-sub">{insights.length} campanhas no período</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><span className="base-mark"/> Gasto total</div>
          <div className="kpi-value num">{fmtBRL(totalSpend)}</div>
          <div className="kpi-sub num">CPL médio {fmtBRL(avgCPL)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><span className="base-mark"/> Receita atribuída</div>
          <div className="kpi-value num" style={{ color: 'var(--gold)' }}>{fmtBRL(totalRev)}</div>
          <div className="kpi-sub">eventos Purchase (CAPI)</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><span className="base-mark"/> ROAS médio</div>
          <div className="kpi-value num">{fmtROAS(avgROAS)}</div>
          <div className="kpi-sub">receita ÷ gasto</div>
        </div>
      </div>

      {wppCampanhas.length > 0 && (
        <>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-3)', fontWeight: 600, marginBottom: 8 }}>Campanhas WhatsApp</div>
          <div className="kpi-row" style={{ marginBottom: 20 }}>
            <div className="kpi-card">
              <div className="kpi-label"><span className="base-mark"/> Disparos totais</div>
              <div className="kpi-value num">{fmtNum(totalWppEnvios)}</div>
              <div className="kpi-sub">{wppCampanhas.length} campanhas no período</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label"><span className="base-mark"/> Entregues</div>
              <div className="kpi-value num">{fmtNum(totalWppEntregues)}</div>
              <div className="kpi-sub num">{totalWppEnvios > 0 ? `${((totalWppEntregues / totalWppEnvios) * 100).toFixed(1).replace('.', ',')}% de entrega` : '—'}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label"><span className="base-mark"/> Taxa de leitura</div>
              <div className="kpi-value num">{totalWppEntregues > 0 ? `${((totalWppLidos / totalWppEntregues) * 100).toFixed(1).replace('.', ',')}%` : '—'}</div>
              <div className="kpi-sub">{fmtNum(totalWppLidos)} mensagens lidas</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label"><span className="base-mark"/> Custo WPP</div>
              <div className="kpi-value num">{fmtBRL(totalWppCusto)}</div>
              <div className="kpi-sub num">{totalWppEnvios > 0 ? `${fmtBRL(totalWppCusto / totalWppEnvios)} por disparo` : '—'}</div>
            </div>
          </div>
        </>
      )}

      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-head"><div className="panel-title">Campanhas Meta Ads <span>por gasto</span></div></div>
        {insights.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '24px 0', textAlign: 'center' }}>
            Nenhuma campanha Meta Ads no período · ative o agendamento do workflow N8N de Insights.
          </div>
        ) : (
          <div className="funnel-list">
            {insights.slice(0, 8).map(r => (
              <div className="funnel-row" key={r.id}>
                <div className="flabel"><b>{r.campaign_name}</b><span className="num">{fmtBRL(Number(r.spend))}</span></div>
                <BarFill value={Number(r.spend)} max={maxSpend} />
              </div>
            ))}
          </div>
        )}
      </div>

      {wppCampanhas.length > 0 && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="panel-head"><div className="panel-title">Campanhas WhatsApp <span>por volume de disparos</span></div></div>
          <div className="funnel-list">
            {wppCampanhas.slice(0, 8).map(c => (
              <div className="funnel-row" key={c.id}>
                <div className="flabel">
                  <b>{c.name}</b>
                  <span className="num">{fmtNum(c.total_envios)} disparos{c.custo_total > 0 ? ` · ${fmtBRL(c.custo_total)}` : ''}</span>
                </div>
                <BarFill value={c.total_envios} max={maxWppEnvios} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head"><div className="panel-title">Funil CRM → CAPI <span>disparos registrados</span></div></div>
        {funilSteps.every(s => s.count === 0) ? (
          <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '16px 0', textAlign: 'center' }}>
            Aguardando disparos registrados pelo workflow N8N.
          </div>
        ) : (
          <div className="conv-funnel">
            {funilSteps.map(step => {
              const pct = leadCount > 0 ? (step.count / leadCount) * 100 : step.count > 0 ? 100 : 0
              return (
                <div className="conv-step" key={step.label}>
                  <div className="step-name">{step.label}<small>{step.sub}</small></div>
                  <div className="conv-track">
                    <div className="conv-fill" style={{ width: `${Math.min(pct, 100)}%`, background: step.gold ? 'var(--gold)' : 'var(--red)', opacity: pct === 0 ? 0.15 : 1 }} />
                  </div>
                  <div className="conv-nums">
                    <span className="conv-abs num" style={{ color: step.gold ? 'var(--gold)' : step.count === 0 ? 'var(--text-3)' : 'var(--text)' }}>
                      {step.count > 0 ? fmtNum(step.count) : '—'}
                    </span>
                    <span className="conv-rel num">{pct > 0 ? `${pct.toFixed(1).replace('.', ',')}%` : 'aguardando'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
          Contadores refletem todos os deals com disparos registrados em <code>deal_stage_tracking</code>.
        </div>
      </div>
    </>
  )
}

// ─── Por Campanha ─────────────────────────────────────────────────────────────

function CampanhaView({ insights, wppCampanhas, subTab, setSubTab, onDetail }: {
  insights: MetaAdsInsight[]; wppCampanhas: WppCampanha[]
  subTab: SubTab; setSubTab: (s: SubTab) => void; onDetail: (c: MetaAdsInsight) => void
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
        wppCampanhas.length === 0 ? (
          <div className="panel" style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: 40 }}>
            Nenhuma campanha de WhatsApp no período selecionado.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Campanha WhatsApp</th>
                <th className="r">Disparos</th>
                <th className="r">Entregues</th>
                <th className="r">Lidos</th>
                <th className="r">Falhas</th>
                <th className="r">Custo</th>
              </tr>
            </thead>
            <tbody>
              {wppCampanhas.map(c => {
                const txEntrega = c.total_envios > 0 ? `${((c.entregues / c.total_envios) * 100).toFixed(0)}%` : '—'
                const txLeitura = c.entregues > 0 ? `${((c.lidos / c.entregues) * 100).toFixed(0)}%` : '—'
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="row-title">{c.name}</div>
                      <div className="row-sub">
                        {c.status === 'completed' ? 'Concluída' : c.status === 'running' ? 'Em andamento' : c.status === 'scheduled' ? 'Agendada' : c.status}
                        {c.completed_at ? ` · ${new Date(c.completed_at).toLocaleDateString('pt-BR')}` : ''}
                      </div>
                    </td>
                    <td className="r cell-num num">{fmtNum(c.total_envios)}</td>
                    <td className="r num">{fmtNum(c.entregues)} <span style={{ color: 'var(--text-3)', fontSize: 11.5 }}>{txEntrega}</span></td>
                    <td className="r num">{fmtNum(c.lidos)} <span style={{ color: 'var(--text-3)', fontSize: 11.5 }}>{txLeitura}</span></td>
                    <td className="r num" style={{ color: c.falhas > 0 ? '#f87171' : 'var(--text-3)' }}>{c.falhas > 0 ? fmtNum(c.falhas) : '—'}</td>
                    <td className="r num">{c.custo_total > 0 ? fmtBRL(c.custo_total) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )
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
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', fontSize: 13 }}>
                Nenhuma campanha no período · ative o agendamento N8N de Insights.
              </td></tr>
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
    const leads   = rows.reduce((s, r) => s + r.leads, 0)
    const spend   = rows.reduce((s, r) => s + Number(r.spend), 0)
    const revenue = rows.reduce((s, r) => s + Number(r.purchase_value), 0)
    const cpl     = leads > 0 ? spend / leads : 0
    const roas    = spend > 0 ? revenue / spend : 0
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
            <td className="r num" style={{ color: f.leads === 0 ? 'var(--text-3)' : undefined }}>{f.leads > 0 ? fmtNum(f.leads) : '—'}</td>
            <td className="r num" style={{ color: f.spend === 0 ? 'var(--text-3)' : undefined }}>{f.spend > 0 ? fmtBRL(f.spend) : '—'}</td>
            <td className="r num" style={{ color: f.cpl === 0 ? 'var(--text-3)' : undefined }}>{f.cpl > 0 ? fmtBRL(f.cpl) : '—'}</td>
            <td className="r cell-gold num">{f.revenue > 0 ? fmtBRL(f.revenue) : <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
            <td className="r num" style={{ color: f.roas === 0 ? 'var(--text-3)' : undefined }}>{f.roas > 0 ? fmtROAS(f.roas) : '—'}</td>
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
  const ctr = campaign.impressions > 0
    ? `${((campaign.clicks / campaign.impressions) * 100).toFixed(2).replace('.', ',')}%`
    : '—'

  return (
    <>
      <div onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer', marginBottom: 16, fontWeight: 500 }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}>
        ← Voltar
      </div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: 22 }}>{campaign.campaign_name}</h2>
        <div style={{ color: 'var(--text-3)', fontSize: 12.5, marginTop: 4 }}>
          {campaign.date_start} → {campaign.date_stop} · Sincronizado {timeSince(campaign.synced_at)}
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
            { l: 'Impressões', v: fmtNum(campaign.impressions) },
            { l: 'Cliques',    v: fmtNum(campaign.clicks) },
            { l: 'CTR',        v: ctr },
            { l: 'Leads',      v: fmtNum(campaign.leads) },
            { l: 'Compras',    v: fmtNum(campaign.purchases) },
            { l: 'Receita',    v: Number(campaign.purchase_value) > 0 ? fmtBRL(Number(campaign.purchase_value)) : '—' },
            { l: 'Gasto',      v: fmtBRL(Number(campaign.spend)) },
            { l: 'CPL',        v: fmtBRL(Number(campaign.cpl)) },
            { l: 'ROAS',       v: Number(campaign.roas) > 0 ? fmtROAS(Number(campaign.roas)) : '—' },
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
