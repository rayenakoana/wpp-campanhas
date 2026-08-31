import { useEffect, useState } from 'react'
import { supabaseWpp } from '../lib/supabase'

export interface UsuarioComPapel {
  user_id: string
  role: string
  created_at: string
}

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioComPapel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: fetchError } = await supabaseWpp
          .from('user_roles')
          .select('*')
          .order('created_at', { ascending: true })

        if (fetchError) throw fetchError
        if (!cancelado) setUsuarios((data ?? []) as UsuarioComPapel[])
      } catch (err) {
        if (!cancelado) setError(err instanceof Error ? err.message : 'Erro ao carregar usuários.')
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    carregar()
    return () => {
      cancelado = true
    }
  }, [])

  return { usuarios, loading, error }
}
