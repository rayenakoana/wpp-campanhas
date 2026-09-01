import { useState, useEffect } from 'react'
import { useTemplates } from '../../hooks/useTemplates'
import { supabaseWpp } from '../../lib/supabase'

// ── Constantes Meta ──────────────────────────────────────────────────────────
const WABA_ID = '2130870377837125'
const META_TOKEN = 'EAAeNfyyZBJy4BST4brul4auxTkxI2BPlcNg3ZCu41dPj2tfbXetW03LP5FdTXISt1Jq0CMjZBOZCdgeRJLsCWqDfVsamwyZBZAkv2FgLp4AeLLk6jub8qKpPx4TCGvwwg5HEQrPfyZBqZAhpZCTQsJOFV6cdchXNxZBNmCke5KLAyyNtvEmO43jZAmZB9h0EEfgmIQZDZD'

const CATEGORIAS = [
  { value: 'UTILITY', label: 'Utility — transacional, confirmações, alertas' },
  { value: 'MARKETING', label: 'Marketing — promoções, ofertas, engajamento' },
  { value: 'AUTHENTICATION', label: 'Authentication — OTP, verificação' },
]

const STATUS_CLS: Record<string, string> = {
  APPROVED: 'st-ok',
  approved: 'st-ok',
  PENDING: 'st-warn',
  pending: 'st-warn',
  REJECTED: 'st-fail',
  rejected: 'st-fail',
  PAUSED: 'st-neutral',
  DISABLED: 'st-neutral',
}

const STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Aprovado',
  approved: 'Aprovado',
  PENDING: 'Pendente',
  pending: 'Pendente',
  REJECTED: 'Rejeitado',
  rejected: 'Rejeitado',
  PAUSED: 'Pausado',
  DISABLED: 'Desabilitado',
}

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

// ── Gerador de nome normalizado ──────────────────────────────────────────────
function normalizarNome(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 512)
}

// ── Modal: Novo Template ─────────────────────────────────────────────────────
interface ModalNovoTemplateProps {
  onClose: () => void
  onCriado: () => void
}

