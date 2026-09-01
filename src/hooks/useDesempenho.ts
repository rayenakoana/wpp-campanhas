import { useEffect, useState } from 'react'
import { supabaseWpp } from '../lib/supabase'
import type { Campaign, CampaignSend, NumberHealthSnapshot } from '../types/wpp'

export interface CampanhaResumo extends Campaign {
  total_envios: number
  entregues: number
  lidos: number
  falhas: number
}

export interface PontoDia {
  dia: string
  enviadas: number
  entregues: number
  lidas: number
}

export interface DesempenhoData {
  totalCampanhas: number
  campanhasPorStatus: Record<string, number>
  totalEnviado: number
  totalEntregue: number
  totalLido: number
  totalFalha: number
  custoTotal: number
  saudeNumero: NumberHealthSnapshot | null
  campanhasRecentes: CampanhaResumo[]
  porDia: PontoDia[]
}

export type DatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'this_month' | 'last_month'

export const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Hoje', yesterday: 'Ontem', '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias', this_month: 'Este mês', last_month: 'Mês passado',
}

export function getDateRange(preset: DatePreset): { from: string; to: string } {
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

export function useDesempenho(from?: string, to?: string) {
  const [data, setData] = useState<DesempenhoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      setLoading(true)
      setError(null)

      try {
        // Query de campanhas — filtra por período se informado
        let campanhasQuery = supabaseWpp
          .from('campaigns')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)

        if (from) campanhasQuery = campanhasQuery.gte('created_at', from)
        if (to)   campanhasQuery = campanhasQuery.lte('created_at', to + 'T23:59:59')

        const { data: campanhas, error: campanhasError } = await campanhasQuery
        if (campanhasError) throw campanhasError

        const listaCampanhas = (campanhas ?? []) as Campaign[]

        const campanhasPorStatus: Record<string, number> = {}
        for (const c of listaCampanhas) {
          campanhasPorStatus[c.status] = (campanhasPorStatus[c.status] ?? 0) + 1
        }

        const idsCampanhas = listaCampanhas.map((c) => c.id)

        let envios: CampaignSend[] = []
        if (idsCampanhas.length > 0) {
          const { data: enviosData, error: enviosError } = await supabaseWpp
            .from('campaign_sends')
            .select('*')
            .in('campaign_id', idsCampanhas)

          if (enviosError) throw enviosError
          envios = (enviosData ?? []) as CampaignSend[]
        }

        let totalEnviado = 0, totalEntregue = 0, totalLido = 0, totalFalha = 0, custoTotal = 0
        const enviosPorCampanha: Record<string, CampaignSend[]> = {}
        const porDiaMap: Record<string, { enviadas: number; entregues: number; lidas: number }> = {}

        for (const envio of envios) {
          if (!enviosPorCampanha[envio.campaign_id]) enviosPorCampanha[envio.campaign_id] = []
          enviosPorCampanha[envio.campaign_id].push(envio)

          const dia = (envio.sent_at ?? envio.created_at ?? '').slice(0, 10)
          if (dia) {
            if (!porDiaMap[dia]) porDiaMap[dia] = { enviadas: 0, entregues: 0, lidas: 0 }
            if (envio.status === 'sent' || envio.status === 'delivered' || envio.status === 'read') {
              porDiaMap[dia].enviadas++; totalEnviado++
            }
            if (envio.status === 'delivered' || envio.status === 'read') {
              porDiaMap[dia].entregues++; totalEntregue++
            }
            if (envio.status === 'read') { porDiaMap[dia].lidas++; totalLido++ }
          }
          if (envio.status === 'failed') totalFalha++
          if (envio.cost) custoTotal += Number(envio.cost)
        }

        // Garante todos os dias do período no gráfico (mesmo sem envio)
        const porDia: PontoDia[] = []
        if (from && to) {
          const cur = new Date(from)
          const end = new Date(to)
          while (cur <= end) {
            const d = cur.toISOString().split('T')[0]
            porDia.push({ dia: d, ...(porDiaMap[d] ?? { enviadas: 0, entregues: 0, lidas: 0 }) })
            cur.setDate(cur.getDate() + 1)
          }
        } else {
          Object.entries(porDiaMap).sort(([a], [b]) => a.localeCompare(b)).forEach(([dia, v]) => {
            porDia.push({ dia, ...v })
          })
        }

        const campanhasRecentes: CampanhaResumo[] = listaCampanhas.slice(0, 8).map((c) => {
          const enviosDaCampanha = enviosPorCampanha[c.id] ?? []
          return {
            ...c,
            total_envios: enviosDaCampanha.filter(e => ['sent','delivered','read'].includes(e.status)).length,
            entregues: enviosDaCampanha.filter((e) => e.status === 'delivered' || e.status === 'read').length,
            lidos: enviosDaCampanha.filter((e) => e.status === 'read').length,
            falhas: enviosDaCampanha.filter((e) => e.status === 'failed').length,
          }
        })

        const { data: saudeData, error: saudeError } = await supabaseWpp
          .from('number_health_snapshots')
          .select('*')
          .order('captured_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (saudeError) throw saudeError

        if (!cancelado) {
          setData({
            totalCampanhas: listaCampanhas.length,
            campanhasPorStatus,
            totalEnviado, totalEntregue, totalLido, totalFalha, custoTotal,
            saudeNumero: (saudeData as NumberHealthSnapshot) ?? null,
            campanhasRecentes,
            porDia,
          })
        }
      } catch (err) {
        if (!cancelado) setError(err instanceof Error ? err.message : 'Erro desconhecido.')
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    carregar()
    return () => { cancelado = true }
  }, [from, to])

  return { data, loading, error }
}
