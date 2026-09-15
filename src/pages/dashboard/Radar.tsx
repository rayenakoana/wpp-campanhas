import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabaseWpp } from '../../lib/supabase'
import Icon, { IconBadge } from '../../components/Icon'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MetaAdsInsight {
  id: string; campaign_id: string; campaign_name: string
  date_start: string; date_stop: string
  impressions: number; clicks: number; spend: number; leads: number
  purchases: number; purchase_value: number; cpl: number; roas: number
  synced_at: string; reach: number | null; frequency: number | null
  conversations_started: number | null
  quality_ranking: string | null; engagement_rate_ranking: string | null; conversion_rate_ranking: string | null
}

interface WppCampanha {
  id: string; name: string; status: string
  started_at: string | null; completed_at: string | null; created_at: string
  total_envios: number; entregues: number; lidos: number; respondidos: number; falhas: number; custo_total: number
}

interface WppVariante {
  id: string; campaign_id: string; label: string; body: string
  total_envios: number; entregues: number; lidos: number; respondidos: number; falhas: number
}

interface DealStageRow {
  stage_id: string; pipeline_id: string; last_fired_stage_id: string | null
}

interface FunilStep { label: string; sub: string; gold: boolean; count: number }

interface DailyPoint {
  date: string; leads: number; spend: number; cpl: number
  impressions: number; clicks: number; reach: number; frequency: number
}

interface CampaignSeries {
  campaign_id: string; campaign_name: string; color: string; points: DailyPoint[]
  total_leads: number; total_spend: number; total_impressions: number; total_clicks: number
  total_reach: number; avg_frequency: number; avg_cpl: number; total_conversations: number
  quality_ranking: string | null; engagement_rate_ranking: string | null; conversion_rate_ranking: string | null
}

interface CapiEvent {
  id: number; deal_id: string; pipeline_id: string; stage_id: string
  evento: string; phone: string | null; email: string | null
  ctwa_clid: string | null; pixel_id: string | null; fired_at: string
}

interface LeadHistory {
  phone: string; email: string | null; eventos: CapiEvent[]
}

type Tab = 'geral' | 'funil' | 'meta' | 'wpp'
type MetaSubTab = 'campanhas' | 'saude' | 'insights'
type ChartMetric = 'leads' | 'spend' | 'cpl' | 'reach' | 'frequency'
type DatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'this_month' | 'last_month'

const SUPABASE_URL = 'https://syecwttpsvrmhdvinjmt.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5ZWN3dHRwc3ZybWhkdmluam10Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzk1NDgxMywiZXhwIjoyMDk5NTMwODEzfQ.4q7pNim34eP-n38pANB9g7Lud-Y20TU4-VFA5f5WaGo'
const CAMPAIGN_COLORS = ['#C8172A', '#E8A020', '#2E7D52', '#5B6EE8', '#9C27B0']

const PIPELINE_NAMES: Record<string, string> = {
  '699effbf7b4346001f83c691': 'Segredos da Confecção',
  '699f00342be5b20013e23f9c': 'Imersão Paraguai',
  '699f332c5c43de0019d4f9ef': 'Supplytex',
  '69d7f7289d03880026773178': 'Funil Diagnóstico',
}

const STAGE_EVENT_MAP: Record<string, string> = {
  '699effbf7b4346001f83c694': 'Lead',
  '699effbf7b4346001f83c695': 'CompleteRegistration',
  '699effbf7b4346001f83c696': 'InitiateCheckout',
  '699effbf7b4346001f83c697': 'Purchase',
  '699f00342be5b20013e23f9f': 'Lead',
  '699f00342be5b20013e23fa0': 'CompleteRegistration',
  '6a3be4ae75ae6d001e865483': 'Schedule',
  '699f00342be5b20013e23fa1': 'InitiateCheckout',
  '699f00342be5b20013e23fa2': 'Purchase',
  '6a79cd940da205002e416282': 'AddToCart',
  '699f332c5c43de0019d4f9f2': 'Lead',
  '699f332c5c43de0019d4f9f3': 'CompleteRegistration',
  '699f332c5c43de0019d4f9f4': 'InitiateCheckout',
  '699f332c5c43de0019d4f9f5': 'Purchase',
  '69d7f7289d0388002677317a': 'Lead',
  '69d7f7299d0388002677317b': 'Lead',
  '69d7f7299d0388002677317c': 'CompleteRegistration',
  '6a8f2037bc096b002572761c': 'Schedule',
}

const EVENT_ORDER = ['Lead', 'CompleteRegistration', 'AddToCart', 'Schedule', 'InitiateCheckout', 'Purchase']
const EVENT_LABELS: Record<string, { label: string; sub: string; gold: boolean }> = {
  Lead:                 { label: 'Lead',                 sub: 'Contato Feito / Realizado',  gold: false },
  CompleteRegistration: { label: 'CompleteRegistration', sub: 'Identificação de Interesse', gold: false },
  AddToCart:            { label: 'AddToCart',            sub: 'Interesse confirmado',       gold: false },
  Schedule:             { label: 'Schedule',             sub: 'Reunião',                    gold: false },
  InitiateCheckout:     { label: 'InitiateCheckout',     sub: 'Negociação',                 gold: false },
  Purchase:             { label: 'Purchase',             sub: 'Fechado',                    gold: true  },
}

const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Hoje', yesterday: 'Ontem', '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias', this_month: 'Este mês', last_month: 'Mês passado',
}


const RANKING_LABEL: Record<string, string> = {
  above_average: 'Acima da média', average: 'Na média', below_average: 'Abaixo da média',
}
const RANKING_COLOR: Record<string, string> = {
  above_average: 'var(--green)', average: 'var(--gold)', below_average: 'var(--danger)',
}

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date(); const fmt = (d: Date) => d.toISOString().split('T')[0]
  switch (preset) {
    case 'today': return { from: fmt(now), to: fmt(now) }
    case 'yesterday': { const y = new Date(now); y.setDate(y.getDate()-1); return { from: fmt(y), to: fmt(y) } }
    case '7d': { const s = new Date(now); s.setDate(s.getDate()-6); return { from: fmt(s), to: fmt(now) } }
    case '30d': { const s = new Date(now); s.setDate(s.getDate()-29); return { from: fmt(s), to: fmt(now) } }
    case 'this_month': { const s = new Date(now.getFullYear(), now.getMonth(), 1); return { from: fmt(s), to: fmt(now) } }
    case 'last_month': { const s = new Date(now.getFullYear(), now.getMonth()-1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); return { from: fmt(s), to: fmt(e) } }
  }
}

function fmtBRL(v: number) { if (v >= 1000) return `R$ ${(v/1000).toFixed(1).replace('.','k').replace('k',',')} mil`; return `R$ ${Number(v).toFixed(2).replace('.',',')}` }
function fmtNum(v: number) { return v.toLocaleString('pt-BR') }
function fmtROAS(v: number) { return `${Number(v).toFixed(1).replace('.',',')}x` }
function fmtShortDate(d: string) { const [,m,day] = d.split('-'); return `${day}/${m}` }
function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function timeSince(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return 'agora'; if (diff < 60) return `há ${diff} min`; return `há ${Math.floor(diff/60)}h`
}
function fmtPhone(p: string | null) {
  if (!p) return '—'
  const d = p.replace(/\D/g, '')
  if (d.length === 13) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`
  if (d.length === 12) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,8)}-${d.slice(8)}`
  return p
}

// ─── Fetches ─────────────────────────────────────────────────────────────────