function ModalNovoTemplate({ onClose, onCriado }: ModalNovoTemplateProps) {
  const [nomeDisplay, setNomeDisplay] = useState('')
  const [categoria, setCategoria] = useState('UTILITY')
  const [corpo, setCorpo] = useState('')
  const [rodape, setRodape] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  const nomeApi = normalizarNome(nomeDisplay)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function inserirVariavel(v: string) {
    setCorpo((c) => c + v)
  }

  // Extrai parâmetros {{1}}, {{2}} do corpo para montar o payload
  function extrairParams(texto: string) {
    const matches = texto.match(/\{\{(\d+)\}\}/g) ?? []
    const unicos = [...new Set(matches)]
    return unicos.map((m) => ({ type: 'text', text: m }))
  }

  async function handleSubmit() {
    setErro(null)
    if (!nomeDisplay.trim()) { setErro('Dê um nome ao template.'); return }
    if (!corpo.trim()) { setErro('Escreva o corpo da mensagem.'); return }
    if (nomeApi.length < 1) { setErro('Nome inválido — use apenas letras, números e underscore.'); return }

    setEnviando(true)

    try {
      // Monta componentes do template
      const components: any[] = [
        {
          type: 'BODY',
          text: corpo.trim(),
          ...(extrairParams(corpo).length > 0 && {
            example: { body_text: [extrairParams(corpo).map((p) => p.text)] },
          }),
        },
      ]

      if (rodape.trim()) {
        components.push({ type: 'FOOTER', text: rodape.trim() })
      }

      // Chama a API da Meta
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${WABA_ID}/message_templates`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${META_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: nomeApi,
            category: categoria,
            language: 'pt_BR',
            components,
          }),
        }
      )

      const json = await res.json()

      if (!res.ok || json.error) {
        const msg = json.error?.message ?? json.error?.error_user_msg ?? JSON.stringify(json.error)
        throw new Error(msg)
      }

      // Salva no Supabase com status PENDING
      const { error: dbError } = await supabaseWpp.from('templates').upsert(
        {
          meta_template_id: json.id ?? null,
          meta_template_name: nomeApi,
          status: json.status ?? 'PENDING',
          category: categoria,
          language: 'pt_BR',
          body_text: corpo.trim(),
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'meta_template_name' }
      )

      if (dbError) throw dbError

      onCriado()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar template.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        className="panel"
        style={{ width: 680, maxWidth: '96vw', padding: 32, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 20, letterSpacing: '0.01em' }}>
              Novo template
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3, letterSpacing: '0.02em' }}>
              Submetido para aprovação da Meta via API
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {erro && (
          <div style={{ padding: '12px 16px', background: 'rgba(232,25,44,0.1)', border: '1px solid rgba(232,25,44,0.3)', borderRadius: 8, fontSize: 13, color: '#f28c94', marginBottom: 20, lineHeight: 1.5 }}>
            {erro}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {/* Nome */}
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Nome do template</label>
            <input
              className="input"
              value={nomeDisplay}
              onChange={(e) => setNomeDisplay(e.target.value)}
              placeholder="Ex: reativacao_base_fria"
              autoFocus
            />
            {nomeDisplay && (
              <div className="hint" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                → {nomeApi}
              </div>
            )}
          </div>

          {/* Categoria */}
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Categoria</label>
            <select className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>{c.value}</option>
              ))}
            </select>
            <div className="hint">{CATEGORIAS.find((c) => c.value === categoria)?.label.split('—')[1]?.trim()}</div>
          </div>
        </div>

        {/* Corpo */}
        <div className="field">
          <label>Corpo da mensagem</label>
          <textarea
            className="input"
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            rows={5}
            placeholder="Olá {{1}}! Vimos que você demonstrou interesse em profissionalizar sua confecção. Temos uma condição especial esta semana — posso te contar mais?"
          />
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)', marginRight: 4 }}>Variáveis:</span>
            {['{{1}}', '{{2}}', '{{3}}'].map((v) => (
              <span key={v} className="var-chip" onClick={() => inserirVariavel(v)}>{v}</span>
            ))}
            <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 8 }}>
              {corpo.length}/1024 caracteres
            </span>
          </div>
          <div className="hint" style={{ marginTop: 6 }}>
            Use {'{{1}}'}, {'{{2}}'} para variáveis. A Meta requer exemplos — o app preenche automaticamente.
          </div>
        </div>

        {/* Rodapé opcional */}
        <div className="field">
          <label>Rodapé <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional)</span></label>
          <input
            className="input"
            value={rodape}
            onChange={(e) => setRodape(e.target.value)}
            placeholder="Ex: Responda PARAR para cancelar"
            maxLength={60}
          />
        </div>

        {/* Preview */}
        <div style={{ marginBottom: 20 }}>
          <button
            type="button"
            className="btn"
            style={{ fontSize: 12 }}
            onClick={() => setPreview((v) => !v)}
          >
            {preview ? 'Ocultar preview' : 'Ver preview'}
          </button>

          {preview && (
            <div style={{ marginTop: 12 }}>
              <div className="preview-phone">
                <div className="bubble">
                  {corpo || '(corpo vazio)'}
                  {rodape && (
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6 }}>
                      {rodape}
                    </div>
                  )}
                  <small>09:00 ✓✓</small>
                </div>
              </div>
              <div className="hint" style={{ marginTop: 6 }}>
                Variáveis aparecem como {'{{1}}'} até serem substituídas no disparo.
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{
          padding: '12px 16px',
          background: 'rgba(201,160,23,0.08)',
          border: '1px solid rgba(201,160,23,0.2)',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--text-2)',
          lineHeight: 1.6,
          marginBottom: 20,
          letterSpacing: '0.01em',
        }}>
          A Meta pode levar de alguns minutos a 24h para aprovar. O status aparece na lista abaixo e é sincronizado automaticamente a cada 6h via N8N. Templates <b>MARKETING</b> têm taxa por envio; <b>UTILITY</b> é gratuito dentro da janela de 24h.
        </div>

        {/* Botões */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn primary"
            disabled={enviando || !nomeDisplay.trim() || !corpo.trim()}
            onClick={handleSubmit}
          >
            {enviando ? 'Submetendo à Meta...' : 'Submeter para aprovação'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function Templates() {
  const { templates, loading, error } = useTemplates()
  const [modalAberto, setModalAberto] = useState(false)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  const templatesFiltrados = filtroStatus === 'todos'
    ? templates
    : templates.filter((t) => {
        if (filtroStatus === 'APPROVED') return t.status === 'APPROVED' || t.status === 'approved'
        if (filtroStatus === 'PENDING') return t.status === 'PENDING' || t.status === 'pending'
        if (filtroStatus === 'REJECTED') return t.status === 'REJECTED' || t.status === 'rejected'
        return t.status === filtroStatus
      })

  function onTemplateCriado() {
    setModalAberto(false)
    setSucesso('Template submetido à Meta! Aguarde a aprovação — pode levar até 24h.')
    setTimeout(() => setSucesso(null), 6000)
    // Reload para puxar o novo template da base
    setTimeout(() => window.location.reload(), 500)
  }

  return (
    <>
      {modalAberto && (
        <ModalNovoTemplate
          onClose={() => setModalAberto(false)}
          onCriado={onTemplateCriado}
        />
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {[
            { key: 'todos', label: 'Todos' },
            { key: 'APPROVED', label: 'Aprovados' },
            { key: 'PENDING', label: 'Pendentes' },
            { key: 'REJECTED', label: 'Rejeitados' },
          ].map((a) => (
            <button
              key={a.key}
              className={`tab ${filtroStatus === a.key ? 'active' : ''}`}
              onClick={() => setFiltroStatus(a.key)}
            >
              {a.label}
            </button>
          ))}
        </div>
        <button className="btn primary" onClick={() => setModalAberto(true)}>
          + Novo template
        </button>
      </div>

      {/* Aviso de sucesso */}
      {sucesso && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(61,190,123,0.1)',
          border: '1px solid rgba(61,190,123,0.3)',
          borderRadius: 10,
          fontSize: 13,
          color: '#8fe0b6',
          marginBottom: 16,
          letterSpacing: '0.01em',
        }}>
          {sucesso}
        </div>
      )}

      {loading && (
        <div className="panel" style={{ padding: 24, fontSize: 13, color: 'var(--text-2)' }}>
          Carregando templates...
        </div>
      )}

      {error && (
        <div className="panel" style={{ padding: 24, fontSize: 13, color: '#f28c94' }}>
          Não foi possível carregar os templates: {error}
        </div>
      )}

      {!loading && !error && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Template</th>
              <th>Categoria</th>
              <th>Idioma</th>
              <th>Status</th>
              <th>Sincronizado em</th>
            </tr>
          </thead>
          <tbody>
            {templatesFiltrados.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40, fontSize: 13 }}>
                  {filtroStatus === 'todos'
                    ? 'Nenhum template encontrado. Crie o primeiro clicando em "+ Novo template".'
                    : 'Nenhum template com esse status.'}
                </td>
              </tr>
            )}
            {templatesFiltrados.map((t) => (
              <tr key={t.id}>
                <td>
                  <div className="row-title" style={{ fontFamily: 'monospace', fontSize: 13 }}>
                    {t.meta_template_name}
                  </div>
                </td>
                <td>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: t.category === 'MARKETING'
                      ? 'rgba(201,160,23,0.12)'
                      : t.category === 'AUTHENTICATION'
                        ? 'rgba(155,123,216,0.12)'
                        : 'rgba(255,255,255,0.06)',
                    color: t.category === 'MARKETING'
                      ? 'var(--gold)'
                      : t.category === 'AUTHENTICATION'
                        ? '#9B7BD8'
                        : 'var(--text-2)',
                    letterSpacing: '0.04em',
                  }}>
                    {t.category ?? 'UTILITY'}
                  </span>
                </td>
                <td style={{ fontSize: 13, color: 'var(--text-2)' }}>pt_BR</td>
                <td>
                  <span className={`status-txt ${STATUS_CLS[t.status] ?? 'st-neutral'}`}>
                    {STATUS_LABEL[t.status] ?? t.status}
                  </span>
                </td>
                <td style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{formatarData(t.synced_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
