import { useEffect, useState } from 'react'
import { supabaseWpp } from '../lib/supabase'
import type { NumberHealthSnapshot } from '../types/wpp'
import type { TemplateOption } from './useTemplates'

export interface IntegracoesData {
  saudeNumero: NumberHealthSnapshot | null
  templates: TemplateOption[]
}

export function useIntegracoes() {
  const [data, setData] = useState<IntegracoesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      setLoading(true)
      setError(null)
      try {
        const [saudeRes, templatesRes] = await Promise.all([
          supabaseWpp
            .from('number_health_snapshots')
            .select('*')
            .order('captured_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabaseWpp
            .from('templates')
            .select('id, meta_template_name, status, category, synced_at')
            .order('synced_at', { ascending: false }),
        ])

        if (saudeRes.error) throw saudeRes.error
        if (templatesRes.error) throw templatesRes.error

        if (!cancelado) {
          setData({
            saudeNumero: (saudeRes.data as NumberHealthSnapshot) ?? null,
            templates: (templatesRes.data ?? []) as TemplateOption[],
          })
        }
      } catch (err) {
        if (!cancelado) setError(err instanceof Error ? err.message : 'Erro ao carregar integrações.')
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
