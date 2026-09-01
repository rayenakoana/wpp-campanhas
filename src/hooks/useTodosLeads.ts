import { useEffect, useState } from 'react'
import { supabaseWpp } from '../lib/supabase'
import type { Lead } from '../types/wpp'

export function useTodosLeads(busca: string) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      setLoading(true)
      setError(null)

      try {
        let query = supabaseWpp
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200)

        if (busca.trim()) {
          query = query.or(
            `name.ilike.%${busca}%,email.ilike.%${busca}%,whatsapp_e164.ilike.%${busca}%`
          )
        }

        const { data, error: fetchError } = await query
        if (fetchError) throw fetchError
        if (!cancelado) setLeads((data ?? []) as Lead[])
      } catch (err) {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar leads.')
        }
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    const timer = setTimeout(carregar, busca ? 400 : 0)
    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [busca])

  return { leads, loading, error }
}
