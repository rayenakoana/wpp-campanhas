import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function RedefinirSenha() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()

  const [prontoParaRedefinir, setProntoParaRedefinir] = useState(false)
  const [verificando, setVerificando] = useState(true)
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    // O Supabase, ao processar o link de recuperacao, dispara o evento
    // PASSWORD_RECOVERY e ja autentica a sessao. E' esse evento que confirma
    // que estamos num fluxo valido de redefinicao (nao um acesso direto a URL).
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setProntoParaRedefinir(true)
        setVerificando(false)
      }
    })

    // Caso o evento ja tenha disparado antes deste componente montar,
    // confere se ja existe uma sessao valida.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setProntoParaRedefinir(true)
      }
      setVerificando(false)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (novaSenha.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (novaSenha !== confirmarSenha) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    const { error: updateError } = await updatePassword(novaSenha)
    setLoading(false)

    if (updateError) {
      setError(updateError)
      return
    }

    setSucesso(true)
    setTimeout(() => navigate('/', { replace: true }), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      <div className="ambient-glow" />

      <div className="glass-card relative z-10 w-full max-w-[380px] px-8 pt-9 pb-7 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-center gap-2.5 mb-7">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-extrabold text-[15px] text-white bg-gradient-to-br from-[var(--color-red-bright)] to-[var(--color-red-deep)]">
            W
          </span>
          <span className="font-display font-bold text-[19px]">WPP Campanhas</span>
        </div>

        {verificando && (
          <p className="text-sm text-[var(--color-text-muted)] text-center">Verificando link...</p>
        )}

        {!verificando && !prontoParaRedefinir && (
          <>
            <h1 className="font-display font-semibold text-[22px] text-center mb-1.5">
              Link inválido ou expirado
            </h1>
            <p className="text-[13px] text-[var(--color-text-muted)] text-center mb-2">
              Volte para a tela de login e solicite um novo link de redefinição.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full mt-5 py-3 rounded-lg font-semibold text-sm text-white bg-gradient-to-br from-[var(--color-red-bright)] to-[var(--color-red-deep)]"
            >
              Voltar para o login
            </button>
          </>
        )}

        {!verificando && prontoParaRedefinir && !sucesso && (
          <>
            <h1 className="font-display font-semibold text-[22px] text-center mb-1.5">
              Defina uma nova senha
            </h1>
            <p className="text-[13px] text-[var(--color-text-muted)] text-center mb-7">
              Escolha uma senha com pelo menos 8 caracteres.
            </p>

            {error && (
              <div className="text-[12.5px] px-3 py-2.5 rounded-lg mb-4 bg-[rgba(232,25,44,0.1)] border border-[rgba(232,25,44,0.28)] text-[#f28c94]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="novaSenha" className="block text-[12.5px] text-[var(--color-text-muted)] mb-1.5 font-medium">
                  Nova senha
                </label>
                <input
                  id="novaSenha"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-white/5 border border-white/10 text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-red-bright)] focus:bg-white/7"
                />
              </div>

              <div className="mb-5">
                <label htmlFor="confirmarSenha" className="block text-[12.5px] text-[var(--color-text-muted)] mb-1.5 font-medium">
                  Confirmar nova senha
                </label>
                <input
                  id="confirmarSenha"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-white/5 border border-white/10 text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-red-bright)] focus:bg-white/7"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg font-semibold text-sm text-white bg-gradient-to-br from-[var(--color-red-bright)] to-[var(--color-red-deep)] shadow-[0_8px_24px_rgba(232,25,44,0.28)] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          </>
        )}

        {sucesso && (
          <>
            <h1 className="font-display font-semibold text-[22px] text-center mb-1.5">
              Senha atualizada
            </h1>
            <p className="text-[13px] text-[var(--color-text-muted)] text-center">
              Redirecionando para o painel...
            </p>
          </>
        )}
      </div>
    </div>
  )
}
