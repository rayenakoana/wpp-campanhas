import { useEffect, useState } from 'react'
import { supabaseWpp } from '../lib/supabase'
import type { Segment } from '../types/wpp'

export function useSegmentos() {
  const [segmentos, setSegmentos] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      setLoading(true)
      setError(null)

      try {
        const { data, error: fetchError } = await supabaseWpp
          .from('segments')
          .select('*')
          .order('created_at', { ascending: false })

        if (fetchError) throw fetchError
        if (!cancelado) setSegmentos((data ?? []) as Segment[])
      } catch (err) {
        if (!cancelado) {
          const mensagem = err instanceof Error ? err.message : 'Erro desconhecido ao carregar segmentos.'
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

  return { segmentos, loading, error }
}
