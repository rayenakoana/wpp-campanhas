import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signInWithPassword, signInWithGoogle, requestPasswordReset } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mensagemRecuperacao, setMensagemRecuperacao] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: signInError } = await signInWithPassword(email, password)

    setLoading(false)

    if (signInError) {
      setError(signInError)
      return
    }

    navigate('/', { replace: true })
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Digite seu e-mail no campo acima antes de clicar em "Esqueceu a senha?".')
      return
    }
    setError(null)
    setLoading(true)
    const { error: resetError } = await requestPasswordReset(email)
    setLoading(false)

    if (resetError) {
      setError(resetError)
      return
    }

    setMensagemRecuperacao(`Enviamos um link de redefinição para ${email}. Verifique sua caixa de entrada.`)
  }

  async function handleGoogleLogin() {
    setError(null)
    const { error: signInError } = await signInWithGoogle()
    if (signInError) setError(signInError)
    // Em caso de sucesso, o Supabase redireciona a pagina automaticamente.
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      <div className="ambient-glow" />

      <div className="glass-card relative z-10 w-full max-w-[380px] px-8 pt-9 pb-7 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-center gap-2.5 mb-7">
          <img
            src="/logo-cs.png"
            alt="Costurando Sucesso"
            className="w-8 h-8 rounded-lg object-cover"
          />
          <span className="font-display font-bold text-[19px]">WPP Campanhas</span>
        </div>

        <h1 className="font-display font-semibold text-[22px] text-center mb-1.5">
          Bem-vinda de volta
        </h1>
        <p className="text-[13px] text-[var(--color-text-muted)] text-center mb-7">
          Entre com sua conta Costurando Sucesso
        </p>

        {error && (
          <div className="text-[12.5px] px-3 py-2.5 rounded-lg mb-4 bg-[rgba(232,25,44,0.1)] border border-[rgba(232,25,44,0.28)] text-[#f28c94]">
            {error}
          </div>
        )}

        {mensagemRecuperacao && (
          <div className="text-[12.5px] px-3 py-2.5 rounded-lg mb-4 bg-[rgba(61,190,123,0.1)] border border-[rgba(61,190,123,0.3)] text-[#8fe0b6]">
            {mensagemRecuperacao}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-[12.5px] text-[var(--color-text-muted)] mb-1.5 font-medium">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="voce@costurandosucesso.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-white/5 border border-white/10 text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-red-bright)] focus:bg-white/7 placeholder:text-[var(--color-text-muted)]/60"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="block text-[12.5px] text-[var(--color-text-muted)] mb-1.5 font-medium">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-white/5 border border-white/10 text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-red-bright)] focus:bg-white/7 placeholder:text-[var(--color-text-muted)]/60"
            />
          </div>

          <div className="flex justify-between items-center mt-0.5 mb-[22px]">
            <label className="flex items-center gap-1.5 text-[12.5px] text-[var(--color-text-muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="accent-[var(--color-red-bright)]"
              />
              Lembrar de mim
            </label>
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-[12.5px] text-[var(--color-gold)] hover:underline"
            >
              Esqueceu a senha?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-semibold text-sm text-white bg-gradient-to-br from-[var(--color-red-bright)] to-[var(--color-red-deep)] shadow-[0_8px_24px_rgba(232,25,44,0.28)] transition-transform hover:-translate-y-px hover:shadow-[0_12px_30px_rgba(232,25,44,0.36)] active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-[22px] text-[var(--color-text-muted)] text-xs before:content-[''] before:flex-1 before:h-px before:bg-white/10 after:content-[''] after:flex-1 after:h-px after:bg-white/10">
          ou
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full py-2.5 rounded-lg font-medium text-[13.5px] text-[var(--color-text-primary)] bg-white/4 border border-white/10 flex items-center justify-center gap-2.5 transition-colors hover:bg-white/7 hover:border-white/16"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Entrar com Google Workspace
        </button>

        <p className="text-center text-[11.5px] text-[var(--color-text-muted)]/70 mt-6">
          Precisa de acesso? Fale com um{' '}
          <a href="#" className="text-[var(--color-text-muted)] hover:underline">
            administrador
          </a>
          .
        </p>
      </div>
    </div>
  )
}
