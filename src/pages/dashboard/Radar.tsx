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
  reach: number | null
  frequency: number | null
  conversations_started: number | null
  quality_ranking: string | null
  engagement_rate_ranking: string | null
  conversion_rate_ranking: string | null
}

interface WppCampanha {
  id: string; name: string; status: string
  started_at: string | null; completed_at: string | null; created_at: string
  total_envios: number; entregues: number; lidos: number; falhas: number; custo_total: number
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

type Tab = 'geral' | 'campanha' | 'funil' | 'saude' | 'insights'
type SubTab = 'wpp' | 'ads'
type ChartMetric = 'leads' | 'spend' | 'cpl' | 'reach' | 'frequency'
type DatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'this_month' | 'last_month'

const SUPABASE_URL = 'https://syecwttpsvrmhdvinjmt.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5ZWN3dHRwc3ZybWhkdmluam10Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzk1NDgxMywiZXhwIjoyMDk5NTMwODEzfQ.4q7pNim34eP-n38pANB9g7Lud-Y20TU4-VFA5f5WaGo'
const CAMPAIGN_COLORS = ['#C8172A', '#E8A020', '#2E7D52', '#5B6EE8', '#9C27B0']

const STAGE_EVENT_MAP: Record<string, string> = { '69d7f7289d0388002677317a': 'Lead' }
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
  { name: 'Segredos da Confecção', pixel: '2078737449416859', kws: ['SEGREDOS','SC |','SC|'] },
  { name: 'Imersão Paraguai',       pixel: '1012804927965896', kws: ['PARAGUAI','PY |','PY|'] },
  { name: 'Supplytex',              pixel: '961390553583140',  kws: ['SUPPLYTEX','SX |','SX|'] },
  { name: 'Funil Diagnóstico',      pixel: '2006103380028816', kws: ['DIAGNÓSTICO','DIAG |','DIAG|'] },
]

const RANKING_LABEL: Record<string, string> = {
  above_average: 'Acima da média',
  average: 'Na média',
  below_average: 'Abaixo da média',
}
const RANKING_COLOR: Record<string, string> = {
  above_average: 'var(--green)',
  average: 'var(--gold)',
  below_average: '#f87171',
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
function timeSince(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return 'agora'; if (diff < 60) return `há ${diff} min`; return `há ${Math.floor(diff/60)}h`
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
      impressions: r.impressions, clicks: r.clicks,
      reach: r.reach ?? 0, frequency: r.frequency ?? 0,
    }))
    const total_leads = rs.reduce((s,r) => s+r.leads, 0)
    const total_spend = rs.reduce((s,r) => s+r.spend, 0)
    const total_reach = rs.reduce((s,r) => s+(r.reach??0), 0)
    const total_conversations = rs.reduce((s,r) => s+(r.conversations_started??0), 0)
    const avg_frequency = rs.filter(r => r.frequency).reduce((s,r,_,a) => s+(r.frequency??0)/a.length, 0)
    // pegar ranking do registro mais recente
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
      total_envios:es.length, entregues:es.filter((e:any)=>['delivered','read'].includes(e.status)).length,
      lidos:es.filter((e:any)=>e.status==='read').length, falhas:es.filter((e:any)=>e.status==='failed').length,
      custo_total:es.reduce((s:number,e:any)=>s+(e.cost?Number(e.cost):0),0) }
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
        {seriesData.map(s=><div key={s.campaign_id} style={{display:'flex',alignItems:'center',gap:6,fontSize:11.5,color:'var(--text-2)'}}><div style={{width:20,height:2,background:s.color,borderRadius:1}}/>{s.campaign_name.replace(/\[|\]/g,' ').replace(/\s+/g,' ').trim()}</div>)}
      </div>
    </div>
  )
}

// ─── Ranking Badge ────────────────────────────────────────────────────────────

