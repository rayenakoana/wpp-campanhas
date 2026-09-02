import { useEffect, useState } from 'react'
import { supabaseWpp } from '../lib/supabase'

import { META_WABA_ID as WABA_ID, META_WPP_TOKEN as META_TOKEN } from '../lib/metaConfig'

export interface TemplateOption {
  id: string
  meta_template_id: string | null
  meta_template_name: string
  status: string
  category: string | null
  language: string | null
  body: string
  body_text: string | null
  synced_at: string | null
}

// Busca todos os templates direto da WABA via Graph API,
// salva/atualiza no Supabase e retorna a lista unificada.
export function useTemplates(refreshKey = 0) {
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      setLoading(true)
      setError(null)

      try {
        // 1. Busca da WABA (fonte da verdade)
        const fields = 'id,name,status,category,language,components,quality_score,rejected_reason'
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${WABA_ID}/message_templates?fields=${fields}&limit=200&access_token=${META_TOKEN}`
        )
        const json = await res.json()

        if (json.error) throw new Error(json.error.message)

        const wabaTemplates: any[] = json.data ?? []

        // 2. Upsert no Supabase para manter sync
        if (wabaTemplates.length > 0) {
          const rows = wabaTemplates.map((t: any) => ({
            meta_template_id:   t.id ?? null,
            meta_template_name: t.name,
            status:             t.status ?? 'UNKNOWN',
            category:           t.category ?? 'UTILITY',
            language:           t.language ?? 'pt_BR',
            body:               t.components?.find((c: any) => c.type === 'BODY')?.text ?? '',
            body_text:          t.components?.find((c: any) => c.type === 'BODY')?.text ?? '',
            synced_at:          new Date().toISOString(),
          }))

          // Upsert silencioso — não bloqueia a exibição
          supabaseWpp
            .from('templates')
            .upsert(rows, { onConflict: 'meta_template_name' })
            .then(({ error: e }) => { if (e) console.warn('Sync Supabase:', e.message) })
        }

        // 3. Retorna imediatamente os dados da WABA (não espera o upsert)
        if (!cancelado) {
          const mapped: TemplateOption[] = wabaTemplates.map((t: any) => ({
            id:                 t.id ?? t.name,
            meta_template_id:   t.id ?? null,
            meta_template_name: t.name,
            status:             t.status ?? 'UNKNOWN',
            category:           t.category ?? null,
            language:           t.language ?? null,
            body:               t.components?.find((c: any) => c.type === 'BODY')?.text ?? '',
            body_text:          t.components?.find((c: any) => c.type === 'BODY')?.text ?? null,
            synced_at:          new Date().toISOString(),
          }))
          setTemplates(mapped.sort((a, b) => a.meta_template_name.localeCompare(b.meta_template_name)))
        }

      } catch (metaErr) {
        // Fallback: busca do Supabase se a API Meta falhar
        console.warn('Meta API falhou, usando Supabase:', metaErr)
        try {
          const { data, error: dbErr } = await supabaseWpp
            .from('templates')
            .select('id, meta_template_id, meta_template_name, status, category, language, body, body_text, synced_at')
            .order('meta_template_name', { ascending: true })
          if (dbErr) throw dbErr
          if (!cancelado) setTemplates((data ?? []) as TemplateOption[])
        } catch (dbFallbackErr) {
          if (!cancelado) setError(dbFallbackErr instanceof Error ? dbFallbackErr.message : 'Erro ao carregar templates.')
        }
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    carregar()
    return () => { cancelado = true }
  }, [refreshKey])

  return { templates, loading, error }
}