async function fetchMetaInsights(from: string, to: string): Promise<MetaAdsInsight[]> {
  const url = `${SUPABASE_URL}/rest/v1/meta_ads_insights?date_start=gte.${from}&date_start=lte.${to}&order=date_start.asc&limit=1000`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY, 'Accept-Profile': 'wpp' } })
  if (!res.ok) throw new Error(`meta_ads_insights ${res.status}`)
  let rows: MetaAdsInsight[] = await res.json()
  if (rows.length === 0) {
    const r2 = await fetch(`${SUPABASE_URL}/rest/v1/meta_ads_insights?order=synced_at.desc&limit=200`, { headers: { Authorization: `Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY, 'Accept-Profile': 'wpp' } })
    rows = await r2.json()
    const seen = new Set<string>()
    rows = rows.filter(r => { if (seen.has(r.campaign_id)) return false; seen.add(r.campaign_id); return true })
  }
  return rows.map(r => ({
    ...r,
    spend: Number(r.spend), leads: Number(r.leads), impressions: Number(r.impressions),
    clicks: Number(r.clicks), cpl: Number(r.cpl), roas: Number(r.roas),
    purchase_value: Number(r.purchase_value), purchases: Number(r.purchases),
    reach: r.reach ? Number(r.reach) : null,
    frequency: r.frequency ? Number(r.frequency) : null,
    conversations_started: r.conversations_started ? Number(r.conversations_started) : null,
  }))
}

function buildCampaignSeries(rows: MetaAdsInsight[]): CampaignSeries[] {
  const byCampaign: Record<string, MetaAdsInsight[]> = {}
  for (const r of rows) { if (!byCampaign[r.campaign_id]) byCampaign[r.campaign_id] = []; byCampaign[r.campaign_id].push(r) }
  return Object.entries(byCampaign).map(([cid, rs], idx) => {
    const sorted = [...rs].sort((a,b) => a.date_start.localeCompare(b.date_start))
    const points: DailyPoint[] = sorted.map(r => ({
      date: r.date_start, leads: r.leads, spend: r.spend, cpl: r.cpl,
      impressions: r.impressions, clicks: r.clicks, reach: r.reach ?? 0, frequency: r.frequency ?? 0,
    }))
    const total_leads = rs.reduce((s,r) => s+r.leads, 0)
    const total_spend = rs.reduce((s,r) => s+r.spend, 0)
    const total_reach = rs.reduce((s,r) => s+(r.reach??0), 0)
    const total_conversations = rs.reduce((s,r) => s+(r.conversations_started??0), 0)
    const avg_frequency = rs.filter(r => r.frequency).reduce((s,r,_,a) => s+(r.frequency??0)/a.length, 0)
    const latest = rs.reduce((a,b) => a.synced_at > b.synced_at ? a : b)
    return {
      campaign_id: cid, campaign_name: rs[0].campaign_name,
      color: CAMPAIGN_COLORS[idx % CAMPAIGN_COLORS.length], points,
      total_leads, total_spend,
      total_impressions: rs.reduce((s,r) => s+r.impressions, 0),
      total_clicks: rs.reduce((s,r) => s+r.clicks, 0),
      total_reach, avg_frequency,
      avg_cpl: total_leads > 0 ? total_spend/total_leads : 0,
      total_conversations,
      quality_ranking: latest.quality_ranking && latest.quality_ranking.toUpperCase()!=='UNKNOWN' ? latest.quality_ranking.toLowerCase() : null,
      engagement_rate_ranking: latest.engagement_rate_ranking && latest.engagement_rate_ranking.toUpperCase()!=='UNKNOWN' ? latest.engagement_rate_ranking.toLowerCase() : null,
      conversion_rate_ranking: latest.conversion_rate_ranking && latest.conversion_rate_ranking.toUpperCase()!=='UNKNOWN' ? latest.conversion_rate_ranking.toLowerCase() : null,
    }
  }).sort((a,b) => b.total_spend - a.total_spend)
}

async function fetchWppCampanhas(from: string, to: string): Promise<WppCampanha[]> {
  const { data: campanhas, error: err1 } = await supabaseWpp.from('campaigns').select('id,name,status,started_at,completed_at,created_at').gte('created_at',`${from}T00:00:00Z`).lte('created_at',`${to}T23:59:59Z`).order('created_at',{ascending:false})
  if (err1) throw new Error(`campaigns: ${err1.message}`)
  if (!campanhas || campanhas.length === 0) return []
  const ids = campanhas.map((c:any) => c.id)
  const { data: envios, error: err2 } = await supabaseWpp.from('campaign_sends').select('campaign_id,status,cost').in('campaign_id',ids)
  if (err2) throw new Error(`campaign_sends: ${err2.message}`)
  const ep: Record<string,any[]> = {}
  for (const e of (envios??[]) as any[]) { if (!ep[e.campaign_id]) ep[e.campaign_id]=[]; ep[e.campaign_id].push(e) }
  return (campanhas as any[]).map((c:any) => {
    const es = ep[c.id]??[]
    return { id:c.id, name:c.name, status:c.status, started_at:c.started_at, completed_at:c.completed_at, created_at:c.created_at,
      total_envios:es.length, entregues:es.filter((e:any)=>['delivered','read','replied'].includes(e.status)).length,
      lidos:es.filter((e:any)=>['read','replied'].includes(e.status)).length,
      respondidos:es.filter((e:any)=>e.status==='replied').length,
      falhas:es.filter((e:any)=>e.status==='failed').length,
      custo_total:es.reduce((s:number,e:any)=>s+(e.cost?Number(e.cost):0),0) }
  })
}

async function fetchWppVariantes(campanhaIds: string[]): Promise<WppVariante[]> {
  if (campanhaIds.length === 0) return []
  const { data: variantes, error: err1 } = await supabaseWpp
    .from('campaign_variants')
    .select('id,campaign_id,label,body')
    .in('campaign_id', campanhaIds)
  if (err1 || !variantes || variantes.length === 0) return []
  const varIds = variantes.map((v: any) => v.id)
  const { data: envios, error: err2 } = await supabaseWpp
    .from('campaign_sends')
    .select('variant_id,status')
    .in('variant_id', varIds)
  if (err2) return []
  const ep: Record<string, any[]> = {}
  for (const e of (envios ?? []) as any[]) {
    if (!ep[e.variant_id]) ep[e.variant_id] = []
    ep[e.variant_id].push(e)
  }
  return (variantes as any[]).map((v: any) => {
    const es = ep[v.id] ?? []
    return {
      id: v.id, campaign_id: v.campaign_id, label: v.label, body: v.body,
      total_envios: es.length,
      entregues: es.filter((e: any) => ['delivered','read','replied'].includes(e.status)).length,
      lidos: es.filter((e: any) => ['read','replied'].includes(e.status)).length,
      respondidos: es.filter((e: any) => e.status === 'replied').length,
      falhas: es.filter((e: any) => e.status === 'failed').length,
    }
  })
}

async function fetchFunilSteps(): Promise<FunilStep[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/deal_stage_tracking?select=stage_id,pipeline_id,last_fired_stage_id&limit=5000`, { headers:{Authorization:`Bearer ${SUPABASE_KEY}`,apikey:SUPABASE_KEY,'Accept-Profile':'public'} })
  if (!res.ok) throw new Error(`deal_stage_tracking ${res.status}`)
  const rows: DealStageRow[] = await res.json()
  const counts: Record<string,number> = {}; for (const ev of EVENT_ORDER) counts[ev]=0
  for (const row of rows) { const sid=row.last_fired_stage_id??row.stage_id; const ev=STAGE_EVENT_MAP[sid]; if (ev) counts[ev]++ }
  return EVENT_ORDER.map(ev => ({ ...EVENT_LABELS[ev], count: counts[ev] }))
}

async function fetchCapiEvents(): Promise<CapiEvent[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/capi_events_log?order=fired_at.desc&limit=2000`, {
    headers: { Authorization: `Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY, 'Accept-Profile': 'wpp' }
  })
  if (!res.ok) throw new Error(`capi_events_log ${res.status}`)
  return res.json()
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

