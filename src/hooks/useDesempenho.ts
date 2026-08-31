import { useEffect, useState } from 'react'
import { supabaseWpp } from '../lib/supabase'
import type { Campaign, CampaignSend, NumberHealthSnapshot } from '../types/wpp'

export interface CampanhaResumo extends Campaign {
  total_envios: number
  entregues: number
  lidos: number
  falhas: number
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
}

export function useDesempenho() {
  const [data, setData] = useState<DesempenhoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      setLoading(true)
      setError(null)

      try {
        // Campanhas recentes (usadas tanto para a tabela quanto para a
        // contagem de status, ja que o volume ainda e' baixo nesta fase).
        const { data: campanhas, error: campanhasError } = await supabaseWpp
          .from('campaigns')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)

        if (campanhasError) throw campanhasError

        const listaCampanhas = (campanhas ?? []) as Campaign[]

        const campanhasPorStatus: Record<string, number> = {}
        for (const c of listaCampanhas) {
          campanhasPorStatus[c.status] = (campanhasPorStatus[c.status] ?? 0) + 1
        }

        // Envios de todas as campanhas carregadas, para agregacao de status e custo.
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

        let totalEnviado = 0
        let totalEntregue = 0
        let totalLido = 0
        let totalFalha = 0
        let custoTotal = 0

        const enviosPorCampanha: Record<string, CampaignSend[]> = {}

        for (const envio of envios) {
          if (!enviosPorCampanha[envio.campaign_id]) enviosPorCampanha[envio.campaign_id] = []
          enviosPorCampanha[envio.campaign_id].push(envio)

          if (envio.status === 'sent' || envio.status === 'delivered' || envio.status === 'read') {
            totalEnviado += 1
          }
          if (envio.status === 'delivered' || envio.status === 'read') totalEntregue += 1
          if (envio.status === 'read') totalLido += 1
          if (envio.status === 'failed') totalFalha += 1
          if (envio.cost) custoTotal += Number(envio.cost)
        }

        const campanhasRecentes: CampanhaResumo[] = listaCampanhas.slice(0, 8).map((c) => {
          const enviosDaCampanha = enviosPorCampanha[c.id] ?? []
          return {
            ...c,
            total_envios: enviosDaCampanha.length,
            entregues: enviosDaCampanha.filter((e) => e.status === 'delivered' || e.status === 'read').length,
            lidos: enviosDaCampanha.filter((e) => e.status === 'read').length,
            falhas: enviosDaCampanha.filter((e) => e.status === 'failed').length,
          }
        })

        // Ultimo snapshot de saude do numero (qualidade / tier de mensagens)
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
            totalEnviado,
            totalEntregue,
            totalLido,
            totalFalha,
            custoTotal,
            saudeNumero: (saudeData as NumberHealthSnapshot) ?? null,
            campanhasRecentes,
          })
        }
      } catch (err) {
        if (!cancelado) {
          const mensagem = err instanceof Error ? err.message : 'Erro desconhecido ao carregar dados.'
          setError(mensagem)
        }
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    carregar()

    return () => {
      cancelado = true
    }
  }, [])

  return { data, loading, error }
}
