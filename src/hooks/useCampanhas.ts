import { useEffect, useState } from 'react'
import { supabaseWpp } from '../lib/supabase'
import type { Campaign, CampaignSend } from '../types/wpp'

export interface CampanhaCompleta extends Campaign {
  template_nome: string | null
  total_envios: number
  entregues: number
  lidos: number
  falhas: number
  custo_total: number
}

export function useCampanhas() {
  const [campanhas, setCampanhas] = useState<CampanhaCompleta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      setLoading(true)
      setError(null)

      try {
        const { data: listaCampanhas, error: campanhasError } = await supabaseWpp
          .from('campaigns')
          .select('*')
          .order('created_at', { ascending: false })

        if (campanhasError) throw campanhasError

        const campanhas = (listaCampanhas ?? []) as Campaign[]
        const idsCampanhas = campanhas.map((c) => c.id)
        const idsTemplates = [...new Set(campanhas.map((c) => c.template_id).filter(Boolean))] as string[]

        let envios: CampaignSend[] = []
        if (idsCampanhas.length > 0) {
          const { data: enviosData, error: enviosError } = await supabaseWpp
            .from('campaign_sends')
            .select('*')
            .in('campaign_id', idsCampanhas)

          if (enviosError) throw enviosError
          envios = (enviosData ?? []) as CampaignSend[]
        }

        let templatesPorId: Record<string, string> = {}
        if (idsTemplates.length > 0) {
          const { data: templatesData, error: templatesError } = await supabaseWpp
            .from('templates')
            .select('id, meta_template_name')
            .in('id', idsTemplates)

          if (templatesError) throw templatesError
          templatesPorId = Object.fromEntries(
            (templatesData ?? []).map((t) => [t.id as string, t.meta_template_name as string])
          )
        }

        const enviosPorCampanha: Record<string, CampaignSend[]> = {}
        for (const envio of envios) {
          if (!enviosPorCampanha[envio.campaign_id]) enviosPorCampanha[envio.campaign_id] = []
          enviosPorCampanha[envio.campaign_id].push(envio)
        }

        const completas: CampanhaCompleta[] = campanhas.map((c) => {
          const enviosDaCampanha = enviosPorCampanha[c.id] ?? []
          return {
            ...c,
            template_nome: c.template_id ? templatesPorId[c.template_id] ?? null : null,
            total_envios: enviosDaCampanha.length,
            entregues: enviosDaCampanha.filter((e) => e.status === 'delivered' || e.status === 'read').length,
            lidos: enviosDaCampanha.filter((e) => e.status === 'read').length,
            falhas: enviosDaCampanha.filter((e) => e.status === 'failed').length,
            custo_total: enviosDaCampanha.reduce((soma, e) => soma + (e.cost ? Number(e.cost) : 0), 0),
          }
        })

        if (!cancelado) setCampanhas(completas)
      } catch (err) {
        if (!cancelado) {
          const mensagem = err instanceof Error ? err.message : 'Erro desconhecido ao carregar campanhas.'
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

  return { campanhas, loading, error }
}