function LineChart({ series, metric, height=180 }: { series: CampaignSeries[]; metric: ChartMetric; height?: number }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{x:number;y:number;date:string;values:{name:string;color:string;value:number}[]}|null>(null)
  const [width, setWidth] = useState(800)
  useEffect(() => {
    if (!svgRef.current) return
    const obs = new ResizeObserver(es => setWidth(es[0].contentRect.width))
    obs.observe(svgRef.current.parentElement!)
    setWidth(svgRef.current.parentElement!.clientWidth)
    return () => obs.disconnect()
  }, [])
  if (!series.length || series.every(s => !s.points.length)) return <div style={{height,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-3)',fontSize:13}}>Sem dados</div>
  const allDates = [...new Set(series.flatMap(s => s.points.map(p => p.date)))].sort()
  const getValue = (p: DailyPoint) => metric==='leads'?p.leads:metric==='spend'?p.spend:metric==='cpl'?p.cpl:metric==='reach'?p.reach:p.frequency
  const seriesData = series.map(s => { const map:Record<string,number>={}; for (const p of s.points) map[p.date]=getValue(p); return {...s,map} })
  const pad={top:12,right:16,bottom:32,left:56}; const W=width-pad.left-pad.right; const H=height-pad.top-pad.bottom
  const allValues = seriesData.flatMap(s => allDates.map(d => s.map[d]??0))
  const maxVal = Math.max(...allValues, 0.01)
  const xPos = (i:number) => allDates.length>1?(i/(allDates.length-1))*W:W/2
  const yPos = (v:number) => H-(v/maxVal)*H
  const pathD = (s:typeof seriesData[0]) => allDates.map((d,i)=>`${i===0?'M':'L'}${xPos(i).toFixed(1)},${yPos(s.map[d]??0).toFixed(1)}`).join(' ')
  const areaD = (s:typeof seriesData[0]) => { const pts=allDates.map((d,i)=>({x:xPos(i),y:yPos(s.map[d]??0)})); return `${pts.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} L${pts[pts.length-1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z` }
  const yTicks = [0,0.25,0.5,0.75,1].map(f=>maxVal*f)
  const step = Math.max(1,Math.ceil(allDates.length/8))
  const xTickIdxs = allDates.map((_,i)=>i).filter(i=>i%step===0||i===allDates.length-1)
  const fmtY = (v:number) => metric==='spend'?`R$${v>=1000?(v/1000).toFixed(0)+'k':v.toFixed(0)}`:metric==='cpl'?`R$${v.toFixed(0)}`:metric==='frequency'?v.toFixed(1):String(Math.round(v))
  const handleMouseMove = (e:React.MouseEvent<SVGSVGElement>) => {
    const rect=svgRef.current!.getBoundingClientRect(); const mx=e.clientX-rect.left-pad.left
    const idx=Math.max(0,Math.min(allDates.length-1,Math.round((mx/W)*(allDates.length-1))))
    const date=allDates[idx]
    setTooltip({x:xPos(idx)+pad.left,y:e.clientY-rect.top,date,values:seriesData.map(s=>({name:s.campaign_name.replace(/\[|\]/g,' ').trim(),color:s.color,value:s.map[date]??0}))})
  }
  return (
    <div style={{position:'relative',width:'100%'}}>
      <svg ref={svgRef} width="100%" height={height} onMouseMove={handleMouseMove} onMouseLeave={()=>setTooltip(null)} style={{overflow:'visible',display:'block'}}>
        <defs>{seriesData.map(s=><linearGradient key={s.campaign_id} id={`grad-${s.campaign_id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity="0.15"/><stop offset="100%" stopColor={s.color} stopOpacity="0"/></linearGradient>)}</defs>
        <g transform={`translate(${pad.left},${pad.top})`}>
          {yTicks.map((v,i)=>(
            <g key={i}>
              <line x1={0} y1={yPos(v)} x2={W} y2={yPos(v)} stroke="var(--line-soft)" strokeWidth={0.5} strokeDasharray="3,3"/>
              <text x={-6} y={yPos(v)+4} textAnchor="end" fontSize={10} fill="var(--text-3)">{fmtY(v)}</text>
            </g>
          ))}
          {xTickIdxs.map(i=><text key={i} x={xPos(i)} y={H+20} textAnchor="middle" fontSize={10} fill="var(--text-3)">{fmtShortDate(allDates[i])}</text>)}
          {seriesData.map(s=><path key={`a-${s.campaign_id}`} d={areaD(s)} fill={`url(#grad-${s.campaign_id})`}/>)}
          {seriesData.map(s=><path key={`l-${s.campaign_id}`} d={pathD(s)} fill="none" stroke={s.color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"/>)}
          {tooltip&&<line x1={tooltip.x-pad.left} y1={0} x2={tooltip.x-pad.left} y2={H} stroke="var(--text-3)" strokeWidth={0.8} strokeDasharray="3,3"/>}
        </g>
      </svg>
      {tooltip&&(
        <div style={{position:'absolute',top:Math.max(8,tooltip.y-70),left:Math.min(tooltip.x+10,width-190),background:'var(--surface)',border:'1px solid var(--line)',borderRadius:8,padding:'8px 12px',fontSize:12,pointerEvents:'none',zIndex:50,boxShadow:'0 8px 24px rgba(0,0,0,.2)'}}>
          <div style={{color:'var(--text-3)',marginBottom:5,fontWeight:600}}>{fmtShortDate(tooltip.date)}</div>
          {tooltip.values.map(v=>(
            <div key={v.name} style={{display:'flex',gap:8,alignItems:'center',marginBottom:2}}>
              <span style={{width:8,height:8,borderRadius:'50%',background:v.color,flexShrink:0}}/>
              <span style={{color:'var(--text-2)',flex:1,fontSize:11}}>{v.name.split(' ').slice(0,3).join(' ')}</span>
              <span style={{fontWeight:600,fontFamily:'Barlow Condensed, sans-serif'}}>{metric==='spend'||metric==='cpl'?fmtBRL(v.value):metric==='frequency'?v.value.toFixed(2):fmtNum(v.value)}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{display:'flex',gap:16,marginTop:8,flexWrap:'wrap'}}>
        {seriesData.map(s=><div key={s.campaign_id} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text-2)'}}><div style={{width:20,height:2,background:s.color,borderRadius:1}}/>{s.campaign_name.replace(/\[|\]/g,' ').replace(/\s+/g,' ').trim()}</div>)}
      </div>
    </div>
  )
}

// ─── Ranking Badge / Bar ──────────────────────────────────────────────────────

function RankingBadge({ value }: { value: string | null }) {
  if (!value) return <span style={{color:'var(--text-3)',fontSize:12}}>—</span>
  return <span style={{fontSize:12,fontWeight:500,color:RANKING_COLOR[value]??'var(--text-2)'}}>{RANKING_LABEL[value]??value}</span>
}

function RankingBar({ value }: { value: string | null }) {
  const pct = value==='above_average'?85:value==='average'?55:value==='below_average'?25:0
  const color = RANKING_COLOR[value??'']??'var(--text-3)'
  return (
    <div>
      <div style={{height:4,background:'var(--line)',borderRadius:2,overflow:'hidden'}}>
        <div style={{height:4,width:`${pct}%`,background:color,borderRadius:2,transition:'width .4s'}}/>
      </div>
    </div>
  )
}

// ─── Date Filter ─────────────────────────────────────────────────────────────

function DateFilter({ preset,setPreset,customFrom,setCustomFrom,customTo,setCustomTo,label }:{
  preset:DatePreset|'custom';setPreset:(p:DatePreset|'custom')=>void
  customFrom:string;setCustomFrom:(s:string)=>void;customTo:string;setCustomTo:(s:string)=>void;label:string
}) {
  const [open,setOpen]=useState(false)
  useEffect(()=>{const h=()=>setOpen(false);document.addEventListener('click',h);return()=>document.removeEventListener('click',h)},[])
  return (
    <div style={{position:'relative'}} onClick={e=>e.stopPropagation()}>
      <button className="btn" onClick={()=>setOpen(o=>!o)}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
        {label}
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth={1.6}><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open&&(
        <div style={{position:'absolute',top:'calc(100% + 6px)',right:0,left:'auto',zIndex:200,background:'var(--surface)',border:'1px solid var(--line)',borderRadius:10,padding:12,width:280,boxShadow:'0 16px 40px rgba(0,0,0,.25)',maxHeight:'90vh',overflowY:'auto'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:12}}>
            {(Object.keys(PRESET_LABELS) as DatePreset[]).map(p=>(
              <div key={p} onClick={()=>{setPreset(p);setOpen(false)}} style={{padding:'7px 10px',fontSize:12.5,borderRadius:6,cursor:'pointer',fontWeight:500,color:preset===p?'var(--text)':'var(--text-2)',background:preset===p?'var(--active)':'transparent',boxShadow:preset===p?'inset 0 0 0 1px var(--line)':'none'}}>{PRESET_LABELS[p]}</div>
            ))}
          </div>
          <div className="t-eyebrow" style={{marginBottom:7}}>Período personalizado</div>
          <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:8}}>
            <div><label className="t-muted" style={{display:'block',marginBottom:3}}>De</label><input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} className="input" style={{fontSize:12.5,padding:'7px 10px',width:'100%',boxSizing:'border-box'}}/></div>
            <div><label className="t-muted" style={{display:'block',marginBottom:3}}>Até</label><input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)} className="input" style={{fontSize:12.5,padding:'7px 10px',width:'100%',boxSizing:'border-box'}}/></div>
          </div>
          <button className="btn primary" style={{width:'100%',justifyContent:'center',fontSize:12.5}} onClick={()=>{if(customFrom&&customTo){setPreset('custom');setOpen(false)}}}>Aplicar</button>
        </div>
      )}
    </div>
  )
}

// ─── Modal Lead ───────────────────────────────────────────────────────────────

function LeadModal({ history, onClose }: { history: LeadHistory; onClose: () => void }) {
  const tempoNoFunil = () => {
    if (history.eventos.length === 0) return '—'
    const primeiro = new Date(history.eventos[history.eventos.length - 1].fired_at)
    const ultimo = new Date(history.eventos[0].fired_at)
    const dias = Math.floor((ultimo.getTime() - primeiro.getTime()) / (1000 * 60 * 60 * 24))
    return dias === 0 ? 'Mesmo dia' : `${dias} dia${dias > 1 ? 's' : ''}`
  }
  const temCtwa = history.eventos.some(e => e.ctwa_clid)

  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,.55)'}} onClick={onClose}>
      <div style={{background:'var(--surface)',border:'1px solid var(--line)',borderRadius:12,padding:24,width:'min(560px,95vw)',maxHeight:'85vh',overflowY:'auto',boxShadow:'0 24px 64px rgba(0,0,0,.4)'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
          <div>
            <div className="t-title" style={{fontSize:15,marginBottom:4}}>{fmtPhone(history.phone)}</div>
            <div className="t-muted">{history.email || 'Sem e-mail cadastrado'}</div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {temCtwa&&<span style={{fontSize:11,fontWeight:600,padding:'3px 8px',borderRadius:4,background:'rgba(200,23,42,.12)',color:'var(--red)'}}>CTWA</span>}
            <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',fontSize:20,lineHeight:1,padding:4}}>×</button>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
          {[
            {label:'Eventos disparados',value:String(history.eventos.length)},
            {label:'Tempo no funil',value:tempoNoFunil()},
            {label:'Primeiro contato',value:history.eventos.length>0?fmtDateTime(history.eventos[history.eventos.length-1].fired_at):'—'},
            {label:'Último evento',value:history.eventos.length>0?fmtDateTime(history.eventos[0].fired_at):'—'},
          ].map(k=>(
            <div key={k.label} style={{padding:'10px 12px',background:'var(--surface-2)',borderRadius:8,border:'1px solid var(--line)'}}>
              <div className="t-muted" style={{marginBottom:4}}>{k.label}</div>
              <div style={{fontFamily:'Barlow Condensed, sans-serif',fontWeight:700,fontSize:18,color:'var(--text)'}}>{k.value}</div>
            </div>
          ))}
        </div>

        <div className="t-eyebrow" style={{marginBottom:10}}>Histórico de eventos</div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {history.eventos.map((ev)=>(
            <div key={ev.id} style={{display:'flex',gap:12,alignItems:'flex-start',padding:'10px 12px',background:'var(--surface-2)',borderRadius:8,border:'1px solid var(--line)'}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:ev.evento==='Purchase'?'var(--gold)':'var(--red)',flexShrink:0,marginTop:4}}/>
              <div style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                  <span style={{fontWeight:600,fontSize:13,color:ev.evento==='Purchase'?'var(--gold)':'var(--text)'}}>{ev.evento}</span>
                  <span className="t-muted">{fmtDateTime(ev.fired_at)}</span>
                </div>
                <div className="t-muted" style={{marginTop:3}}>{PIPELINE_NAMES[ev.pipeline_id]??ev.pipeline_id}</div>
                {ev.ctwa_clid&&<div style={{fontSize:11,color:'var(--red)',marginTop:3}}>CTWA atribuído</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function Radar() {
  const [tab,setTab]=useState<Tab>('geral')
  const [preset,setPreset]=useState<DatePreset|'custom'>('30d')
  const [customFrom,setCustomFrom]=useState('')
  const [customTo,setCustomTo]=useState('')
  const [allRows,setAllRows]=useState<MetaAdsInsight[]>([])
  const [campaignSeries,setCampaignSeries]=useState<CampaignSeries[]>([])
  const [wppCampanhas,setWppCampanhas]=useState<WppCampanha[]>([])
  const [funilSteps,setFunilSteps]=useState<FunilStep[]>([])
  const [capiEvents,setCapiEvents]=useState<CapiEvent[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)
  const [syncedAt,setSyncedAt]=useState<string|null>(null)
  const [detail,setDetail]=useState<CampaignSeries|null>(null)
  const [dateLabel,setDateLabel]=useState('Últimos 30 dias')
  const [selectedLead,setSelectedLead]=useState<LeadHistory|null>(null)

  const load=useCallback(async()=>{
    setLoading(true);setError(null)
    try {
      const range=preset==='custom'?{from:customFrom,to:customTo}:getDateRange(preset as DatePreset)
      const [rows,wppData,funilData,capiData]=await Promise.all([
        fetchMetaInsights(range.from,range.to),
        fetchWppCampanhas(range.from,range.to),
        fetchFunilSteps(),
        fetchCapiEvents(),
      ])
      setAllRows(rows);setCampaignSeries(buildCampaignSeries(rows));setWppCampanhas(wppData)
      setFunilSteps(funilData);setCapiEvents(capiData)
      const latest=rows.length>0?rows.reduce((a,b)=>a.synced_at>b.synced_at?a:b):null
      setSyncedAt(latest?.synced_at??new Date().toISOString())
      setDateLabel(preset==='custom'?`${customFrom} – ${customTo}`:PRESET_LABELS[preset as DatePreset])
    } catch(e:any){setError(e.message)} finally{setLoading(false)}
  },[preset,customFrom,customTo])

  useEffect(()=>{load()},[load])

  const totalLeads=campaignSeries.reduce((s,c)=>s+c.total_leads,0)
  const totalSpend=campaignSeries.reduce((s,c)=>s+c.total_spend,0)
  const totalRev=allRows.reduce((s,r)=>s+r.purchase_value,0)
  const totalReach=campaignSeries.reduce((s,c)=>s+c.total_reach,0)
  const totalConversations=campaignSeries.reduce((s,c)=>s+c.total_conversations,0)
  const avgCPL=totalLeads>0?totalSpend/totalLeads:0
  const avgROAS=totalSpend>0?totalRev/totalSpend:0
  const avgFreq=campaignSeries.length>0?campaignSeries.reduce((s,c)=>s+c.avg_frequency,0)/campaignSeries.length:0
  const leadCount=funilSteps.find(s=>s.label==='Lead')?.count??0

  // Agrupa eventos CAPI por telefone para o funil CRM
  const leadsByPhone = capiEvents.reduce<Record<string, CapiEvent[]>>((acc, ev) => {
    const key = ev.phone ?? `deal_${ev.deal_id}`
    if (!acc[key]) acc[key] = []
    acc[key].push(ev)
    return acc
  }, {})

  const openLead = (phone: string) => {
    const eventos = leadsByPhone[phone] ?? []
    setSelectedLead({ phone, email: eventos[0]?.email ?? null, eventos })
  }

  const exportCSV = (events: CapiEvent[], filename: string) => {
    const header = 'Telefone,Email,Evento,Pipeline,Pixel,CTWA,Data'
    const rows = events.map(e =>
      [e.phone??'',e.email??'',e.evento,PIPELINE_NAMES[e.pipeline_id??'']??e.pipeline_id??'',e.pixel_id??'',e.ctwa_clid??'',fmtDateTime(e.fired_at)].join(',')
    )
    const blob = new Blob([header+'\n'+rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click()
  }

  const TABS: {key:Tab;label:string}[] = [
    {key:'geral',label:'Visão Geral'},
    {key:'funil',label:'Funil CRM'},
    {key:'meta',label:'Meta Ads'},
    {key:'wpp',label:'WhatsApp'},
  ]

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,gap:16,flexWrap:'wrap'}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
            <h1 className="font-display font-semibold text-2xl">Radar de Conversões</h1>
            <span style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,color:campaignSeries.length>0?'var(--green)':'var(--text-3)'}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:campaignSeries.length>0?'var(--green)':'var(--text-3)',display:'inline-block'}}/>
              {loading?'Sincronizando...':syncedAt?`Sincronizado ${timeSince(syncedAt)}`:'Aguardando dados'}
            </span>
          </div>
          <p className="text-sm" style={{color:'var(--text-3)',marginTop:4}}>Meta Ads + Campanhas WhatsApp · {dateLabel}</p>
        </div>
        <DateFilter preset={preset} setPreset={setPreset} customFrom={customFrom} setCustomFrom={setCustomFrom} customTo={customTo} setCustomTo={setCustomTo} label={dateLabel}/>
      </div>

      {!detail&&(
        <div style={{overflowX:'auto',paddingBottom:4}}><div className="tabs" style={{width:'max-content'}}>
          {TABS.map(t=><button key={t.key} className={`tab${tab===t.key?' active':''}`} onClick={()=>setTab(t.key)}>{t.label}</button>)}
        </div></div>
      )}

      {error&&<div className="panel" style={{padding:'12px 16px',marginBottom:20,display:'flex',alignItems:'center',gap:8,color:'var(--danger)',fontSize:13}}><Icon name="alert"/> Erro: {error}</div>}

      {loading?(
        <div className="panel" style={{padding:40,fontSize:13,color:'var(--text-2)',textAlign:'center'}}>Carregando...</div>
      ):detail?(
        <DetailView series={detail} onBack={()=>setDetail(null)}/>
      ):tab==='geral'?(
        <GeralView campaignSeries={campaignSeries} wppCampanhas={wppCampanhas} funilSteps={funilSteps} totalLeads={totalLeads} totalSpend={totalSpend} totalRev={totalRev} avgCPL={avgCPL} avgROAS={avgROAS} totalReach={totalReach} totalConversations={totalConversations} avgFreq={avgFreq} leadCount={leadCount}/>
      ):tab==='funil'?(
        <FunilCRMView funilSteps={funilSteps} capiEvents={capiEvents} leadsByPhone={leadsByPhone} leadCount={leadCount} onOpenLead={openLead} onExport={exportCSV}/>
      ):tab==='meta'?(
        <MetaView campaignSeries={campaignSeries} totalLeads={totalLeads} totalConversations={totalConversations} avgFreq={avgFreq} onDetail={setDetail}/>
      ):(
        <WppView wppCampanhas={wppCampanhas}/>
      )}

      {selectedLead&&<LeadModal history={selectedLead} onClose={()=>setSelectedLead(null)}/>}
    </div>
  )
}

// ─── Visão Geral ─────────────────────────────────────────────────────────────

function GeralView({campaignSeries,wppCampanhas,funilSteps,totalLeads,totalSpend,totalRev,avgCPL,avgROAS,totalReach,totalConversations,avgFreq,leadCount}:{
  campaignSeries:CampaignSeries[];wppCampanhas:WppCampanha[];funilSteps:FunilStep[]
  totalLeads:number;totalSpend:number;totalRev:number;avgCPL:number;avgROAS:number
  totalReach:number;totalConversations:number;avgFreq:number;leadCount:number
}) {
  const [metric,setMetric]=useState<ChartMetric>('leads')
  const totalWppEnvios=wppCampanhas.reduce((s,c)=>s+c.total_envios,0)
  const totalWppLidos=wppCampanhas.reduce((s,c)=>s+c.lidos,0)
  const totalWppRespondidos=wppCampanhas.reduce((s,c)=>s+c.respondidos,0)
  const totalWppCusto=wppCampanhas.reduce((s,c)=>s+c.custo_total,0)
  const convRate=totalLeads>0?((totalConversations/totalLeads)*100):0
  const freqAlert=avgFreq>=3
  const METRICS:{key:ChartMetric;label:string}[]=[
    {key:'leads',label:'Leads'},{key:'spend',label:'Gasto'},{key:'cpl',label:'CPL'},
    {key:'reach',label:'Alcance'},{key:'frequency',label:'Frequência'},
  ]

  return (
    <>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:20}}>
        {[
          {label:'Leads gerados',value:fmtNum(totalLeads),sub:`${campaignSeries.length} campanhas`},
          {label:'Alcance único',value:fmtNum(totalReach),sub:`${fmtNum(campaignSeries.reduce((s,c)=>s+c.total_impressions,0))} impressões`},
          {label:'Frequência média',value:avgFreq>0?avgFreq.toFixed(2)+'×':'—',sub:freqAlert?'Acima de 3×, saturando':'Dentro do ideal',warn:freqAlert},
          {label:'Gasto total',value:fmtBRL(totalSpend),sub:`CPL ${fmtBRL(avgCPL)}`},
          {label:'Conversas WhatsApp',value:totalConversations>0?fmtNum(totalConversations):'—',sub:convRate>0?`${convRate.toFixed(1).replace('.',',')}% dos leads`:'aguardando dados',green:convRate>0},
          {label:'Receita atribuída',value:fmtBRL(totalRev),sub:`ROAS ${fmtROAS(avgROAS)}`,gold:true},
          {label:'Campanhas WPP',value:fmtNum(wppCampanhas.length),sub:totalWppEnvios>0?`${fmtNum(totalWppEnvios)} disparos`:'—'},
          {label:'Taxa de leitura WPP',value:totalWppEnvios>0?`${((totalWppLidos/totalWppEnvios)*100).toFixed(1).replace('.',',')}%`:'—',sub:totalWppRespondidos>0?`${fmtNum(totalWppRespondidos)} responderam`:(totalWppCusto>0?`Custo ${fmtBRL(totalWppCusto)}`:'—')},
        ].map(k=>(
          <div key={k.label} className="kpi-card">
            <div className="kpi-label"><span className="base-mark"/> {k.label}</div>
            <div className="kpi-value num" style={(k as any).gold?{color:'var(--gold)'}:(k as any).warn?{color:'var(--gold)'}:(k as any).green?{color:'var(--green)'}:{}}>{k.value}</div>
            <div className="kpi-sub" style={(k as any).warn?{color:'var(--gold)'}:{}}>{k.sub}</div>
          </div>
        ))}
      </div>

      {campaignSeries.length>0&&campaignSeries[0].points.length>1&&(
        <div className="panel" style={{marginBottom:14}}>
          <div className="panel-head" style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
            <div className="panel-title">Evolução diária <span>por campanha</span></div>
            <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
              {METRICS.map(m=>(
                <button key={m.key} onClick={()=>setMetric(m.key)} style={{padding:'4px 10px',fontSize:12,borderRadius:5,border:'none',cursor:'pointer',fontWeight:500,background:metric===m.key?'var(--red)':'transparent',color:metric===m.key?'#fff':'var(--text-3)'}}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <LineChart series={campaignSeries} metric={metric} height={200}/>
        </div>
      )}

      <div className="panel">
        <div className="panel-head"><div className="panel-title">Funil CRM → CAPI <span>posição atual dos deals</span></div></div>
        {funilSteps.every(s=>s.count===0)?(
          <div style={{fontSize:13,color:'var(--text-3)',padding:'16px 0',textAlign:'center'}}>Aguardando disparos registrados pelo workflow N8N.</div>
        ):(
          <div className="conv-funnel">
            {funilSteps.map(step=>{
              const pct=leadCount>0?(step.count/leadCount)*100:step.count>0?100:0
              return (
                <div className="conv-step" key={step.label}>
                  <div className="step-name">{step.label}<small>{step.sub}</small></div>
                  <div className="conv-track"><div className="conv-fill" style={{width:`${Math.min(pct,100)}%`,background:step.gold?'var(--gold)':'var(--red)',opacity:pct===0?0.15:1}}/></div>
                  <div className="conv-nums">
                    <span className="conv-abs num" style={{color:step.gold?'var(--gold)':step.count===0?'var(--text-3)':'var(--text)'}}>{step.count>0?fmtNum(step.count):'—'}</span>
                    <span className="conv-rel num">{pct>0?`${pct.toFixed(1).replace('.',',')}%`:'aguardando'}</span>
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

// ─── Funil CRM ────────────────────────────────────────────────────────────────

function FunilCRMView({ funilSteps, capiEvents, leadsByPhone, leadCount, onOpenLead, onExport }: {
  funilSteps: FunilStep[]; capiEvents: CapiEvent[]
  leadsByPhone: Record<string, CapiEvent[]>; leadCount: number
  onOpenLead: (phone: string) => void
  onExport: (events: CapiEvent[], filename: string) => void
}) {
  const [pipelineFilter, setPipelineFilter] = useState<string>('all')
  const [eventoFilter, setEventoFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  // Leads únicos por telefone
  const uniqueLeads = Object.entries(leadsByPhone).map(([phone, evs]) => {
    const sorted = [...evs].sort((a,b) => new Date(b.fired_at).getTime() - new Date(a.fired_at).getTime())
    const ultimoEvento = sorted[0]
    const primeiroEvento = sorted[sorted.length - 1]
    const diasNoFunil = Math.floor((new Date(ultimoEvento.fired_at).getTime() - new Date(primeiroEvento.fired_at).getTime()) / (1000*60*60*24))
    return {
      phone,
      email: ultimoEvento.email,
      ultimoEvento: ultimoEvento.evento,
      pipeline_id: ultimoEvento.pipeline_id,
      temCtwa: evs.some(e => e.ctwa_clid),
      totalEventos: evs.length,
      diasNoFunil,
      ultimaAtividade: ultimoEvento.fired_at,
    }
  }).sort((a,b) => new Date(b.ultimaAtividade).getTime() - new Date(a.ultimaAtividade).getTime())

  const filtered = uniqueLeads.filter(l => {
    if (pipelineFilter !== 'all' && l.pipeline_id !== pipelineFilter) return false
    if (eventoFilter !== 'all' && l.ultimoEvento !== eventoFilter) return false
    if (search) {
      const s = search.toLowerCase()
      if (!l.phone.includes(s) && !(l.email??'').toLowerCase().includes(s)) return false
    }
    return true
  })

  const pipelines = [...new Set(capiEvents.map(e => e.pipeline_id).filter(Boolean))] as string[]

  return (
    <>
      {/* Funil */}
      <div className="panel" style={{marginBottom:14}}>
        <div className="panel-head" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div className="panel-title">Funil de eventos <span>posição atual dos deals no CRM</span></div>
        </div>
        {funilSteps.every(s=>s.count===0)?(
          <div style={{fontSize:13,color:'var(--text-3)',padding:'16px 0',textAlign:'center'}}>Aguardando disparos do workflow N8N.</div>
        ):(
          <div className="conv-funnel">
            {funilSteps.map(step=>{
              const pct=leadCount>0?(step.count/leadCount)*100:step.count>0?100:0
              return (
                <div className="conv-step" key={step.label}>
                  <div className="step-name">{step.label}<small>{step.sub}</small></div>
                  <div className="conv-track"><div className="conv-fill" style={{width:`${Math.min(pct,100)}%`,background:step.gold?'var(--gold)':'var(--red)',opacity:pct===0?0.15:1}}/></div>
                  <div className="conv-nums">
                    <span className="conv-abs num" style={{color:step.gold?'var(--gold)':step.count===0?'var(--text-3)':'var(--text)'}}>{step.count>0?fmtNum(step.count):'—'}</span>
                    <span className="conv-rel num">{pct>0?`${pct.toFixed(1).replace('.',',')}%`:'aguardando'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tabela de leads */}
      <div className="panel">
        <div className="panel-head" style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
          <div className="panel-title">Leads no funil <span>{filtered.length} contatos</span></div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            <input
              placeholder="Buscar telefone ou e-mail..."
              value={search} onChange={e=>setSearch(e.target.value)}
              style={{fontSize:12.5,padding:'6px 10px',borderRadius:6,border:'1px solid var(--line)',background:'var(--surface-2)',color:'var(--text)',width:200}}
            />
            <select value={pipelineFilter} onChange={e=>setPipelineFilter(e.target.value)} style={{fontSize:12.5,padding:'6px 10px',borderRadius:6,border:'1px solid var(--line)',background:'var(--surface-2)',color:'var(--text)'}}>
              <option value="all">Todos os funis</option>
              {pipelines.map(p=><option key={p} value={p}>{PIPELINE_NAMES[p]??p}</option>)}
            </select>
            <select value={eventoFilter} onChange={e=>setEventoFilter(e.target.value)} style={{fontSize:12.5,padding:'6px 10px',borderRadius:6,border:'1px solid var(--line)',background:'var(--surface-2)',color:'var(--text)'}}>
              <option value="all">Todos os eventos</option>
              {EVENT_ORDER.map(ev=><option key={ev} value={ev}>{ev}</option>)}
            </select>
            <button className="btn" onClick={()=>onExport(capiEvents,'funil-crm.csv')}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              Exportar CSV
            </button>
          </div>
        </div>
        {filtered.length===0?(
          <div style={{fontSize:13,color:'var(--text-3)',textAlign:'center',padding:'32px 0'}}>Nenhum lead encontrado.</div>
        ):(
          <div style={{overflowX:'auto'}}>
            <table className="data-table">
              <thead><tr>
                <th>Contato</th>
                <th>Funil</th>
                <th>Último evento</th>
                <th className="r">Eventos</th>
                <th className="r">Dias no funil</th>
                <th className="r">Última atividade</th>
                <th></th>
              </tr></thead>
              <tbody>
                {filtered.map(l=>(
                  <tr key={l.phone} className="rowlink" onClick={()=>onOpenLead(l.phone)}>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        {l.temCtwa&&<span style={{fontSize:10,fontWeight:700,padding:'2px 5px',borderRadius:3,background:'rgba(200,23,42,.12)',color:'var(--red)',flexShrink:0}}>CTWA</span>}
                        <div>
                          <div className="row-title" style={{fontSize:12.5}}>{fmtPhone(l.phone)}</div>
                          <div className="row-sub">{l.email??'Sem e-mail'}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="t-muted">{PIPELINE_NAMES[l.pipeline_id??'']??'—'}</span></td>
                    <td><span style={{fontWeight:600,fontSize:12.5,color:l.ultimoEvento==='Purchase'?'var(--gold)':'var(--text)'}}>{l.ultimoEvento}</span></td>
                    <td className="r num">{l.totalEventos}</td>
                    <td className="r num">{l.diasNoFunil===0?'<1d':`${l.diasNoFunil}d`}</td>
                    <td className="r"><span className="t-muted">{fmtDateTime(l.ultimaAtividade)}</span></td>
                    <td className="arrow-cell">›</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Meta Ads ────────────────────────────────────────────────────────────────

function MetaView({ campaignSeries, totalLeads, totalConversations, avgFreq, onDetail }: {
  campaignSeries: CampaignSeries[]; totalLeads: number; totalConversations: number; avgFreq: number
  onDetail: (s: CampaignSeries) => void
}) {
  const [subTab, setSubTab] = useState<MetaSubTab>('campanhas')
  const SUB: {key:MetaSubTab;label:string}[] = [
    {key:'campanhas',label:'Campanhas'},
    {key:'saude',label:'Saúde do Anúncio'},
    {key:'insights',label:'Insights'},
  ]
  return (
    <>
      <div style={{display:'flex',gap:18,marginBottom:18,borderBottom:'1px solid var(--line-soft)'}}>
        {SUB.map(s=>(
          <div key={s.key} onClick={()=>setSubTab(s.key)} style={{padding:'0 2px 10px',fontSize:13,fontWeight:500,cursor:'pointer',marginBottom:-1,color:subTab===s.key?'var(--text)':'var(--text-3)',borderBottom:subTab===s.key?'1.5px solid var(--red)':'1.5px solid transparent'}}>
            {s.label}
          </div>
        ))}
      </div>
      {subTab==='campanhas'&&<CampanhaMetaView campaignSeries={campaignSeries} onDetail={onDetail}/>}
      {subTab==='saude'&&<SaudeView campaignSeries={campaignSeries}/>}
      {subTab==='insights'&&<InsightsView campaignSeries={campaignSeries} totalLeads={totalLeads} totalConversations={totalConversations} avgFreq={avgFreq}/>}
    </>
  )
}

function CampanhaMetaView({ campaignSeries, onDetail }: { campaignSeries: CampaignSeries[]; onDetail: (s: CampaignSeries) => void }) {
  const [metric,setMetric]=useState<ChartMetric>('leads')
  const METRICS:{key:ChartMetric;label:string}[]=[{key:'leads',label:'Leads'},{key:'spend',label:'Gasto'},{key:'cpl',label:'CPL'},{key:'reach',label:'Alcance'},{key:'frequency',label:'Frequência'}]
  if (campaignSeries.length===0) return <div className="panel" style={{fontSize:13,color:'var(--text-3)',textAlign:'center',padding:40}}>Nenhuma campanha Meta Ads no período.</div>
  return (
    <>
      {campaignSeries.length>0&&campaignSeries[0].points.length>1&&(
        <div className="panel" style={{marginBottom:14}}>
          <div className="panel-head" style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
            <div className="panel-title">Evolução diária <span>por campanha</span></div>
            <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
              {METRICS.map(m=><button key={m.key} onClick={()=>setMetric(m.key)} style={{padding:'4px 10px',fontSize:12,borderRadius:5,border:'none',cursor:'pointer',fontWeight:500,background:metric===m.key?'var(--red)':'transparent',color:metric===m.key?'#fff':'var(--text-3)'}}>{m.label}</button>)}
            </div>
          </div>
          <LineChart series={campaignSeries} metric={metric} height={200}/>
        </div>
      )}
      <div className="panel">
        <div className="panel-head"><div className="panel-title">Campanhas <span>clique para detalhar</span></div></div>
        <div style={{overflowX:'auto'}}>
          <table className="data-table">
            <thead><tr><th>Campanha</th><th className="r">Leads</th><th className="r">Alcance</th><th className="r">Freq.</th><th className="r">Conversas</th><th className="r">CTR</th><th className="r">CPL</th><th className="r">Gasto</th><th></th></tr></thead>
            <tbody>
              {campaignSeries.map(s=>{
                const ctr=s.total_impressions>0?`${((s.total_clicks/s.total_impressions)*100).toFixed(2).replace('.',',')}%`:'—'
                return (
                  <tr key={s.campaign_id} className="rowlink" onClick={()=>onDetail(s)}>
                    <td><div style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:8,height:8,borderRadius:'50%',background:s.color,flexShrink:0}}/><span className="row-title">{s.campaign_name.replace(/\[|\]/g,' ').replace(/\s+/g,' ').trim()}</span></div></td>
                    <td className="r cell-num num">{fmtNum(s.total_leads)}</td>
                    <td className="r num">{s.total_reach>0?fmtNum(s.total_reach):'—'}</td>
                    <td className="r num" style={s.avg_frequency>=3?{color:'var(--gold)'}:{}}>{s.avg_frequency>0?s.avg_frequency.toFixed(2)+'×':'—'}</td>
                    <td className="r num">{s.total_conversations>0?fmtNum(s.total_conversations):'—'}</td>
                    <td className="r num">{ctr}</td>
                    <td className="r num">{fmtBRL(s.avg_cpl)}</td>
                    <td className="r num">{fmtBRL(s.total_spend)}</td>
                    <td className="arrow-cell">›</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ─── WhatsApp ────────────────────────────────────────────────────────────────

// Paleta suave e coesa para o gráfico de engajamento
const ENGAJ_COLORS = {
  respondeu:   { bar: '#34A853', bg: 'rgba(52,168,83,.08)',   text: '#1E7A3A' },
  leu:         { bar: '#FBBC04', bg: 'rgba(251,188,4,.08)',   text: '#B8860B' },
  recebeu:     { bar: '#4285F4', bg: 'rgba(66,133,244,.08)',  text: '#2A5DB0' },
  naoRecebeu:  { bar: '#BDC1C6', bg: 'rgba(189,193,198,.08)', text: '#80868B' },
}

function WppEngajamentoChart({ campanha, variante }: { campanha: WppCampanha | null; variante: WppVariante | null }) {
  const src = variante ?? campanha
  if (!src) return null
  const total = src.total_envios
  const entregues = src.entregues
  const lidos = src.lidos
  const respondidos = src.respondidos
  const pendentes = Math.max(0, total - entregues - src.falhas)

  const segments = [
    { label: 'Respondeu',   count: respondidos,            pct: total > 0 ? (respondidos / total) * 100 : 0,                c: ENGAJ_COLORS.respondeu },
    { label: 'Leu',         count: lidos - respondidos,    pct: total > 0 ? ((lidos - respondidos) / total) * 100 : 0,      c: ENGAJ_COLORS.leu },
    { label: 'Recebeu',     count: entregues - lidos,      pct: total > 0 ? ((entregues - lidos) / total) * 100 : 0,        c: ENGAJ_COLORS.recebeu },
    { label: 'Não recebeu', count: src.falhas + pendentes, pct: total > 0 ? ((src.falhas + pendentes) / total) * 100 : 0,  c: ENGAJ_COLORS.naoRecebeu },
  ]

  const hasData = total > 0

  return (
    <div style={{ width: '100%' }}>

      {/* Barra empilhada */}
      <div style={{ width: '100%', height: 28, borderRadius: 8, overflow: 'hidden', display: 'flex', background: 'var(--line-soft)' }}>
        {hasData && segments.filter(s => s.count > 0).map((s, i, arr) => (
          <div
            key={s.label}
            title={`${s.label}: ${s.pct.toFixed(1)}%`}
            style={{
              width: `${s.pct}%`,
              background: s.c.bar,
              borderRadius: i === 0 ? '8px 0 0 8px' : i === arr.length - 1 ? '0 8px 8px 0' : 0,
              transition: 'width .6s ease',
              position: 'relative',
              minWidth: s.count > 0 ? 3 : 0,
            }}
          />
        ))}
        {!hasData && <div style={{ flex: 1, background: 'var(--line)' }} />}
      </div>

      {/* Legenda — linha por categoria */}
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {segments.map(s => {
          const isEmpty = s.count === 0
          return (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: isEmpty ? 0.35 : 1 }}>
              {/* dot colorido */}
              <div style={{ width: 10, height: 10, borderRadius: 3, background: s.c.bar, flexShrink: 0 }} />

              {/* mini barra proporcional */}
              <div style={{ flex: 1, height: 4, background: 'var(--line-soft)', borderRadius: 2, overflow: 'hidden', maxWidth: 200 }}>
                <div style={{ height: '100%', width: `${s.pct}%`, background: s.c.bar, borderRadius: 2, transition: 'width .6s ease' }} />
              </div>

              {/* label */}
              <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500, width: 140, flexShrink: 0 }}>{s.label}</div>

              {/* % */}
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: 15,
                color: isEmpty ? 'var(--text-3)' : s.c.bar, width: 52, textAlign: 'right', flexShrink: 0 }}>
                {s.pct > 0 ? `${s.pct.toFixed(1).replace('.', ',')}%` : '—'}
              </div>

              {/* contagem */}
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 600, fontSize: 15,
                color: isEmpty ? 'var(--text-3)' : 'var(--text)', width: 36, textAlign: 'right', flexShrink: 0 }}>
                {s.count > 0 ? fmtNum(s.count) : '—'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Sankey Funil WPP ────────────────────────────────────────────────────────

function WppSankeyFunil({ enviados, entregues, lidos, respondidos }: {
  enviados: number; entregues: number; lidos: number; respondidos: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [width, setWidth] = useState(700)

  useEffect(() => {
    if (!wrapRef.current) return
    const obs = new ResizeObserver(es => setWidth(es[0].contentRect.width))
    obs.observe(wrapRef.current)
    setWidth(wrapRef.current.clientWidth)
    return () => obs.disconnect()
  }, [])

  const SVG_H = 120          // altura só do diagrama
  const PAD = { top: 8, bottom: 8 }
  const chartH = SVG_H - PAD.top - PAD.bottom

  const steps = [
    { key: 'env',  label: 'Enviados',    pct: '100%',
      sub: `${fmtNum(enviados)} disparos`,
      count: enviados,    color: '#9AA0A6' },
    { key: 'ent',  label: 'Entregues',
      pct: enviados > 0 ? `${((entregues/enviados)*100).toFixed(1).replace('.',',')}%` : '—',
      sub: 'dos enviados',
      count: entregues,   color: '#4285F4' },
    { key: 'lid',  label: 'Lidos',
      pct: entregues > 0 ? `${((lidos/entregues)*100).toFixed(1).replace('.',',')}%` : '—',
      sub: 'dos entregues',
      count: lidos,       color: '#FBBC04' },
    { key: 'res',  label: 'Respondidos',
      pct: lidos > 0 ? `${((respondidos/lidos)*100).toFixed(1).replace('.',',')}%` : '—',
      sub: 'dos lidos',
      count: respondidos, color: '#34A853' },
  ]

  const base = enviados || 1
  const nodeW = Math.max(14, Math.min(28, width * 0.03))
  const gap   = (width - nodeW * steps.length) / (steps.length - 1)

  const nodeH = (n: number) => Math.max((n / base) * chartH, n > 0 ? 4 : 2)
  const nodeY = (n: number) => PAD.top + (chartH - nodeH(n)) / 2
  const nodeX = (i: number) => i * (nodeW + gap)

  const flowPath = (i: number) => {
    const L = steps[i], R = steps[i + 1]
    const x1 = nodeX(i) + nodeW, x2 = nodeX(i + 1)
    const y1t = nodeY(L.count), y1b = y1t + nodeH(L.count)
    const rH = nodeH(R.count)
    const lc = nodeY(L.count) + nodeH(L.count) / 2
    const y2t = lc - rH / 2, y2b = lc + rH / 2
    const cx = (x1 + x2) / 2
    return `M${x1},${y1t} C${cx},${y1t} ${cx},${y2t} ${x2},${y2t} L${x2},${y2b} C${cx},${y2b} ${cx},${y1b} ${x1},${y1b} Z`
  }

  const lossPath = (i: number) => {
    const L = steps[i], R = steps[i + 1]
    const x1 = nodeX(i) + nodeW, x2 = nodeX(i + 1)
    const lH = nodeH(L.count), rH = nodeH(R.count)
    const lossH = lH - rH
    if (lossH <= 0) return null
    const lc = nodeY(L.count) + lH / 2
    const y1t = lc + rH / 2, y1b = y1t + lossH
    const dropY = Math.min(PAD.top + chartH + 10, y1b + 16)
    const cx = (x1 + x2) / 2
    return `M${x1},${y1t} C${cx},${y1t} ${cx},${y1b} ${x2},${dropY} L${x1},${dropY} Z`
  }

  // posição horizontal central de cada nó (para alinhar labels HTML)
  const centerPct = (i: number) => `${((nodeX(i) + nodeW / 2) / width) * 100}%`

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>

      {/* SVG — só o diagrama, sem texto */}
      <svg ref={svgRef} width="100%" height={SVG_H} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          {steps.slice(0,-1).map((s,i) => (
            <linearGradient key={i} id={`sk-g-${i}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor={s.color}          stopOpacity="0.4"/>
              <stop offset="100%" stopColor={steps[i+1].color} stopOpacity="0.4"/>
            </linearGradient>
          ))}
          {steps.slice(0,-1).map((s,i) => (
            <linearGradient key={`lk${i}`} id={`sk-l-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={s.color} stopOpacity="0.15"/>
              <stop offset="100%" stopColor={s.color} stopOpacity="0"/>
            </linearGradient>
          ))}
        </defs>

        {/* perdas */}
        {steps.slice(0,-1).map((_,i) => {
          const p = lossPath(i); if (!p) return null
          return <path key={`l${i}`} d={p} fill={`url(#sk-l-${i})`}/>
        })}
        {/* fluxos */}
        {steps.slice(0,-1).map((_,i) => (
          <path key={`f${i}`} d={flowPath(i)} fill={`url(#sk-g-${i})`}/>
        ))}
        {/* nós */}
        {steps.map((s,i) => (
          <rect key={s.key} x={nodeX(i)} y={nodeY(s.count)} width={nodeW} height={nodeH(s.count)}
            rx={3} fill={s.color} opacity={s.count > 0 ? 1 : 0.2}/>
        ))}
      </svg>

      {/* Labels HTML — hierarquia tipográfica completa */}
      <div style={{ position: 'relative', height: 72, marginTop: 8 }}>
        {steps.map((s, i) => (
          <div key={s.key} style={{
            position: 'absolute',
            left: centerPct(i),
            transform: 'translateX(-50%)',
            textAlign: 'center',
            width: Math.max(80, gap * 0.9),
          }}>
            {/* eyebrow — nome da etapa */}
            <div style={{
              fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.07em', color: s.color, marginBottom: 4,
              opacity: s.count > 0 ? 1 : 0.45,
            }}>{s.label}</div>

            {/* número principal — elemento dominante */}
            <div style={{
              fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700,
              fontSize: 26, lineHeight: 1, letterSpacing: '-0.01em',
              color: s.count > 0 ? 'var(--text)' : 'var(--text-3)',
              marginBottom: 4,
            }}>
              {s.count > 0 ? fmtNum(s.count) : '—'}
            </div>

            {/* porcentagem — destaque secundário com cor da etapa */}
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: s.count > 0 ? s.color : 'var(--text-3)',
              marginBottom: 2,
            }}>{s.pct}</div>

            {/* contexto — tom apagado */}
            <div style={{
              fontSize: 10.5, color: 'var(--text-3)', fontWeight: 400,
            }}>{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function WppDetalheCampanha({ campanha, onBack }: { campanha: WppCampanha; onBack: () => void }) {
  const [variantes, setVariantes] = useState<WppVariante[]>([])
  const [varianteAtiva, setVarianteAtiva] = useState<string>('geral')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWppVariantes([campanha.id]).then(vs => {
      setVariantes(vs)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [campanha.id])

  const temAB = variantes.length >= 2
  const varianteObj = varianteAtiva === 'geral' ? null : variantes.find(v => v.id === varianteAtiva) ?? null

  const src = varianteObj ?? campanha
  const taxaEntrega = src.total_envios > 0 ? ((src.entregues / src.total_envios) * 100).toFixed(1).replace('.', ',') : '—'
  const taxaLeitura = src.entregues > 0 ? ((src.lidos / src.entregues) * 100).toFixed(1).replace('.', ',') : '—'
  const taxaResposta = src.lidos > 0 ? ((src.respondidos / src.lidos) * 100).toFixed(1).replace('.', ',') : '—'

  return (
    <div>
      {/* Header */}
      <div onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer', marginBottom: 20, fontWeight: 500 }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}>
        <Icon name="arrow-left" /> Voltar
      </div>

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: 'clamp(18px,3vw,26px)', marginBottom: 4 }}>{campanha.name}</h2>
        <div style={{ color: 'var(--text-3)', fontSize: 12.5 }}>
          {campanha.status === 'completed' ? 'Concluída' : campanha.status === 'running' ? 'Em andamento' : campanha.status}
          {campanha.completed_at ? ` · ${new Date(campanha.completed_at).toLocaleDateString('pt-BR')}` : ''}
          {campanha.started_at ? ` · Iniciada ${new Date(campanha.started_at).toLocaleDateString('pt-BR')}` : ''}
        </div>
      </div>

      {/* Toggle A/B — só aparece quando tem variantes */}
      {!loading && temAB && (
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: 'var(--surface-2)', borderRadius: 8, padding: 4, width: 'fit-content', border: '1px solid var(--line)' }}>
          <button
            onClick={() => setVarianteAtiva('geral')}
            style={{ padding: '6px 16px', fontSize: 12.5, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: varianteAtiva === 'geral' ? 'var(--surface)' : 'transparent', color: varianteAtiva === 'geral' ? 'var(--text)' : 'var(--text-3)', boxShadow: varianteAtiva === 'geral' ? '0 1px 4px rgba(0,0,0,.15)' : 'none' }}>
            Geral
          </button>
          {variantes.map(v => (
            <button
              key={v.id}
              onClick={() => setVarianteAtiva(v.id)}
              style={{ padding: '6px 16px', fontSize: 12.5, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: varianteAtiva === v.id ? 'var(--surface)' : 'transparent', color: varianteAtiva === v.id ? 'var(--text)' : 'var(--text-3)', boxShadow: varianteAtiva === v.id ? '0 1px 4px rgba(0,0,0,.15)' : 'none' }}>
              Versão {v.label}
            </button>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Enviados',    value: fmtNum(src.total_envios), sub: '100%',                                                                                                                             accent: '#9AA0A6' },
          { label: 'Entregues',   value: fmtNum(src.entregues),    sub: `${taxaEntrega}% dos enviados`,                                                                                                     accent: '#4285F4' },
          { label: 'Lidos',       value: fmtNum(src.lidos),        sub: `${taxaLeitura}% dos entregues`,                                                                                                    accent: '#FBBC04' },
          { label: 'Respondidos', value: fmtNum(src.respondidos),  sub: `${taxaResposta}% dos lidos`,       green: src.respondidos > 0,                                                                    accent: '#34A853' },
          { label: 'Falhas',      value: src.falhas > 0 ? fmtNum(src.falhas) : '—', sub: src.total_envios > 0 ? `${((src.falhas / src.total_envios) * 100).toFixed(1).replace('.', ',')}%` : '—', danger: src.falhas > 0, accent: 'var(--danger)' },
          { label: 'Custo',       value: campanha.custo_total > 0 ? fmtBRL(campanha.custo_total) : '—',     sub: campanha.total_envios > 0 && campanha.custo_total > 0 ? `${fmtBRL(campanha.custo_total / campanha.total_envios)}/disparo` : '—', accent: 'var(--text-3)' },
        ].map(k => (
          <div key={k.label} className="kpi-card" style={{ position: 'relative', overflow: 'hidden' }}>
            {/* accent line no topo */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: (k as any).accent ?? 'var(--line)', borderRadius: '8px 8px 0 0', opacity: 0.7 }} />
            <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: (k as any).accent ?? 'var(--text-3)', flexShrink: 0, opacity: 0.8 }} />
              {k.label}
            </div>
            <div className="kpi-value num" style={(k as any).green ? { color: '#34A853' } : (k as any).danger ? { color: 'var(--danger)' } : {}}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Gráfico de engajamento */}
      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-head" style={{ marginBottom: 16 }}>
          <div className="panel-title">Engajamento <span>{varianteAtiva === 'geral' ? 'visão geral' : `Versão ${variantes.find(v => v.id === varianteAtiva)?.label}`}</span></div>
        </div>
        <WppEngajamentoChart campanha={campanha} variante={varianteObj} />

      </div>

      {/* Funil de entrega — Sankey */}
      <div className="panel">
        <div className="panel-head"><div className="panel-title">Funil de entrega</div></div>
        <div style={{ padding: '12px 8px 0' }}>
          <WppSankeyFunil
            enviados={src.total_envios}
            entregues={src.entregues}
            lidos={src.lidos}
            respondidos={src.respondidos}
          />
        </div>
      </div>
    </div>
  )
}

function WppView({ wppCampanhas }: { wppCampanhas: WppCampanha[] }) {
  const [detalheCampanha, setDetalheCampanha] = useState<WppCampanha | null>(null)
  const [selectedCampanha] = useState<WppCampanha | null>(null)

  if (detalheCampanha) {
    return <WppDetalheCampanha campanha={detalheCampanha} onBack={() => setDetalheCampanha(null)} />
  }

  if (wppCampanhas.length === 0) return (
    <div className="panel" style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: 40 }}>
      Nenhuma campanha de WhatsApp no período.
    </div>
  )

  const totalEnvios = wppCampanhas.reduce((s, c) => s + c.total_envios, 0)
  const totalEntregues = wppCampanhas.reduce((s, c) => s + c.entregues, 0)
  const totalLidos = wppCampanhas.reduce((s, c) => s + c.lidos, 0)
  const totalRespondidos = wppCampanhas.reduce((s, c) => s + c.respondidos, 0)
  const totalFalhas = wppCampanhas.reduce((s, c) => s + c.falhas, 0)
  const totalCusto = wppCampanhas.reduce((s, c) => s + c.custo_total, 0)

  const taxaEntrega = totalEnvios > 0 ? ((totalEntregues / totalEnvios) * 100).toFixed(1).replace('.', ',') : '—'
  const taxaLeitura = totalEntregues > 0 ? ((totalLidos / totalEntregues) * 100).toFixed(1).replace('.', ',') : '—'
  const taxaResposta = totalLidos > 0 ? ((totalRespondidos / totalLidos) * 100).toFixed(1).replace('.', ',') : '—'

  const campanha = selectedCampanha

  return (
    <>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Disparos totais', value: fmtNum(totalEnvios),     sub: `${wppCampanhas.length} campanha${wppCampanhas.length > 1 ? 's' : ''}`,                                        accent: '#9AA0A6' },
          { label: 'Entregues',       value: fmtNum(totalEntregues),   sub: `${taxaEntrega}% dos disparos`,                                                                                 accent: '#4285F4' },
          { label: 'Lidos',           value: fmtNum(totalLidos),       sub: `${taxaLeitura}% dos entregues`,                                                                                accent: '#FBBC04' },
          { label: 'Respondidos',     value: fmtNum(totalRespondidos), sub: `${taxaResposta}% dos lidos`,        green: totalRespondidos > 0,                                               accent: '#34A853' },
          { label: 'Falhas',          value: totalFalhas > 0 ? fmtNum(totalFalhas) : '—', sub: totalEnvios > 0 ? `${((totalFalhas / totalEnvios) * 100).toFixed(1).replace('.', ',')}%` : '—', danger: totalFalhas > 0, accent: 'var(--danger)' },
          { label: 'Custo WPP',       value: fmtBRL(totalCusto),       sub: totalEnvios > 0 ? `${fmtBRL(totalCusto / totalEnvios)}/disparo` : '—',                                         accent: 'var(--text-3)' },
        ].map(k => (
          <div key={k.label} className="kpi-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: (k as any).accent ?? 'var(--line)', borderRadius: '8px 8px 0 0', opacity: 0.7 }} />
            <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: (k as any).accent ?? 'var(--text-3)', flexShrink: 0, opacity: 0.8 }} />
              {k.label}
            </div>
            <div className="kpi-value num" style={(k as any).green ? { color: '#34A853' } : (k as any).danger ? { color: 'var(--danger)' } : {}}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Funil consolidado — Sankey */}
      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div className="panel-title">Funil de entrega <span>todas as campanhas</span></div>
        </div>
        <div style={{ padding: '12px 8px 0' }}>
          <WppSankeyFunil
            enviados={totalEnvios}
            entregues={totalEntregues}
            lidos={totalLidos}
            respondidos={totalRespondidos}
          />
        </div>
      </div>

      {/* Tabela de campanhas */}
      <div className="panel">
        <div className="panel-head"><div className="panel-title">Campanhas WhatsApp <span>clique para ver detalhes</span></div></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Campanha</th>
                <th className="r">Enviados</th>
                <th className="r">Entregues</th>
                <th className="r">Lidos</th>
                <th className="r">Respondidos</th>
                <th className="r">Falhas</th>
                <th className="r">Custo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {wppCampanhas.map(c => {
                const isSelected = campanha?.id === c.id
                return (
                  <tr
                    key={c.id}
                    className="rowlink"
                    onClick={() => setDetalheCampanha(c)}
                    style={isSelected ? { background: 'var(--active)' } : {}}
                  >
                    <td>
                      <div className="row-title">{c.name}</div>
                      <div className="row-sub">
                        {c.status === 'completed' ? 'Concluída' : c.status === 'running' ? 'Em andamento' : c.status}
                        {c.completed_at ? ` · ${new Date(c.completed_at).toLocaleDateString('pt-BR')}` : ''}
                      </div>
                    </td>
                    <td className="r cell-num num">{fmtNum(c.total_envios)}</td>
                    <td className="r num">
                      {fmtNum(c.entregues)}
                      <span style={{ color: 'var(--text-3)', fontSize: 11, marginLeft: 4 }}>
                        {c.total_envios > 0 ? `${((c.entregues / c.total_envios) * 100).toFixed(0)}%` : ''}
                      </span>
                    </td>
                    <td className="r num">
                      {fmtNum(c.lidos)}
                      <span style={{ color: 'var(--text-3)', fontSize: 11, marginLeft: 4 }}>
                        {c.entregues > 0 ? `${((c.lidos / c.entregues) * 100).toFixed(0)}%` : ''}
                      </span>
                    </td>
                    <td className="r num" style={{ color: c.respondidos > 0 ? 'var(--green)' : 'var(--text-3)' }}>
                      {c.respondidos > 0 ? fmtNum(c.respondidos) : '—'}
                      <span style={{ color: 'var(--text-3)', fontSize: 11, marginLeft: 4 }}>
                        {c.lidos > 0 && c.respondidos > 0 ? `${((c.respondidos / c.lidos) * 100).toFixed(0)}%` : ''}
                      </span>
                    </td>
                    <td className="r num" style={{ color: c.falhas > 0 ? 'var(--danger)' : 'var(--text-3)' }}>
                      {c.falhas > 0 ? fmtNum(c.falhas) : '—'}
                    </td>
                    <td className="r num">{c.custo_total > 0 ? fmtBRL(c.custo_total) : '—'}</td>
                    <td className="arrow-cell">›</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ─── Saúde do Anúncio ─────────────────────────────────────────────────────────

function SaudeView({campaignSeries}:{campaignSeries:CampaignSeries[]}) {
  if (campaignSeries.length===0) return <div className="panel" style={{fontSize:13,color:'var(--text-3)',textAlign:'center',padding:40}}>Nenhuma campanha no período.</div>
  return (
    <>
      <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:'1px',color:'var(--text-3)',fontWeight:600,marginBottom:12}}>
        Avaliação Meta — comparado com anúncios concorrentes no mesmo público
      </div>
      {campaignSeries.map(s=>(
        <div className="panel" key={s.campaign_id} style={{marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
            <span style={{width:10,height:10,borderRadius:'50%',background:s.color,flexShrink:0}}/>
            <div className="panel-title" style={{fontSize:14}}>{s.campaign_name.replace(/\[|\]/g,' ').replace(/\s+/g,' ').trim()}</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:16}}>
            {[
              {label:'Qualidade do anúncio',value:s.quality_ranking,desc:'Percepção de qualidade e relevância do criativo'},
              {label:'Taxa de engajamento',value:s.engagement_rate_ranking,desc:'Curtidas, comentários e cliques vs concorrentes'},
              {label:'Taxa de conversão',value:s.conversion_rate_ranking,desc:'Conversões esperadas vs anúncios com mesmo objetivo'},
            ].map(item=>(
              <div key={item.label} style={{padding:'12px 14px',background:'var(--surface-2)',borderRadius:8,border:'1px solid var(--line)'}}>
                <div style={{fontSize:12,color:'var(--text-3)',marginBottom:8,fontWeight:500}}>{item.label}</div>
                <div style={{marginBottom:8}}><RankingBadge value={item.value}/></div>
                <RankingBar value={item.value}/>
                <div style={{fontSize:11,color:'var(--text-3)',marginTop:6,lineHeight:1.4}}>{item.desc}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:16,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:12}}>
            {[
              {label:'Alcance único',value:s.total_reach>0?fmtNum(s.total_reach):'—'},
              {label:'Frequência média',value:s.avg_frequency>0?s.avg_frequency.toFixed(2)+'×':'—',warn:s.avg_frequency>=3},
              {label:'Conversas iniciadas',value:s.total_conversations>0?fmtNum(s.total_conversations):'—'},
              {label:'Taxa leads→conversa',value:s.total_leads>0&&s.total_conversations>0?`${((s.total_conversations/s.total_leads)*100).toFixed(1).replace('.',',')}%`:'—'},
            ].map(k=>(
              <div key={k.label}>
                <div style={{fontSize:11,color:'var(--text-3)',marginBottom:3,fontWeight:500}}>{k.label}</div>
                <div style={{fontSize:18,fontFamily:'Barlow Condensed, sans-serif',fontWeight:700,color:(k as any).warn?'var(--gold)':'var(--text)'}}>{k.value}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

// ─── Insights Automáticos ─────────────────────────────────────────────────────

function InsightsView({campaignSeries,totalLeads,totalConversations,avgFreq}:{
  campaignSeries:CampaignSeries[];totalLeads:number;totalConversations:number;avgFreq:number
}) {
  type Insight={type:'warn'|'good'|'info';title:string;body:string}
  const insights:Insight[]=[]

  for (const s of campaignSeries) {
    if (s.avg_frequency>=4) insights.push({type:'warn',title:`${s.campaign_name.split(']')[0].replace('[','').trim()} com frequência crítica — ${s.avg_frequency.toFixed(1)}×`,body:`Frequência acima de 4× indica que o mesmo usuário está vendo o anúncio repetido demais. O CPL tende a subir com o público saturado. Considere pausar por 7 dias ou expandir o público-alvo.`})
    else if (s.avg_frequency>=2.5) insights.push({type:'warn',title:`${s.campaign_name.split(']')[0].replace('[','').trim()} se aproximando da saturação — ${s.avg_frequency.toFixed(1)}×`,body:`Frequência acima de 2.5× começa a elevar o CPL em campanhas de remarketing. Monitore os próximos dias: se o CPL subir mais de 20%, pausar ou trocar o criativo são boas opções.`})
    if (s.conversion_rate_ranking==='below_average') insights.push({type:'warn',title:`Taxa de conversão abaixo da média — ${s.campaign_name.split(']')[0].replace('[','').trim()}`,body:`A Meta avalia que esse anúncio converte menos que concorrentes com o mesmo objetivo e público. Isso pode indicar que o criativo gera curiosidade mas não urgência, ou que a landing page (WhatsApp) tem atrito no primeiro contato.`})
    if (s.quality_ranking==='above_average') insights.push({type:'good',title:`Criativo bem avaliado pela Meta — ${s.campaign_name.split(']')[0].replace('[','').trim()}`,body:`Qualidade acima da média significa que o anúncio recebe menos feedbacks negativos que os concorrentes. Isso reduz o custo de distribuição — é um bom momento para escalar o investimento.`})
    if (s.total_conversations>0&&s.total_leads>0) {
      const rate=(s.total_conversations/s.total_leads)*100
      if (rate<70) insights.push({type:'warn',title:`${(100-rate).toFixed(0)}% dos leads não iniciaram conversa — ${s.campaign_name.split(']')[0].replace('[','').trim()}`,body:`${rate.toFixed(0)}% das pessoas que clicaram no anúncio efetivamente enviaram mensagem no WhatsApp. O restante pode ter desistido pelo tempo de carregamento ou pela expectativa não correspondida no criativo vs. o que encontrou.`})
      else insights.push({type:'good',title:`Alta conversão lead→conversa — ${rate.toFixed(0)}% — ${s.campaign_name.split(']')[0].replace('[','').trim()}`,body:`A maioria dos leads que clicam no anúncio efetivamente abre uma conversa no WhatsApp. Isso indica que o criativo está alinhado com a expectativa do público.`})
    }
    const bestDay=[...s.points].sort((a,b)=>b.leads-a.leads)[0]
    if (bestDay&&bestDay.leads>0&&s.points.length>3) {
      const avg=s.total_leads/s.points.length
      if (bestDay.leads>avg*2) insights.push({type:'info',title:`Pico de ${bestDay.leads} leads em ${fmtShortDate(bestDay.date)} — ${s.campaign_name.split(']')[0].replace('[','').trim()}`,body:`Esse dia teve ${((bestDay.leads/avg-1)*100).toFixed(0)}% mais leads que a média do período (${avg.toFixed(1)} leads/dia). Vale investigar qual criativo ou segmentação estava ativo nessa data para replicar o desempenho.`})
    }
  }

  if (totalLeads>0&&totalConversations>0) {
    const gapRate=((totalLeads-totalConversations)/totalLeads)*100
    if (gapRate>25) insights.push({type:'info',title:`${gapRate.toFixed(0)}% dos leads não chegaram ao WhatsApp`,body:`No total, ${fmtNum(totalLeads-totalConversations)} pessoas clicaram nos anúncios mas não iniciaram conversa. Esse gap pode ser reduzido com um link direto mais eficiente ou um texto pré-preenchido no WhatsApp que reduza o atrito de começar a conversa.`})
  }

  if (avgFreq<1.5&&campaignSeries.length>0) insights.push({type:'info',title:'Frequência baixa — público ainda tem espaço para crescer',body:`Frequência média de ${avgFreq.toFixed(1)}× indica que o público ainda não viu os anúncios o suficiente. Há margem para aumentar o orçamento ou ampliar o alcance sem risco de saturação.`})

  if (campaignSeries.length>=2) {
    const comCpl=campaignSeries.filter(s=>s.avg_cpl>0)
    if (comCpl.length>=2) {
      const melhor=[...comCpl].sort((a,b)=>a.avg_cpl-b.avg_cpl)[0]
      const pior=[...comCpl].sort((a,b)=>b.avg_cpl-a.avg_cpl)[0]
      const diff=((pior.avg_cpl-melhor.avg_cpl)/melhor.avg_cpl*100)
      if (diff>15) insights.push({type:'info',title:`CPL ${diff.toFixed(0)}% menor em ${melhor.campaign_name.split(']')[0].replace('[','').trim()}`,body:`O custo por lead dessa campanha é ${fmtBRL(melhor.avg_cpl)} vs ${fmtBRL(pior.avg_cpl)} da outra. Considere migrar parte do orçamento para o criativo/segmentação com melhor retorno.`})
    }
  }

  for (const s of campaignSeries) {
    const diasSemLead=s.points.filter(p=>p.leads===0).length
    const pct=s.points.length>0?(diasSemLead/s.points.length)*100:0
    if (pct>=20&&s.points.length>=5) insights.push({type:'warn',title:`${diasSemLead} de ${s.points.length} dias sem lead — ${s.campaign_name.split(']')[0].replace('[','').trim()}`,body:`${pct.toFixed(0)}% dos dias no período não gerou nenhum lead. Isso pode indicar pausas na veiculação, orçamento diário esgotando cedo, ou períodos de baixa entrega pela Meta.`})
  }

  for (const s of campaignSeries) {
    if (s.total_spend>50&&s.avg_cpl>0) {
      const ref = s.avg_cpl>80?'alto para campanhas de WhatsApp — testar novos criativos pode reduzir o custo':s.avg_cpl>40?'moderado — há espaço para otimização de criativo e segmentação':'dentro do esperado para campanhas de remarketing via WhatsApp'
      insights.push({type: s.avg_cpl>80?'warn':s.avg_cpl>40?'info':'good', title:`CPL de ${fmtBRL(s.avg_cpl)} em ${s.campaign_name.split(']')[0].replace('[','').trim()}`,body:`Com ${fmtBRL(s.total_spend)} investidos no período, o custo por lead está ${ref}.`})
    }
  }

  if (insights.length===0) return (
    <div className="panel" style={{fontSize:13,color:'var(--text-3)',textAlign:'center',padding:40}}>
      Dados insuficientes para gerar insights. Aguarde mais dias de campanha ativa.
    </div>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {insights.map((ins,i)=>(
        <div key={i} className="panel" style={{padding:'14px 16px'}}>
          <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
            <IconBadge tone={ins.type}/>
            <div>
              <div className="t-title" style={{marginBottom:4}}>{ins.title}</div>
              <div className="t-sub">{ins.body}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Detalhe Campanha ─────────────────────────────────────────────────────────

function DetailView({series,onBack}:{series:CampaignSeries;onBack:()=>void}) {
  const [metric,setMetric]=useState<ChartMetric>('leads')
  const ctr=series.total_impressions>0?`${((series.total_clicks/series.total_impressions)*100).toFixed(2).replace('.',',')}%`:'—'
  const convRate=series.total_leads>0&&series.total_conversations>0?`${((series.total_conversations/series.total_leads)*100).toFixed(1).replace('.',',')}%`:'—'
  const METRICS:{key:ChartMetric;label:string}[]=[{key:'leads',label:'Leads'},{key:'spend',label:'Gasto'},{key:'cpl',label:'CPL'},{key:'reach',label:'Alcance'},{key:'frequency',label:'Frequência'}]

  return (
    <div style={{maxWidth:'100%'}}>
      <div onClick={onBack} style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,color:'var(--text-2)',cursor:'pointer',marginBottom:20,fontWeight:500}} onMouseEnter={e=>(e.currentTarget.style.color='var(--text)')} onMouseLeave={e=>(e.currentTarget.style.color='var(--text-2)')}><Icon name="arrow-left"/> Voltar</div>
      <div style={{marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
          <span style={{width:10,height:10,borderRadius:'50%',background:series.color,flexShrink:0}}/>
          <h2 style={{fontFamily:'Barlow Condensed, sans-serif',fontWeight:700,fontSize:'clamp(18px,3vw,26px)',lineHeight:1.2,wordBreak:'break-word'}}>{series.campaign_name.replace(/\[|\]/g,' ').replace(/\s+/g,' ').trim()}</h2>
        </div>
        <div style={{color:'var(--text-3)',fontSize:12.5}}>{series.points[0]?.date} → {series.points[series.points.length-1]?.date} · {series.points.length} dias</div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:20}}>
        {[
          {label:'Leads',value:fmtNum(series.total_leads)},
          {label:'Alcance único',value:series.total_reach>0?fmtNum(series.total_reach):'—'},
          {label:'Frequência média',value:series.avg_frequency>0?series.avg_frequency.toFixed(2)+'×':'—',warn:series.avg_frequency>=3},
          {label:'Conversas WPP',value:series.total_conversations>0?fmtNum(series.total_conversations):'—',sub:convRate!=='—'?`${convRate} dos leads`:''},
          {label:'Gasto total',value:fmtBRL(series.total_spend),sub:`CPL ${fmtBRL(series.avg_cpl)}`},
          {label:'CTR',value:ctr,sub:`${fmtNum(series.total_clicks)} cliques`},
        ].map(k=>(
          <div key={k.label} className="kpi-card">
            <div className="kpi-label"><span className="base-mark"/> {k.label}</div>
            <div className="kpi-value num" style={(k as any).warn?{color:'var(--gold)'}:{}}>{k.value}</div>
            {(k as any).sub&&<div className="kpi-sub num">{(k as any).sub}</div>}
          </div>
        ))}
      </div>

      <div className="panel" style={{marginBottom:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
          <div className="panel-title">Saúde do anúncio</div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12}}>
          {[{label:'Qualidade',value:series.quality_ranking},{label:'Engajamento',value:series.engagement_rate_ranking},{label:'Conversão',value:series.conversion_rate_ranking}].map(r=>(
            <div key={r.label} style={{padding:'10px 12px',background:'var(--surface-2)',borderRadius:8,border:'1px solid var(--line)'}}>
              <div style={{fontSize:11,color:'var(--text-3)',marginBottom:6,fontWeight:500}}>{r.label}</div>
              <RankingBadge value={r.value}/>
              <div style={{marginTop:6}}><RankingBar value={r.value}/></div>
            </div>
          ))}
        </div>
      </div>

      {series.points.length>1&&(
        <div className="panel" style={{marginBottom:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
            <div className="panel-title">Evolução diária</div>
            <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
              {METRICS.map(m=><button key={m.key} onClick={()=>setMetric(m.key)} style={{padding:'4px 10px',fontSize:12,borderRadius:5,border:'none',cursor:'pointer',fontWeight:500,background:metric===m.key?'var(--red)':'transparent',color:metric===m.key?'#fff':'var(--text-3)'}}>{m.label}</button>)}
            </div>
          </div>
          <LineChart series={[series]} metric={metric} height={180}/>
        </div>
      )}

      <div className="panel">
        <div className="panel-head"><div className="panel-title">Dados diários</div></div>
        <div style={{overflowX:'auto',width:'100%'}}>
          <table className="data-table">
            <thead><tr><th>Data</th><th className="r">Leads</th><th className="r">Alcance</th><th className="r">Freq.</th><th className="r">Impressões</th><th className="r">Cliques</th><th className="r">CTR</th><th className="r">Gasto</th><th className="r">CPL</th></tr></thead>
            <tbody>
              {[...series.points].reverse().map(p=>{
                const ctr=p.impressions>0?`${((p.clicks/p.impressions)*100).toFixed(2).replace('.',',')}%`:'—'
                return (
                  <tr key={p.date}>
                    <td style={{fontWeight:500}}>{fmtShortDate(p.date)}</td>
                    <td className="r cell-num num">{fmtNum(p.leads)}</td>
                    <td className="r num">{p.reach>0?fmtNum(p.reach):'—'}</td>
                    <td className="r num" style={p.frequency>=3?{color:'var(--gold)'}:{}}>{p.frequency>0?p.frequency.toFixed(2)+'×':'—'}</td>
                    <td className="r num">{fmtNum(p.impressions)}</td>
                    <td className="r num">{fmtNum(p.clicks)}</td>
                    <td className="r num">{ctr}</td>
                    <td className="r num">{fmtBRL(p.spend)}</td>
                    <td className="r num">{p.cpl>0?fmtBRL(p.cpl):'—'}</td>
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
