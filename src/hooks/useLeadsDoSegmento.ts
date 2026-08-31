import { useEffect, useState } from 'react'
import { supabaseWpp } from '../lib/supabase'
import type { Lead } from '../types/wpp'

export function useLeadsDoSegmento(segmentId: string | null) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!segmentId) {
      setLeads([])
      return
    }

    let cancelado = false

    async function carregar() {
      setLoading(true)
      setError(null)

      try {
        const { data: vinculos, error: vinculosError } = await supabaseWpp
          .from('segment_leads')
          .select('lead_id')
          .eq('segment_id', segmentId)
          .limit(500)

        if (vinculosError) throw vinculosError

        const idsLeads = (vinculos ?? []).map((v) => v.lead_id as string)

        if (idsLeads.length === 0) {
          if (!cancelado) setLeads([])
          return
        }

        const { data: leadsData, error: leadsError } = await supabaseWpp
          .from('leads')
          .select('*')
          .in('id', idsLeads)
          .order('created_at', { ascending: false })

        if (leadsError) throw leadsError
        if (!cancelado) setLeads((leadsData ?? []) as Lead[])
      } catch (err) {
        if (!cancelado) {
          const mensagem = err instanceof Error ? err.message : 'Erro desconhecido ao carregar leads.'
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
  }, [segmentId])

  return { leads, loading, error }
}
