import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variaveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nao configuradas. Verifique o arquivo .env.'
  )
}

// Cliente padrao, usado para autenticacao (auth.users)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Cliente apontando para o schema "wpp", usado para todas as consultas
// de dados do WPP Campanhas (campanhas, leads, segmentos, etc).
export const supabaseWpp = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'wpp' },
})
