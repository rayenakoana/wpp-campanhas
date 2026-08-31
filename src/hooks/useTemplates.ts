import { useEffect, useState } from 'react'
import { supabaseWpp } from '../lib/supabase'

export interface TemplateOption {
  id: string
  meta_template_name: string
  status: string
  category: string | null
  synced_at: string | null
}

export function useTemplates() {
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: fetchError } = await supabaseWpp
          .from('templates')
          .select('id, meta_template_name, status, category, synced_at')
          .order('meta_template_name', { ascending: true })

        if (fetchError) throw fetchError
        if (!cancelado) setTemplates((data ?? []) as TemplateOption[])
      } catch (err) {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar templates.')
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

  return { templates, loading, error }
}