function RankingBadge({ value }: { value: string | null }) {
  if (!value) return <span style={{color:'var(--text-3)',fontSize:12}}>—</span>
  return <span style={{fontSize:11.5,fontWeight:500,color:RANKING_COLOR[value]??'var(--text-2)'}}>{RANKING_LABEL[value]??value}</span>
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
        <div style={{position:'absolute',top:'calc(100% + 6px)',right:0,zIndex:200,background:'var(--surface)',border:'1px solid var(--line)',borderRadius:10,padding:12,width:300,boxShadow:'0 16px 40px rgba(0,0,0,.25)'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:12}}>
            {(Object.keys(PRESET_LABELS) as DatePreset[]).map(p=>(
              <div key={p} onClick={()=>{setPreset(p);setOpen(false)}} style={{padding:'7px 10px',fontSize:12.5,borderRadius:6,cursor:'pointer',fontWeight:500,color:preset===p?'var(--text)':'var(--text-2)',background:preset===p?'rgba(255,255,255,0.06)':'transparent',boxShadow:preset===p?'inset 0 0 0 1px var(--line)':'none'}}>{PRESET_LABELS[p]}</div>
            ))}
          </div>
          <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.8px',color:'var(--text-3)',marginBottom:7,fontWeight:600}}>Período personalizado</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:8}}>
            <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} className="input" style={{fontSize:12.5,padding:'7px 9px',width:'100%',minWidth:0,boxSizing:'border-box'}}/>
            <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)} className="input" style={{fontSize:12.5,padding:'7px 9px',width:'100%',minWidth:0,boxSizing:'border-box'}}/>
          </div>
          <button className="btn primary" style={{width:'100%',justifyContent:'center',fontSize:12.5}} onClick={()=>{if(customFrom&&customTo){setPreset('custom');setOpen(false)}}}>Aplicar</button>
        </div>
      )}
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function Radar() {
  const [tab,setTab]=useState<Tab>('geral')
  const [subTab,setSubTab]=useState<SubTab>('wpp')
  const [preset,setPreset]=useState<DatePreset|'custom'>('30d')
  const [customFrom,setCustomFrom]=useState('')
  const [customTo,setCustomTo]=useState('')
  const [allRows,setAllRows]=useState<MetaAdsInsight[]>([])
  const [campaignSeries,setCampaignSeries]=useState<CampaignSeries[]>([])
  const [wppCampanhas,setWppCampanhas]=useState<WppCampanha[]>([])
  const [funilSteps,setFunilSteps]=useState<FunilStep[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)
  const [syncedAt,setSyncedAt]=useState<string|null>(null)
  const [detail,setDetail]=useState<CampaignSeries|null>(null)
  const [dateLabel,setDateLabel]=useState('Últimos 30 dias')

  const load=useCallback(async()=>{
    setLoading(true);setError(null)
    try {
      const range=preset==='custom'?{from:customFrom,to:customTo}:getDateRange(preset as DatePreset)
      const [rows,wppData,funilData]=await Promise.all([fetchMetaInsights(range.from,range.to),fetchWppCampanhas(range.from,range.to),fetchFunilSteps()])
      setAllRows(rows);setCampaignSeries(buildCampaignSeries(rows));setWppCampanhas(wppData);setFunilSteps(funilData)
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

  const TABS: {key:Tab;label:string}[] = [
    {key:'geral',label:'Visão Geral'},
    {key:'campanha',label:'Por Campanha'},
    {key:'funil',label:'Por Funil'},
    {key:'saude',label:'Saúde do Anúncio'},
    {key:'insights',label:'Insights'},
  ]

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,gap:16,flexWrap:'wrap'}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
            <h1 className="font-display font-semibold text-2xl">Radar de Conversões</h1>
            <span style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:11.5,color:campaignSeries.length>0?'var(--green)':'var(--text-3)'}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:campaignSeries.length>0?'var(--green)':'var(--text-3)',display:'inline-block'}}/>
              {loading?'Sincronizando...':syncedAt?`Sincronizado ${timeSince(syncedAt)}`:'Aguardando dados'}
            </span>
          </div>
          <p className="text-sm" style={{color:'var(--text-3)',marginTop:4}}>Meta Ads + Campanhas WhatsApp · {dateLabel}</p>
        </div>
        <DateFilter preset={preset} setPreset={setPreset} customFrom={customFrom} setCustomFrom={setCustomFrom} customTo={customTo} setCustomTo={setCustomTo} label={dateLabel}/>
      </div>

      {!detail&&(
        <div className="tabs">
          {TABS.map(t=><button key={t.key} className={`tab${tab===t.key?' active':''}`} onClick={()=>setTab(t.key)}>{t.label}</button>)}
        </div>
      )}

      {error&&<div className="panel" style={{padding:'12px 16px',marginBottom:20,color:'#f87171',fontSize:13}}>⚠ Erro: {error}</div>}

      {loading?(
        <div className="panel" style={{padding:40,fontSize:13,color:'var(--text-2)',textAlign:'center'}}>Carregando...</div>
      ):detail?(
        <DetailView series={detail} onBack={()=>setDetail(null)}/>
      ):tab==='geral'?(
        <GeralView campaignSeries={campaignSeries} wppCampanhas={wppCampanhas} funilSteps={funilSteps} totalLeads={totalLeads} totalSpend={totalSpend} totalRev={totalRev} avgCPL={avgCPL} avgROAS={avgROAS} totalReach={totalReach} totalConversations={totalConversations} avgFreq={avgFreq} leadCount={leadCount}/>
      ):tab==='campanha'?(
        <CampanhaView campaignSeries={campaignSeries} wppCampanhas={wppCampanhas} subTab={subTab} setSubTab={setSubTab} onDetail={setDetail}/>
      ):tab==='funil'?(
        <FunilView campaignSeries={campaignSeries} onDetail={setDetail}/>
      ):tab==='saude'?(
        <SaudeView campaignSeries={campaignSeries}/>
      ):(
        <InsightsView campaignSeries={campaignSeries} totalLeads={totalLeads} totalConversations={totalConversations} avgFreq={avgFreq}/>
      )}
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
  const totalWppEntregues=wppCampanhas.reduce((s,c)=>s+c.entregues,0)
  const totalWppLidos=wppCampanhas.reduce((s,c)=>s+c.lidos,0)
  const totalWppCusto=wppCampanhas.reduce((s,c)=>s+c.custo_total,0)
  const convRate=totalLeads>0?((totalConversations/totalLeads)*100):0
  const freqAlert=avgFreq>=3

  const METRICS:{key:ChartMetric;label:string}[]=[
    {key:'leads',label:'Leads'},{key:'spend',label:'Gasto'},{key:'cpl',label:'CPL'},
    {key:'reach',label:'Alcance'},{key:'frequency',label:'Frequência'},
  ]

  return (
    <>
      <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:'1px',color:'var(--text-3)',fontWeight:600,marginBottom:8}}>Meta Ads</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:20}}>
        {[
          {label:'Leads gerados',value:fmtNum(totalLeads),sub:`${campaignSeries.length} campanhas`},
          {label:'Alcance único',value:fmtNum(totalReach),sub:`${fmtNum(campaignSeries.reduce((s,c)=>s+c.total_impressions,0))} impressões`},
          {label:'Frequência média',value:avgFreq>0?avgFreq.toFixed(2)+'×':'—',sub:freqAlert?'⚠ acima de 3×, saturando':'dentro do ideal',warn:freqAlert},
          {label:'Gasto total',value:fmtBRL(totalSpend),sub:`CPL ${fmtBRL(avgCPL)}`},
          {label:'Conversas WhatsApp',value:totalConversations>0?fmtNum(totalConversations):'—',sub:convRate>0?`${convRate.toFixed(1).replace('.',',')}% dos leads`:'aguardando dados',green:convRate>0},
          {label:'Receita atribuída',value:fmtBRL(totalRev),sub:`ROAS ${fmtROAS(avgROAS)}`,gold:true},
        ].map(k=>(
          <div key={k.label} className="kpi-card">
            <div className="kpi-label"><span className="base-mark"/> {k.label}</div>
            <div className="kpi-value num" style={k.gold?{color:'var(--gold)'}:k.warn?{color:'var(--gold)'}:k.green?{color:'var(--green)'}:{}}>{k.value}</div>
            <div className="kpi-sub" style={k.warn?{color:'var(--gold)'}:{}}>{k.sub}</div>
          </div>
        ))}
      </div>

      {campaignSeries.length>0&&campaignSeries[0].points.length>1&&(
        <div className="panel" style={{marginBottom:14}}>
          <div className="panel-head" style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
            <div className="panel-title">Evolução diária <span>por campanha</span></div>
            <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
              {METRICS.map(m=>(
                <button key={m.key} onClick={()=>setMetric(m.key)} style={{padding:'4px 10px',fontSize:11.5,borderRadius:5,border:'none',cursor:'pointer',fontWeight:500,background:metric===m.key?'var(--red)':'transparent',color:metric===m.key?'#fff':'var(--text-3)'}}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <LineChart series={campaignSeries} metric={metric} height={200}/>
        </div>
      )}

      {campaignSeries.length>0&&(
        <div className="panel" style={{marginBottom:14}}>
          <div className="panel-head"><div className="panel-title">Campanhas Meta Ads <span>resumo do período</span></div></div>
          <div style={{overflowX:'auto'}}>
            <table className="data-table">
              <thead><tr><th>Campanha</th><th className="r">Leads</th><th className="r">Alcance</th><th className="r">Freq.</th><th className="r">Conversas</th><th className="r">CTR</th><th className="r">CPL</th><th className="r">Gasto</th></tr></thead>
              <tbody>
                {campaignSeries.map(s=>{
                  const ctr=s.total_impressions>0?`${((s.total_clicks/s.total_impressions)*100).toFixed(2).replace('.',',')}%`:'—'
                  const freqWarn=s.avg_frequency>=3
                  return (
                    <tr key={s.campaign_id}>
                      <td><div style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:8,height:8,borderRadius:'50%',background:s.color,flexShrink:0}}/><span className="row-title" style={{fontSize:12.5}}>{s.campaign_name.replace(/\[|\]/g,' ').replace(/\s+/g,' ').trim()}</span></div></td>
                      <td className="r cell-num num">{fmtNum(s.total_leads)}</td>
                      <td className="r num">{s.total_reach>0?fmtNum(s.total_reach):'—'}</td>
                      <td className="r num" style={freqWarn?{color:'var(--gold)'}:{}}>{s.avg_frequency>0?s.avg_frequency.toFixed(2)+'×':'—'}</td>
                      <td className="r num">{s.total_conversations>0?fmtNum(s.total_conversations):'—'}</td>
                      <td className="r num">{ctr}</td>
                      <td className="r num">{fmtBRL(s.avg_cpl)}</td>
                      <td className="r num">{fmtBRL(s.total_spend)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {wppCampanhas.length>0&&(
        <>
          <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:'1px',color:'var(--text-3)',fontWeight:600,marginBottom:8}}>Campanhas WhatsApp</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:14}}>
            {[
              {label:'Disparos totais',value:fmtNum(totalWppEnvios),sub:`${wppCampanhas.length} campanhas`},
              {label:'Entregues',value:fmtNum(totalWppEntregues),sub:totalWppEnvios>0?`${((totalWppEntregues/totalWppEnvios)*100).toFixed(1).replace('.',',')}%`:'—'},
              {label:'Taxa de leitura',value:totalWppEntregues>0?`${((totalWppLidos/totalWppEntregues)*100).toFixed(1).replace('.',',')}%`:'—',sub:`${fmtNum(totalWppLidos)} lidas`},
              {label:'Custo WPP',value:fmtBRL(totalWppCusto),sub:totalWppEnvios>0?`${fmtBRL(totalWppCusto/totalWppEnvios)}/disparo`:'—'},
            ].map(k=>(
              <div key={k.label} className="kpi-card">
                <div className="kpi-label"><span className="base-mark"/> {k.label}</div>
                <div className="kpi-value num">{k.value}</div>
                <div className="kpi-sub">{k.sub}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="panel">
        <div className="panel-head"><div className="panel-title">Funil CRM → CAPI <span>disparos registrados</span></div></div>
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

// ─── Por Campanha ─────────────────────────────────────────────────────────────

function CampanhaView({campaignSeries,wppCampanhas,subTab,setSubTab,onDetail}:{
  campaignSeries:CampaignSeries[];wppCampanhas:WppCampanha[];subTab:SubTab;setSubTab:(s:SubTab)=>void;onDetail:(s:CampaignSeries)=>void
}) {
  return (
    <>
      <div style={{display:'flex',gap:18,marginBottom:18,borderBottom:'1px solid var(--line-soft)'}}>
        {(['wpp','ads'] as SubTab[]).map(s=>(
          <div key={s} onClick={()=>setSubTab(s)} style={{padding:'0 2px 10px',fontSize:13,fontWeight:500,cursor:'pointer',marginBottom:-1,color:subTab===s?'var(--text)':'var(--text-3)',borderBottom:subTab===s?'1.5px solid var(--red)':'1.5px solid transparent'}}>
            {s==='wpp'?'Campanhas de WhatsApp':'Campanhas Meta Ads'}
          </div>
        ))}
      </div>
      {subTab==='wpp'?(
        wppCampanhas.length===0?(
          <div className="panel" style={{fontSize:13,color:'var(--text-3)',textAlign:'center',padding:40}}>Nenhuma campanha de WhatsApp no período.</div>
        ):(
          <table className="data-table">
            <thead><tr><th>Campanha</th><th className="r">Disparos</th><th className="r">Entregues</th><th className="r">Lidos</th><th className="r">Falhas</th><th className="r">Custo</th></tr></thead>
            <tbody>
              {wppCampanhas.map(c=>(
                <tr key={c.id}>
                  <td><div className="row-title">{c.name}</div><div className="row-sub">{c.status==='completed'?'Concluída':c.status==='running'?'Em andamento':c.status}{c.completed_at?` · ${new Date(c.completed_at).toLocaleDateString('pt-BR')}`:''}</div></td>
                  <td className="r cell-num num">{fmtNum(c.total_envios)}</td>
                  <td className="r num">{fmtNum(c.entregues)} <span style={{color:'var(--text-3)',fontSize:11.5}}>{c.total_envios>0?`${((c.entregues/c.total_envios)*100).toFixed(0)}%`:''}</span></td>
                  <td className="r num">{fmtNum(c.lidos)} <span style={{color:'var(--text-3)',fontSize:11.5}}>{c.entregues>0?`${((c.lidos/c.entregues)*100).toFixed(0)}%`:''}</span></td>
                  <td className="r num" style={{color:c.falhas>0?'#f87171':'var(--text-3)'}}>{c.falhas>0?fmtNum(c.falhas):'—'}</td>
                  <td className="r num">{c.custo_total>0?fmtBRL(c.custo_total):'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ):(
        campaignSeries.length===0?(
          <div className="panel" style={{fontSize:13,color:'var(--text-3)',textAlign:'center',padding:40}}>Nenhuma campanha Meta Ads no período.</div>
        ):(
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
        )
      )}
    </>
  )
}

// ─── Por Funil ────────────────────────────────────────────────────────────────

function FunilView({campaignSeries,onDetail}:{campaignSeries:CampaignSeries[];onDetail:(s:CampaignSeries)=>void}) {
  const funis=FUNIL_MAP.map(f=>{
    const matching=campaignSeries.filter(s=>f.kws.some(kw=>s.campaign_name.toUpperCase().includes(kw.toUpperCase())))
    const leads=matching.reduce((s,c)=>s+c.total_leads,0); const spend=matching.reduce((s,c)=>s+c.total_spend,0)
    const impressions=matching.reduce((s,c)=>s+c.total_impressions,0); const cpl=leads>0?spend/leads:0
    return {...f,leads,spend,impressions,cpl,matching}
  })
  return (
    <table className="data-table">
      <thead><tr><th>Funil (RD CRM)</th><th className="r">Leads</th><th className="r">Alcance</th><th className="r">Impressões</th><th className="r">Gasto</th><th className="r">CPL</th><th className="r">Receita</th><th></th></tr></thead>
      <tbody>
        {funis.map(f=>(
          <tr key={f.name} className={f.leads>0?'rowlink':''} onClick={()=>f.matching.length>0&&onDetail(f.matching[0])}>
            <td style={{color:f.leads===0?'var(--text-3)':'var(--text)'}}><div className="row-title" style={{color:'inherit'}}>{f.name}</div><div className="row-sub">Pixel {f.pixel}</div></td>
            <td className="r num" style={{color:f.leads===0?'var(--text-3)':undefined}}>{f.leads>0?fmtNum(f.leads):'—'}</td>
            <td className="r num" style={{color:f.leads===0?'var(--text-3)':undefined}}>{f.matching.length>0?fmtNum(f.matching.reduce((s,c)=>s+c.total_reach,0)):'—'}</td>
            <td className="r num" style={{color:f.impressions===0?'var(--text-3)':undefined}}>{f.impressions>0?fmtNum(f.impressions):'—'}</td>
            <td className="r num" style={{color:f.spend===0?'var(--text-3)':undefined}}>{f.spend>0?fmtBRL(f.spend):'—'}</td>
            <td className="r num" style={{color:f.cpl===0?'var(--text-3)':undefined}}>{f.cpl>0?fmtBRL(f.cpl):'—'}</td>
            <td className="r cell-gold num"><span style={{color:'var(--text-3)'}}>—</span></td>
            <td className="arrow-cell">{f.leads>0?'›':''}</td>
          </tr>
        ))}
        <tr><td colSpan={8} style={{color:'var(--text-3)'}}><div className="row-title" style={{color:'var(--text-3)'}}>Europa · China · C$ Club</div><div className="row-sub">Aguardando compartilhamento dos pixels</div></td></tr>
      </tbody>
    </table>
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
              <div key={item.label} style={{padding:'12px 14px',background:'var(--surface-2,rgba(255,255,255,0.03))',borderRadius:8,border:'1px solid var(--line)'}}>
                <div style={{fontSize:11.5,color:'var(--text-3)',marginBottom:8,fontWeight:500}}>{item.label}</div>
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
    else if (s.avg_frequency>=3) insights.push({type:'warn',title:`${s.campaign_name.split(']')[0].replace('[','').trim()} se aproximando da saturação — ${s.avg_frequency.toFixed(1)}×`,body:`Frequência próxima de 3× começa a elevar o CPL. Monitore os próximos dias: se o CPL subir mais de 20%, pausar ou trocar o criativo são boas opções.`})
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

  // CPL por campanha — identificar a mais eficiente
  if (campaignSeries.length>=2) {
    const comCpl=campaignSeries.filter(s=>s.avg_cpl>0)
    if (comCpl.length>=2) {
      const melhor=[...comCpl].sort((a,b)=>a.avg_cpl-b.avg_cpl)[0]
      const pior=[...comCpl].sort((a,b)=>b.avg_cpl-a.avg_cpl)[0]
      const diff=((pior.avg_cpl-melhor.avg_cpl)/melhor.avg_cpl*100)
      if (diff>30) insights.push({type:'info',title:`CPL ${diff.toFixed(0)}% menor em ${melhor.campaign_name.split(']')[0].replace('[','').trim()}`,body:`O custo por lead dessa campanha é ${fmtBRL(melhor.avg_cpl)} vs ${fmtBRL(pior.avg_cpl)} da menos eficiente. Considere migrar parte do orçamento para o criativo/segmentação com melhor retorno.`})
    }
  }

  // Dias sem nenhum lead — identifica campanhas com buracos
  for (const s of campaignSeries) {
    const diasSemLead=s.points.filter(p=>p.leads===0).length
    const pct=s.points.length>0?(diasSemLead/s.points.length)*100:0
    if (pct>=30&&s.points.length>=7) insights.push({type:'warn',title:`${diasSemLead} dias sem lead — ${s.campaign_name.split(']')[0].replace('[','').trim()}`,body:`${pct.toFixed(0)}% dos dias no período não gerou nenhum lead. Isso pode indicar pausas frequentes na veiculação, limite de orçamento diário esgotando cedo, ou períodos de baixa entrega pela Meta. Vale revisar o calendário de veiculação.`})
  }

  // Gasto total alto sem leads proporcionais
  for (const s of campaignSeries) {
    if (s.total_spend>200&&s.avg_cpl>100) insights.push({type:'warn',title:`CPL elevado em ${s.campaign_name.split(']')[0].replace('[','').trim()} — ${fmtBRL(s.avg_cpl)}`,body:`Com ${fmtBRL(s.total_spend)} investidos e CPL de ${fmtBRL(s.avg_cpl)}, o custo de aquisição está alto para campanhas de WhatsApp. Testar novos criativos ou reduzir o público para aumentar a relevância pode melhorar a performance.`})
  }

  // Alcance total zerado — possível problema de dados
  const totalReachCalc=campaignSeries.reduce((s,c)=>s+c.total_reach,0)
  const totalLeadsCalc=campaignSeries.reduce((s,c)=>s+c.total_leads,0)
  if (totalReachCalc===0&&totalLeadsCalc>0&&campaignSeries.length>0) insights.push({type:'info',title:'Dados de alcance não disponíveis',body:`A Meta não retornou dados de alcance para o período selecionado. Isso é comum em contas com menos de 7 dias de veiculação ou quando o período filtrado é muito curto. Tente selecionar "Últimos 30 dias" para ver os dados completos.`})

  if (insights.length===0) return (
    <div className="panel" style={{fontSize:13,color:'var(--text-3)',textAlign:'center',padding:40}}>
      Dados insuficientes para gerar insights. Aguarde mais dias de campanha ativa.
    </div>
  )

  const iconMap={warn:'⚠',good:'✓',info:'i'}
  const bgMap={warn:'rgba(234,179,8,0.12)',good:'rgba(34,197,94,0.12)',info:'rgba(59,130,246,0.12)'}
  const colorMap={warn:'#ca8a04',good:'#16a34a',info:'#2563eb'}

  return (
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {insights.map((ins,i)=>(
        <div key={i} className="panel" style={{padding:'14px 16px'}}>
          <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
            <div style={{width:28,height:28,borderRadius:6,background:bgMap[ins.type],display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:13,fontWeight:700,color:colorMap[ins.type]}}>
              {iconMap[ins.type]}
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:'var(--text)',marginBottom:5}}>{ins.title}</div>
              <div style={{fontSize:12.5,color:'var(--text-2)',lineHeight:1.6}}>{ins.body}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Detalhe ──────────────────────────────────────────────────────────────────

function DetailView({series,onBack}:{series:CampaignSeries;onBack:()=>void}) {
  const [metric,setMetric]=useState<ChartMetric>('leads')
  const ctr=series.total_impressions>0?`${((series.total_clicks/series.total_impressions)*100).toFixed(2).replace('.',',')}%`:'—'
  const convRate=series.total_leads>0&&series.total_conversations>0?`${((series.total_conversations/series.total_leads)*100).toFixed(1).replace('.',',')}%`:'—'
  const METRICS:{key:ChartMetric;label:string}[]=[{key:'leads',label:'Leads'},{key:'spend',label:'Gasto'},{key:'cpl',label:'CPL'},{key:'reach',label:'Alcance'},{key:'frequency',label:'Frequência'}]

  return (
    <div style={{maxWidth:'100%'}}>
      <div onClick={onBack} style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,color:'var(--text-2)',cursor:'pointer',marginBottom:20,fontWeight:500}} onMouseEnter={e=>(e.currentTarget.style.color='var(--text)')} onMouseLeave={e=>(e.currentTarget.style.color='var(--text-2)')}>← Voltar</div>
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
            <div key={r.label} style={{padding:'10px 12px',background:'var(--surface-2,rgba(255,255,255,0.03))',borderRadius:8,border:'1px solid var(--line)'}}>
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
              {METRICS.map(m=><button key={m.key} onClick={()=>setMetric(m.key)} style={{padding:'4px 10px',fontSize:11.5,borderRadius:5,border:'none',cursor:'pointer',fontWeight:500,background:metric===m.key?'var(--red)':'transparent',color:metric===m.key?'#fff':'var(--text-3)'}}>{m.label}</button>)}
            </div>
          </div>
          <LineChart series={[series]} metric={metric} height={180}/>
        </div>
      )}

      <div className="panel">
        <div className="panel-head"><div className="panel-title">Dados diários</div></div>
        <div style={{overflowX:'auto'}}>
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
