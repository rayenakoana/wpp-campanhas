import Icon from '../../components/Icon'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { META_WABA_ID as WABA_ID, META_WPP_TOKEN as META_TOKEN } from '../../lib/metaConfig'
import { useTemplates } from '../../hooks/useTemplates'
import { supabaseWpp } from '../../lib/supabase'


// Mapeia status da Meta para valores aceitos pelo Supabase
function normalizarStatus(s: string | undefined): string {
  const v = (s ?? 'pending').toLowerCase()
  if (v === 'approved') return 'approved'
  if (v === 'rejected') return 'rejected'
  if (v === 'disabled' || v === 'paused') return 'disabled'
  return 'pending'
}

// ── Constantes Meta ──────────────────────────────────────────────────────────


const CATEGORIAS = [
  { value: 'UTILITY',        label: 'Utilidade',       desc: 'Transacional, confirmações, alertas',   color: 'rgba(255,255,255,0.09)',  text: 'var(--text-2)' },
  { value: 'MARKETING',      label: 'Marketing',       desc: 'Promoções, ofertas, engajamento',       color: 'rgba(201,160,23,0.13)',   text: 'var(--gold)' },
  { value: 'AUTHENTICATION', label: 'Autenticação',    desc: 'OTP, verificação de identidade',        color: 'rgba(155,123,216,0.13)', text: '#9B7BD8' },
]

const STATUS_CLS: Record<string, string> = {
  APPROVED: 'st-ok', approved: 'st-ok',
  PENDING: 'st-warn', pending: 'st-warn',
  REJECTED: 'st-fail', rejected: 'st-fail',
  PAUSED: 'st-neutral', DISABLED: 'st-neutral',
}
const STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Aprovado', approved: 'Aprovado',
  PENDING: 'Pendente', pending: 'Pendente',
  REJECTED: 'Rejeitado', rejected: 'Rejeitado',
  PAUSED: 'Pausado', DISABLED: 'Desabilitado',
}

const QUALITY_COLOR: Record<string, string> = {
  GREEN: 'var(--green)', YELLOW: 'var(--amber)', RED: 'var(--red)',
}
const QUALITY_LABEL: Record<string, string> = {
  GREEN: 'Alta qualidade', YELLOW: 'Qualidade média', RED: 'Baixa qualidade',
}

// Tipo de header → ícone SVG inline
function HeaderIcon({ type }: { type: string }) {
  const t = (type ?? '').toUpperCase()
  if (t === 'IMAGE') return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
    </svg>
  )
  if (t === 'VIDEO') return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="15" height="18" rx="2"/><path d="m17 8 5 3-5 3Z"/>
    </svg>
  )
  if (t === 'DOCUMENT') return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
    </svg>
  )
  if (t === 'LOCATION') return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  )
  // TEXT / default
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h12"/>
    </svg>
  )
}

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

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

// ── Badge de categoria ───────────────────────────────────────────────────────
function CategoriaBadge({ cat }: { cat: string }) {
  const c = CATEGORIAS.find((x) => x.value === cat) ?? CATEGORIAS[0]
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, marginLeft: -8,
      background: c.color, color: c.text, letterSpacing: '0.06em',
      textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const,
    }}>
      {c.label}
    </span>
  )
}

// ── Preview bubble WhatsApp ──────────────────────────────────────────────────
interface TemplatePreviewProps {
  components: any[]
  compact?: boolean
  bodyFallback?: string
}
function TemplatePreview({ components, compact = false, bodyFallback }: TemplatePreviewProps) {
  // Normaliza os components — a API às vezes retorna type em minúsculo ou estrutura diferente
  const normalized = (components ?? []).map((c: any) => ({
    ...c,
    type: (c.type ?? '').toUpperCase(),
    // Alguns campos vêm em 'text', outros em 'body', outros aninhados
    text: c.text ?? c.body ?? c.content ?? '',
  }))

  const header  = normalized.find((c: any) => c.type === 'HEADER')
  const bodyComp = normalized.find((c: any) => c.type === 'BODY')
  const body    = bodyComp ?? (bodyFallback ? { type: 'BODY', text: bodyFallback } : undefined)
  const footer  = normalized.find((c: any) => c.type === 'FOOTER')
  const buttons = normalized.find((c: any) => c.type === 'BUTTONS')

  function highlightVars(text: string) {
    if (!text) return null
    const parts = text.split(/({{[^}]+}})/)
    return parts.map((p, i) =>
      /^{{/.test(p)
        ? <span key={i} style={{ color: 'var(--gold)', fontWeight: 600 }}>{p}</span>
        : <span key={i}>{p}</span>
    )
  }

  // Fundo do chat = verde WhatsApp escuro no tema dark, bege no tema claro
  const bubbleBg = 'var(--bubble-bg)'
  const bubbleText = 'var(--bubble-text)'
  const mediaPlaceholderBg = 'var(--wpp-media-bg, rgba(255,255,255,0.08))'
  const footerBorder = 'var(--wpp-footer-border, rgba(255,255,255,0.08))'

  return (
    <div style={{ background: 'var(--bg)', borderRadius: 12, padding: compact ? 10 : 14, border: '1px solid var(--line-soft)' }}>
      <div style={{
        background: bubbleBg,
        borderRadius: 10,
        padding: compact ? '10px 12px' : '13px 15px',
        fontSize: compact ? 12 : 13,
        lineHeight: 1.55,
        maxWidth: '100%',
        color: bubbleText,
      }}>
        {/* Header */}
        {header && (
          <div style={{ marginBottom: 8 }}>
            {header.format === 'IMAGE' && (
              <div style={{ background: mediaPlaceholderBg, borderRadius: 6, height: compact ? 60 : 90, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="var(--text-3)" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
              </div>
            )}
            {header.format === 'VIDEO' && (
              <div style={{ background: mediaPlaceholderBg, borderRadius: 6, height: compact ? 60 : 90, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="var(--text-3)" strokeWidth={1.5}><rect x="2" y="3" width="15" height="18" rx="2"/><path d="m17 8 5 3-5 3Z"/></svg>
              </div>
            )}
            {header.format === 'DOCUMENT' && (
              <div style={{ background: mediaPlaceholderBg, borderRadius: 6, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="var(--text-3)" strokeWidth={1.5}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Documento</span>
              </div>
            )}
            {(header.format === 'TEXT' || !header.format) && header.text && (
              <div style={{ fontWeight: 600, marginBottom: 4, color: bubbleText }}>{highlightVars(header.text)}</div>
            )}
          </div>
        )}

        {/* Body */}
        {(body?.text || body?.body || body?.content) && (
          <div style={{ color: bubbleText, lineHeight: 1.55 }}>
            {highlightVars(body.text || body.body || body.content || '')}
          </div>
        )}

        {/* Footer */}
        {footer?.text && (
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, borderTop: `1px solid ${footerBorder}`, paddingTop: 6 }}>
            {footer.text}
          </div>
        )}

        {/* Timestamp */}
        <div style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'right' as const, marginTop: 6 }}>09:41 ✓✓</div>
      </div>

      {/* Botões */}
      {buttons?.buttons?.map((btn: any, i: number) => (
        <div key={i} style={{
          background: bubbleBg,
          borderTop: `1px solid ${footerBorder}`,
          borderRadius: i === buttons.buttons.length - 1 ? '0 0 10px 10px' : 0,
          padding: compact ? '7px 12px' : '9px 15px',
          fontSize: compact ? 11 : 12.5,
          color: 'var(--blue)',
          textAlign: 'center' as const,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          {btn.type === 'URL' && (
            <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          )}
          {btn.type === 'PHONE_NUMBER' && (
            <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.5a16 16 0 0 0 6 6l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16z"/></svg>
          )}
          {btn.text}
        </div>
      ))}
    </div>
  )
}

// ── Drawer de detalhe ────────────────────────────────────────────────────────
interface DrawerDetalheProps {
  template: any
  onClose: () => void
  onUsarNaCampanha?: () => void
  modoLibrary?: boolean
  onAdicionarNaWABA?: () => void
  adicionando?: boolean
  adicionadoOk?: boolean
}

function DrawerDetalhe({ template, onClose, onUsarNaCampanha, modoLibrary, onAdicionarNaWABA, adicionando, adicionadoOk }: DrawerDetalheProps) {
  const headerComp = template.components?.find((c: any) => c.type === 'HEADER')
  const headerType = headerComp?.format ?? 'TEXT'

  const allButtons = template.components?.find((c: any) => c.type === 'BUTTONS')?.buttons ?? []

  const qualityScore = template.quality_score?.score ?? template.qualityScore ?? null

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 201,
        width: 480, maxWidth: '96vw',
        background: 'var(--bg)',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Header drawer */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 19, letterSpacing: '0.01em', color: 'var(--text)' }}>
              {template.name ?? template.meta_template_name}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' as const, alignItems: 'center' }}>
              <CategoriaBadge cat={template.category ?? 'UTILITY'} />
              <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <HeaderIcon type={headerType} />{headerType.charAt(0) + headerType.slice(1).toLowerCase()}
              </span>
              {template.language && (
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{template.language}</span>
              )}
              {qualityScore && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: QUALITY_COLOR[qualityScore] ?? 'var(--text-3)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: QUALITY_COLOR[qualityScore] ?? 'var(--text-3)', display: 'inline-block' }} />
                  {QUALITY_LABEL[qualityScore] ?? qualityScore}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 22, cursor: 'pointer', lineHeight: 1, marginLeft: 12 }}>×</button>
        </div>

        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
          {/* Preview */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 10 }}>
              Preview
            </div>
            <TemplatePreview components={template.components ?? []} bodyFallback={template.body} />
          </div>

          {/* Detalhes técnicos */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 12 }}>
              Detalhes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
              {[
                { label: 'Status', value: !modoLibrary ? (STATUS_LABEL[template.status] ?? template.status) : 'Pré-aprovado Meta' },
                { label: 'Categoria', value: CATEGORIAS.find(c => c.value === (template.category ?? 'UTILITY'))?.label },
                { label: 'Idioma', value: template.language ?? 'pt_BR' },
                ...(template.synced_at ? [{ label: 'Sincronizado em', value: formatarData(template.synced_at) }] : []),
                ...(template.rejected_reason ? [{ label: 'Motivo reprovação', value: template.rejected_reason }] : []),
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text-3)' }}>{label}</span>
                  <span style={{ fontWeight: 500, textAlign: 'right' as const, maxWidth: '60%' }}>{value ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Botões do template */}
          {allButtons.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 12 }}>
                Botões ({allButtons.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                {allButtons.map((btn: any, i: number) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line-soft)',
                    borderRadius: 8,
                    fontSize: 13,
                  }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                      background: btn.type === 'QUICK_REPLY' ? 'rgba(61,190,123,0.12)' : 'rgba(90,200,250,0.1)',
                      color: btn.type === 'QUICK_REPLY' ? 'var(--green)' : '#5AC8FA',
                      letterSpacing: '0.05em',
                    }}>
                      {btn.type === 'QUICK_REPLY' ? 'Resposta rápida' : btn.type === 'URL' ? 'Link' : btn.type === 'PHONE_NUMBER' ? 'Telefone' : btn.type}
                    </span>
                    <span style={{ flex: 1 }}>{btn.text}</span>
                    {btn.url && <span style={{ fontSize: 11, color: 'var(--text-3)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{btn.url}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer de ações */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, flexDirection: 'column' as const }}>
          {modoLibrary ? (
            adicionadoOk ? (
              <div style={{ padding: '11px 16px', background: 'var(--good-bg)', border: '1px solid var(--green)', borderRadius: 8, fontSize: 13, color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Icon name="check"/> Template adicionado à sua WABA. Aprovado automaticamente.
              </div>
            ) : (
              <button
                className="btn primary"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={adicionando}
                onClick={onAdicionarNaWABA}
              >
                {adicionando ? 'Adicionando à WABA...' : '+ Usar este modelo'}
              </button>
            )
          ) : (
            <button
              className="btn primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={onUsarNaCampanha}
            >
              Usar em campanha →
            </button>
          )}
          <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </>
  )
}

// ── Modal Novo Template — completo ──────────────────────────────────────────
interface ModalNovoTemplateProps { onClose: () => void; onCriado: () => void }

// Tipos de botão suportados
type BtnTipo = 'URL' | 'PHONE' | 'QUICK_REPLY' | 'FLOW' | 'VOICE_CALL' | 'COPY_CODE' | 'OTP'
interface BtnItem { id: number; tipo: BtnTipo; texto: string; url: string; tel: string; extra: string }

// Tipo de cabeçalho
type HeaderTipo = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'GIF' | 'DOCUMENT' | 'LOCATION'

const BTN_LABEL: Record<BtnTipo, string> = {
  URL: 'Link (URL)', PHONE: 'Telefone', QUICK_REPLY: 'Resp. rápida',
  FLOW: 'Flow', VOICE_CALL: 'Chamada WPP', COPY_CODE: 'Copy Code', OTP: 'OTP Autofill',
}
const BTN_COLOR: Record<BtnTipo, string> = {
  URL: 'rgba(90,200,250,0.12)', PHONE: 'rgba(61,190,123,0.12)', QUICK_REPLY: 'rgba(232,25,44,0.10)',
  FLOW: 'rgba(155,123,216,0.12)', VOICE_CALL: 'rgba(217,126,43,0.12)',
  COPY_CODE: 'rgba(90,200,250,0.08)', OTP: 'rgba(155,123,216,0.10)',
}
const BTN_TEXT_COLOR: Record<BtnTipo, string> = {
  URL: '#5AC8FA', PHONE: 'var(--green)', QUICK_REPLY: 'var(--red)',
  FLOW: '#9B7BD8', VOICE_CALL: 'var(--amber)', COPY_CODE: '#5AC8FA', OTP: '#9B7BD8',
}

function ModalNovoTemplate({ onClose, onCriado }: ModalNovoTemplateProps) {
  const [nomeDisplay, setNomeDisplay]   = useState('')
  const [categoria, setCategoria]       = useState<'MARKETING'|'UTILITY'|'AUTHENTICATION'>('UTILITY')
  const [idioma, setIdioma]             = useState('pt_BR')
  const [headerTipo, setHeaderTipo]     = useState<HeaderTipo>('NONE')
  const [headerTexto, setHeaderTexto]   = useState('')
  const [headerLocNome, setHeaderLocNome]   = useState('')
  const [headerLocEnd, setHeaderLocEnd]     = useState('')
  const [headerLocLat, setHeaderLocLat]     = useState('')
  const [headerLocLng, setHeaderLocLng]     = useState('')
  const [corpo, setCorpo]               = useState('')
  const [rodape, setRodape]             = useState('')
  const [botoes, setBotoes]             = useState<BtnItem[]>([])
  const [varCount, setVarCount]         = useState(3)
  const [enviando, setEnviando]         = useState(false)
  const [erro, setErro]                 = useState<string | null>(null)
  const [mediaFile, setMediaFile]       = useState<File | null>(null)
  const [secRec, setSecRec]             = useState(true)
  const [expMin, setExpMin]             = useState(10)
  const nextBtnId = useState(0)

  const nomeApi = normalizarNome(nomeDisplay)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Ao trocar categoria, limpa botões e header incompatíveis
  function mudarCategoria(cat: 'MARKETING'|'UTILITY'|'AUTHENTICATION') {
    setCategoria(cat)
    setBotoes([])
    if (cat === 'AUTHENTICATION') {
      setHeaderTipo('NONE')
      setCorpo('')
      setRodape('')
    }
  }

  // Inserir variável no cursor
  function inserirVariavel(v: string) {
    const el = document.getElementById('corpo-textarea') as HTMLTextAreaElement
    if (!el) { setCorpo(c => c + v); return }
    const s = el.selectionStart, e = el.selectionEnd
    const novo = el.value.slice(0, s) + v + el.value.slice(e)
    setCorpo(novo)
    setTimeout(() => { el.selectionStart = el.selectionEnd = s + v.length; el.focus() }, 0)
  }

  function addVariavel() {
    setVarCount(n => n + 1)
  }

  // Botões helpers
  function addBtn(tipo: BtnTipo) {
    if (botoes.length >= 10) return
    nextBtnId[0]++
    setBotoes(prev => [...prev, { id: nextBtnId[0], tipo, texto: '', url: '', tel: '', extra: '' }])
  }
  function removeBtn(id: number) { setBotoes(prev => prev.filter(b => b.id !== id)) }
  function updateBtn(id: number, field: keyof BtnItem, value: string) {
    setBotoes(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b))
  }

  const urlCount    = botoes.filter(b => b.tipo === 'URL').length
  const telCount    = botoes.filter(b => b.tipo === 'PHONE').length
  const btnTotal    = botoes.length

  // Extrair params posicionais do texto
  function extrairParams(texto: string) {
    const matches = texto.match(/\{\{(\d+)\}\}/g) ?? []
    const uniq = [...new Set(matches)]
    return uniq.map(m => m.replace(/\{|\}/g, ''))
  }

  // Subir mídia via Resumable Upload API e retornar handle
  async function uploadMedia(file: File): Promise<string> {
    // 1. Iniciar sessão de upload
    const startRes = await fetch(`https://graph.facebook.com/v20.0/app/uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${META_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_length: file.size, file_type: file.type, access_token: META_TOKEN }),
    })
    const startJson = await startRes.json()
    if (startJson.error) throw new Error(startJson.error.message)
    const sessionId = startJson.id

    // 2. Fazer upload do arquivo
    const upRes = await fetch(`https://graph.facebook.com/v20.0/${sessionId}`, {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${META_TOKEN}`,
        'file_offset': '0',
        'Content-Type': file.type,
      },
      body: file,
    })
    const upJson = await upRes.json()
    if (upJson.error) throw new Error(upJson.error.message)
    return upJson.h // handle
  }

  async function handleSubmit() {
    setErro(null)
    if (!nomeDisplay.trim()) { setErro('Dê um nome ao template.'); return }
    if (categoria !== 'AUTHENTICATION' && !corpo.trim()) { setErro('Escreva o corpo da mensagem.'); return }

    setEnviando(true)
    try {
      const components: any[] = []

      // Cabeçalho
      if (categoria !== 'AUTHENTICATION' && headerTipo !== 'NONE') {
        if (headerTipo === 'TEXT') {
          const params = extrairParams(headerTexto)
          components.push({
            type: 'HEADER', format: 'TEXT', text: headerTexto,
            ...(params.length > 0 && { example: { header_text: [headerTexto.replace(/\{\{\d+\}\}/g, 'Exemplo')] } }),
          })
        } else if (headerTipo === 'LOCATION') {
          components.push({ type: 'HEADER', format: 'LOCATION' })
        } else {
          // IMAGE, VIDEO, GIF, DOCUMENT — precisa de handle de upload
          let handle = ''
          if (mediaFile) {
            handle = await uploadMedia(mediaFile)
          }
          components.push({
            type: 'HEADER',
            format: headerTipo === 'GIF' ? 'VIDEO' : headerTipo, // GIF é enviado como VIDEO
            ...(handle ? { example: { header_handle: [handle] } } : {}),
          })
        }
      }

      // Corpo
      if (categoria === 'AUTHENTICATION') {
        components.push({
          type: 'BODY',
          add_security_recommendation: secRec,
        })
        if (expMin > 0) {
          components.push({ type: 'FOOTER', code_expiration_minutes: expMin })
        }
      } else {
        const params = extrairParams(corpo)
        components.push({
          type: 'BODY',
          text: corpo.trim(),
          ...(params.length > 0 && {
            example: { body_text: [params.map(() => 'Exemplo')] },
          }),
        })
        if (rodape.trim()) {
          components.push({ type: 'FOOTER', text: rodape.trim() })
        }
      }

      // Botões
      if (botoes.length > 0) {
        const btnComponents = botoes.map(b => {
          if (b.tipo === 'URL')         return { type: 'URL', text: b.texto, url: b.url }
          if (b.tipo === 'PHONE')       return { type: 'PHONE_NUMBER', text: b.texto, phone_number: b.tel }
          if (b.tipo === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: b.texto }
          if (b.tipo === 'FLOW')        return { type: 'FLOW', text: b.texto, flow_id: b.extra, navigate_screen: 'FLOW_JSON' }
          if (b.tipo === 'VOICE_CALL')  return { type: 'VOICE_CALL', text: b.texto }
          if (b.tipo === 'COPY_CODE')   return { type: 'COPY_CODE', example: b.extra }
          if (b.tipo === 'OTP')         return { type: 'OTP', otp_type: 'ONE_TAP', text: b.texto, supported_apps: b.extra ? [{ package_name: b.extra, signature_hash: '' }] : [] }
          return null
        }).filter(Boolean)
        components.push({ type: 'BUTTONS', buttons: btnComponents })
      }

      const payload: any = { name: nomeApi, category: categoria, language: idioma, components }

      // Localização: coordenadas só são passadas no envio, não na criação
      // (a criação só define que o header é LOCATION)

      const res = await fetch(`https://graph.facebook.com/v20.0/${WABA_ID}/message_templates`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${META_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error?.message ?? JSON.stringify(json.error))

      // Salvar no Supabase
      const bodyText = categoria === 'AUTHENTICATION'
        ? `{{1}} é seu código de verificação.${secRec ? ' Para sua segurança, não compartilhe este código.' : ''}`
        : corpo.trim()

      const { error: dbError } = await supabaseWpp.from('templates').upsert(
        {
          meta_template_id: json.id ?? null,
          meta_template_name: nomeApi,
          status: normalizarStatus(json.status),
          category: categoria.toLowerCase(),
          language: idioma,
          body: bodyText,
          body_text: bodyText,
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

  // Preview ao vivo
  const previewComponents: any[] = []
  if (categoria === 'AUTHENTICATION') {
    previewComponents.push({ type: 'BODY', text: `*123456* é seu código de verificação.${secRec ? '\nPara sua segurança, não compartilhe este código.' : ''}` })
    if (expMin > 0) previewComponents.push({ type: 'FOOTER', text: `Este código expira em ${expMin} minutos.` })
  } else {
    if (headerTipo === 'TEXT' && headerTexto) previewComponents.push({ type: 'HEADER', format: 'TEXT', text: headerTexto })
    else if (headerTipo !== 'NONE' && headerTipo !== 'LOCATION') previewComponents.push({ type: 'HEADER', format: headerTipo })
    else if (headerTipo === 'LOCATION') previewComponents.push({ type: 'HEADER', format: 'LOCATION', loc_nome: headerLocNome })
    if (corpo) previewComponents.push({ type: 'BODY', text: corpo })
    if (rodape) previewComponents.push({ type: 'FOOTER', text: rodape })
  }
  if (botoes.length > 0) {
    previewComponents.push({ type: 'BUTTONS', buttons: botoes.map(b => ({ type: b.tipo === 'QUICK_REPLY' ? 'QUICK_REPLY' : b.tipo === 'URL' ? 'URL' : b.tipo === 'PHONE' ? 'PHONE_NUMBER' : b.tipo, text: b.texto || BTN_LABEL[b.tipo] })) })
  }

  const canSubmit = !enviando && !!nomeDisplay.trim() && (categoria === 'AUTHENTICATION' || !!corpo.trim())

  // Estilo dos botões de tipo de cabeçalho
  const hBtnStyle = (t: HeaderTipo): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 18, cursor: 'pointer',
    border: `1px solid ${headerTipo === t ? 'var(--red)' : 'var(--line)'}`,
    background: headerTipo === t ? 'rgba(232,25,44,0.10)' : 'transparent',
    color: headerTipo === t ? 'var(--red)' : 'var(--text-2)',
    fontSize: 12, fontWeight: headerTipo === t ? 600 : 500,
    fontFamily: 'Inter', display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all .15s',
  })

  // Estilo dos cards de categoria
  const catCardStyle = (c: string): React.CSSProperties => ({
    padding: '9px 12px', borderRadius: 9, cursor: 'pointer',
    border: `1.5px solid ${categoria === c ? 'var(--red)' : 'var(--line)'}`,
    background: categoria === c ? 'rgba(232,25,44,0.08)' : 'transparent',
    textAlign: 'left', width: '100%', transition: 'all .15s',
  })

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} />

      {/* Drawer full-height */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 301,
        width: '100%', maxWidth: 1400,
        background: 'var(--bg)',
        borderLeft: '1px solid rgba(255,255,255,0.09)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Head */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, background: 'var(--surface)' }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 20, letterSpacing: '0.02em' }}>Novo Template</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Submetido para aprovação da Meta via API · WABA {WABA_ID}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 20, cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}>×</button>
        </div>

        {/* Body — 2 colunas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', flex: 1, overflow: 'hidden' }}>

          {/* Formulário */}
          <div style={{ overflowY: 'auto', padding: '22px 26px' }}>

            {erro && (
              <div style={{ padding: '11px 14px', background: 'rgba(232,25,44,0.10)', border: '1px solid rgba(232,25,44,0.28)', borderRadius: 8, fontSize: 13, color: 'var(--danger)', marginBottom: 18, lineHeight: 1.5 }}>{erro}</div>
            )}

            {/* Identificação */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'var(--text-3)', marginBottom: 10, paddingBottom: 7, borderBottom: '1px solid var(--line-soft)' }}>Identificação</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Nome do template</label>
                  <input className="input" value={nomeDisplay} onChange={e => setNomeDisplay(e.target.value)} placeholder="Ex: boas_vindas_paraguai" autoFocus />
                  {nomeDisplay && <div className="hint" style={{ fontFamily: 'monospace', fontSize: 11 }}>→ {nomeApi}</div>}
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Idioma</label>
                  <select className="input" value={idioma} onChange={e => setIdioma(e.target.value)}>
                    <option value="pt_BR">Português (BR) — recomendado</option>
                    <option value="pt_PT">Português (PT)</option>
                    <option value="en_US">English (US)</option>
                    <option value="es">Español</option>
                  </select>
                  <div className="hint">Use sempre pt_BR, nunca pt_PT.</div>
                </div>
              </div>
            </div>

            {/* Categoria */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'var(--text-3)', marginBottom: 10, paddingBottom: 7, borderBottom: '1px solid var(--line-soft)' }}>Categoria</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7 }}>
                {[
                  { v: 'MARKETING', l: 'Marketing', d: 'Promoções, ofertas, engajamento' },
                  { v: 'UTILITY', l: 'Utilidade', d: 'Confirmações, lembretes, alertas' },
                  { v: 'AUTHENTICATION', l: 'Autenticação', d: 'OTP, verificação de identidade' },
                ].map(c => (
                  <button key={c.v} style={catCardStyle(c.v)} onClick={() => mudarCategoria(c.v as any)}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block' }}>{c.l}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, display: 'block' }}>{c.d}</span>
                  </button>
                ))}
              </div>
              {categoria === 'AUTHENTICATION' && (
                <div style={{ marginTop: 10, padding: '9px 13px', borderRadius: 8, background: 'rgba(155,123,216,0.08)', border: '1px solid rgba(155,123,216,0.2)', fontSize: 11, color: 'var(--blue)', lineHeight: 1.5 }}>
                  Templates de Autenticação têm corpo de texto fixo definido pela Meta. Você pode ativar recomendação de segurança e definir tempo de expiração. Botões disponíveis: Copy Code, OTP Autofill.
                </div>
              )}
            </div>

            {/* Autenticação — opções específicas */}
            {categoria === 'AUTHENTICATION' && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'var(--text-3)', marginBottom: 10, paddingBottom: 7, borderBottom: '1px solid var(--line-soft)' }}>Opções de Autenticação</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <input type="checkbox" id="sec-rec" checked={secRec} onChange={e => setSecRec(e.target.checked)} style={{ accentColor: 'var(--red)', width: 14, height: 14 }} />
                  <label htmlFor="sec-rec" style={{ fontSize: 13, cursor: 'pointer' }}>Incluir recomendação de segurança</label>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Tempo de expiração (minutos, 0 = sem expiração)</label>
                  <input className="input" type="number" min={0} max={90} value={expMin} onChange={e => setExpMin(Number(e.target.value))} style={{ width: 120 }} />
                </div>
              </div>
            )}

            {/* Cabeçalho — só para não-auth */}
            {categoria !== 'AUTHENTICATION' && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'var(--text-3)', marginBottom: 10, paddingBottom: 7, borderBottom: '1px solid var(--line-soft)' }}>
                  Cabeçalho <span style={{ fontSize: 9, fontWeight: 400, letterSpacing: 0, textTransform: 'none' as const, color: 'var(--text-3)' }}>(opcional)</span>
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const }}>
                  {(['NONE','TEXT','IMAGE','VIDEO','GIF','DOCUMENT','LOCATION'] as HeaderTipo[]).map(t => (
                    <button key={t} style={hBtnStyle(t)} onClick={() => setHeaderTipo(t)}>
                      {t === 'NONE' ? 'Nenhum' : t === 'TEXT' ? 'Texto' : t === 'IMAGE' ? 'Imagem' : t === 'VIDEO' ? 'Vídeo' : t === 'GIF' ? 'GIF' : t === 'DOCUMENT' ? 'Documento' : 'Localização'}
                    </button>
                  ))}
                </div>

                {headerTipo === 'TEXT' && (
                  <div style={{ marginTop: 10 }}>
                    <input className="input" value={headerTexto} onChange={e => setHeaderTexto(e.target.value)} placeholder="Texto do cabeçalho (máx. 60 caracteres)" maxLength={60} />
                    <div className="hint">{headerTexto.length}/60 caracteres</div>
                  </div>
                )}
                {(headerTipo === 'IMAGE' || headerTipo === 'VIDEO' || headerTipo === 'GIF' || headerTipo === 'DOCUMENT') && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ border: '1.5px dashed var(--line)', borderRadius: 9, padding: 20, textAlign: 'center' as const, cursor: 'pointer' }}
                      onClick={() => document.getElementById('media-file-input')?.click()}>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        {mediaFile ? mediaFile.name : `Clique para enviar ${headerTipo === 'IMAGE' ? 'imagem (JPG/PNG · 5MB)' : headerTipo === 'VIDEO' ? 'vídeo (MP4 · 16MB)' : headerTipo === 'GIF' ? 'GIF como MP4 · 3.5MB' : 'documento (PDF · 100MB)'}`}
                      </div>
                    </div>
                    <input id="media-file-input" type="file" style={{ display: 'none' }}
                      accept={headerTipo === 'IMAGE' ? 'image/jpeg,image/png' : headerTipo === 'DOCUMENT' ? 'application/pdf' : 'video/mp4'}
                      onChange={e => setMediaFile(e.target.files?.[0] ?? null)} />
                    <div className="hint">O arquivo será enviado à Meta via Resumable Upload API antes da criação do template.</div>
                  </div>
                )}
                {headerTipo === 'LOCATION' && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ background: 'linear-gradient(135deg,#1a2a1a,#0d1a0d)', borderRadius: '9px 9px 0 0', height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📍</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 10, background: 'var(--surface-2)', borderRadius: '0 0 9px 9px', border: '1px solid var(--line)' }}>
                      <div><div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 3 }}>Nome do local</div><input className="input" value={headerLocNome} onChange={e => setHeaderLocNome(e.target.value)} placeholder="Ex: Escritório CS" /></div>
                      <div><div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 3 }}>Endereço</div><input className="input" value={headerLocEnd} onChange={e => setHeaderLocEnd(e.target.value)} placeholder="Rua, número, cidade" /></div>
                      <div><div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 3 }}>Latitude</div><input className="input" value={headerLocLat} onChange={e => setHeaderLocLat(e.target.value)} placeholder="-23.5489" /></div>
                      <div><div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 3 }}>Longitude</div><input className="input" value={headerLocLng} onChange={e => setHeaderLocLng(e.target.value)} placeholder="-46.6388" /></div>
                    </div>
                    <div className="hint">Disponível para Utility e Marketing. Abre o app de mapas do usuário ao tocar.</div>
                  </div>
                )}
              </div>
            )}

            {/* Corpo — só para não-auth */}
            {categoria !== 'AUTHENTICATION' && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'var(--text-3)', marginBottom: 10, paddingBottom: 7, borderBottom: '1px solid var(--line-soft)' }}>Corpo da mensagem</div>
                <textarea id="corpo-textarea" className="input" value={corpo} onChange={e => setCorpo(e.target.value)} rows={8}
                  placeholder="Olá {{1}}! Vimos que você demonstrou interesse na Imersão Paraguai. Temos uma condição especial até {{2}}." />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Variáveis:</span>
                    {Array.from({ length: varCount }, (_, i) => `{{${i + 1}}}`).map(v => (
                      <span key={v} className="var-chip" onClick={() => inserirVariavel(v)}>{v}</span>
                    ))}
                    <span className="var-chip" style={{ color: 'var(--green)', borderColor: 'rgba(61,190,123,0.3)', cursor: 'pointer' }} onClick={addVariavel}>+ {`{{${varCount + 1}}}`}</span>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{corpo.length}/1024</span>
                </div>
                <div className="hint">Use {`{{1}}`}, {`{{2}}`}... para nome, data, produto, valor, etc.</div>
              </div>
            )}

            {/* Rodapé — só para não-auth */}
            {categoria !== 'AUTHENTICATION' && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'var(--text-3)', marginBottom: 10, paddingBottom: 7, borderBottom: '1px solid var(--line-soft)' }}>
                  Rodapé <span style={{ fontSize: 9, fontWeight: 400, letterSpacing: 0, textTransform: 'none' as const, color: 'var(--text-3)' }}>(opcional)</span>
                </div>
                <input className="input" value={rodape} onChange={e => setRodape(e.target.value)} maxLength={60} placeholder="Ex: Clique em Parar para cancelar as mensagens" />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 3 }}><span style={{ fontSize: 10, color: 'var(--text-3)' }}>{rodape.length}/60</span></div>
                <div className="hint">Recomendado pela Meta para manter a saúde do número.</div>
              </div>
            )}

            {/* Botões */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'var(--text-3)', marginBottom: 10, paddingBottom: 7, borderBottom: '1px solid var(--line-soft)' }}>
                Botões <span style={{ fontSize: 9, fontWeight: 400, letterSpacing: 0, textTransform: 'none' as const }}>até 10 total</span>
              </div>

              {/* Lista de botões adicionados */}
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 7, marginBottom: 10 }}>
                {botoes.map(b => (
                  <div key={b.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: BTN_COLOR[b.tipo], color: BTN_TEXT_COLOR[b.tipo], whiteSpace: 'nowrap' as const }}>{BTN_LABEL[b.tipo]}</span>
                      <input placeholder="Texto do botão (máx. 25 chars)" maxLength={25} value={b.texto} onChange={e => updateBtn(b.id, 'texto', e.target.value)}
                        style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 12, fontFamily: 'Inter', outline: 'none' }} />
                      <button onClick={() => removeBtn(b.id)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1 }}>×</button>
                    </div>
                    {b.tipo === 'URL' && <input placeholder="https://costurandosucesso.com/..." value={b.url} onChange={e => updateBtn(b.id, 'url', e.target.value)} style={{ width: '100%', background: 'var(--bg)', border: 'none', borderTop: '1px solid var(--line-soft)', color: 'var(--text)', fontSize: 12, padding: '7px 11px', fontFamily: 'Inter', outline: 'none' }} />}
                    {b.tipo === 'PHONE' && <input placeholder="+55 11 99999-9999" value={b.tel} onChange={e => updateBtn(b.id, 'tel', e.target.value)} style={{ width: '100%', background: 'var(--bg)', border: 'none', borderTop: '1px solid var(--line-soft)', color: 'var(--text)', fontSize: 12, padding: '7px 11px', fontFamily: 'Inter', outline: 'none' }} />}
                    {b.tipo === 'FLOW' && <input placeholder="Flow ID (ex: 1234567890123456)" value={b.extra} onChange={e => updateBtn(b.id, 'extra', e.target.value)} style={{ width: '100%', background: 'var(--bg)', border: 'none', borderTop: '1px solid var(--line-soft)', color: 'var(--text)', fontSize: 12, padding: '7px 11px', fontFamily: 'Inter', outline: 'none' }} />}
                    {b.tipo === 'COPY_CODE' && <input placeholder="Código a copiar (máx. 15 chars)" maxLength={15} value={b.extra} onChange={e => updateBtn(b.id, 'extra', e.target.value)} style={{ width: '100%', background: 'var(--bg)', border: 'none', borderTop: '1px solid var(--line-soft)', color: 'var(--text)', fontSize: 12, padding: '7px 11px', fontFamily: 'Inter', outline: 'none' }} />}
                    {b.tipo === 'OTP' && <input placeholder="Package name Android para autofill" value={b.extra} onChange={e => updateBtn(b.id, 'extra', e.target.value)} style={{ width: '100%', background: 'var(--bg)', border: 'none', borderTop: '1px solid var(--line-soft)', color: 'var(--text)', fontSize: 12, padding: '7px 11px', fontFamily: 'Inter', outline: 'none' }} />}
                  </div>
                ))}
              </div>

              {/* Botões para adicionar — contextual por categoria */}
              {btnTotal < 10 && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const }}>
                  {categoria !== 'AUTHENTICATION' && <>
                    <button className="btn" style={{ fontSize: 11, padding: '5px 11px', opacity: urlCount >= 2 ? 0.35 : 1 }} disabled={urlCount >= 2} onClick={() => addBtn('URL')}>+ Link (URL)</button>
                    <button className="btn" style={{ fontSize: 11, padding: '5px 11px', opacity: telCount >= 1 ? 0.35 : 1 }} disabled={telCount >= 1} onClick={() => addBtn('PHONE')}>+ Telefone</button>
                    <button className="btn" style={{ fontSize: 11, padding: '5px 11px' }} onClick={() => addBtn('QUICK_REPLY')}>+ Resp. rápida</button>
                    <button className="btn" style={{ fontSize: 11, padding: '5px 11px' }} onClick={() => addBtn('FLOW')}>+ Flow</button>
                    <button className="btn" style={{ fontSize: 11, padding: '5px 11px' }} onClick={() => addBtn('VOICE_CALL')}>+ Chamada WPP</button>
                  </>}
                  {categoria === 'AUTHENTICATION' && <>
                    <button className="btn" style={{ fontSize: 11, padding: '5px 11px' }} onClick={() => addBtn('COPY_CODE')}>+ Copy Code</button>
                    <button className="btn" style={{ fontSize: 11, padding: '5px 11px' }} onClick={() => addBtn('OTP')}>+ OTP Autofill</button>
                  </>}
                </div>
              )}
              <div className="hint" style={{ marginTop: 7 }}>
                {btnTotal >= 4 ? 'Mais de 3 botões: aparecerão 2 + "Ver opções". Não suportado no WhatsApp Desktop.' : 'Dica: inclua "Parar de receber mensagens" (Resp. rápida) — recomendado pela Meta.'}
              </div>
            </div>

            {/* Info */}
            <div style={{ padding: '10px 13px', background: 'rgba(217,126,43,0.08)', border: '1px solid rgba(217,126,43,0.18)', borderRadius: 8, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
              <b>Aprovação:</b> Marketing costuma ser aprovado em segundos. Utilidade pode levar até 24h. Autenticação é aprovado automaticamente se seguir as regras da Meta.
            </div>

          </div>{/* /form */}

          {/* Preview */}
          <div style={{ overflowY: 'auto', padding: '18px 20px', background: 'var(--surface)', display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--text-3)' }}>Preview ao vivo</div>

            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ background: 'var(--surface-2)', padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--line-soft)' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>CS</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>Costurando Sucesso</div>
                  <div style={{ fontSize: 9, color: 'var(--text-3)' }}>Conta comercial verificada</div>
                </div>
              </div>
              <div style={{ background: 'var(--bubble-bg, #0B1A13)', padding: '14px 12px', minHeight: 200, display: 'flex', flexDirection: 'column' as const }}>
                {(previewComponents.some(c => c.type === 'BODY') || previewComponents.some(c => c.type === 'HEADER')) ? (
                  <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end' }}>
                    <TemplatePreview components={previewComponents} compact />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', minHeight: 180, textAlign: 'center' as const, gap: 7, color: 'var(--text-3)', fontSize: 12 }}>
                    Preencha o formulário para ver o preview
                  </div>
                )}
              </div>
            </div>

            {/* Meta info */}
            <div style={{ padding: '11px 13px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line-soft)', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65 }}>
              <b>Nome:</b> {nomeDisplay ? nomeApi : '—'}<br />
              <b>Categoria:</b> {categoria === 'MARKETING' ? 'Marketing' : categoria === 'UTILITY' ? 'Utilidade' : 'Autenticação'}<br />
              <b>Idioma:</b> {idioma}<br />
              <b>Variáveis:</b> {extrairParams(corpo).length}<br />
              <b>Botões:</b> {botoes.length}
            </div>
          </div>

        </div>{/* /body */}

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'var(--surface)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            Idioma: <b>{idioma}</b> · Categoria: <b>{categoria === 'MARKETING' ? 'Marketing' : categoria === 'UTILITY' ? 'Utilidade' : 'Autenticação'}</b>
          </div>
          <div style={{ display: 'flex', gap: 9 }}>
            <button className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn primary" disabled={!canSubmit} onClick={handleSubmit}>
              {enviando ? 'Submetendo à Meta...' : 'Submeter para aprovação →'}
            </button>
          </div>
        </div>

      </div>
    </>
  )
}

// ── Aba: Meus Templates ──────────────────────────────────────────────────────
function MeusTemplates({ refreshKey = 0 }: { onNovoTemplate?: () => void; refreshKey?: number }) {
  const navigate = useNavigate()
  const { templates, loading, error } = useTemplates(refreshKey)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [busca, setBusca] = useState('')
  const [templateSelecionado, setTemplateSelecionado] = useState<any | null>(null)

  const filtrados = templates.filter((t) => {
    const okStatus = filtroStatus === 'todos' || t.status?.toUpperCase() === filtroStatus
    const okCat   = filtroCategoria === 'todas' || (t.category ?? '').toUpperCase() === filtroCategoria.toUpperCase()
    const okBusca = !busca || t.meta_template_name.toLowerCase().includes(busca.toLowerCase())
    return okStatus && okCat && okBusca
  })

  // Contadores
  const contar = (s: string) => templates.filter((t) => t.status?.toUpperCase() === s).length

  // Enriquecer template com dados da API Meta para o drawer
  const [templateDetalhe, setTemplateDetalhe] = useState<any | null>(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)

  async function abrirDetalhe(t: any) {
    setTemplateDetalhe(null)
    setTemplateSelecionado(t)
    setCarregandoDetalhe(true)
    try {
      const fields = 'name,status,category,language,components,quality_score,rejected_reason'
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${t.meta_template_id}?fields=${fields}&access_token=${META_TOKEN}`
      )
      if (res.ok) {
        const json = await res.json()
        setTemplateDetalhe({ ...t, ...json })
      } else {
        setTemplateDetalhe(t)
      }
    } catch {
      setTemplateDetalhe(t)
    } finally {
      setCarregandoDetalhe(false)
    }
  }

  return (
    <>
      {/* Barra de filtros */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' as const }}>
        {/* Tabs de status */}
        <div className="tabs" style={{ marginBottom: 0, flex: 1 }}>
          {[
            { key: 'todos', label: `Todos (${templates.length})` },
            { key: 'APPROVED', label: `Aprovados (${contar('APPROVED')})` },
            { key: 'PENDING', label: `Pendentes (${contar('PENDING')})` },
            { key: 'REJECTED', label: `Rejeitados (${contar('REJECTED')})` },
          ].map((a) => (
            <button key={a.key} className={`tab ${filtroStatus === a.key ? 'active' : ''}`} onClick={() => setFiltroStatus(a.key)}>
              {a.label}
            </button>
          ))}
        </div>

        {/* Filtro categoria */}
        <select
          className="input"
          style={{ width: 160, padding: '7px 10px', fontSize: 12 }}
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
        >
          <option value="todas">Todas as categorias</option>
          {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        {/* Busca */}
        <div style={{ position: 'relative' as const }}>
          <input
            className="input"
            style={{ width: 200, padding: '7px 10px 7px 32px', fontSize: 12 }}
            placeholder="Buscar template..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </div>
      </div>

      {loading && <div className="panel" style={{ padding: 24, fontSize: 13, color: 'var(--text-2)' }}>Carregando templates...</div>}
      {error && <div className="panel" style={{ padding: 24, fontSize: 13, color: 'var(--danger)' }}>Não foi possível carregar: {error}</div>}

      {!loading && !error && (
        <div style={{overflowX:'auto',width:'100%'}}>
          <table className="data-table">
          <thead>
            <tr>
              <th>Template</th>
              <th>Tipo</th>
              <th>Categoria</th>
              <th>Status</th>
              <th>Sincronizado em</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40, fontSize: 13 }}>
                  {busca ? `Nenhum template com "${busca}"` : 'Nenhum template encontrado.'}
                </td>
              </tr>
            )}
            {filtrados.map((t) => (
              <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => abrirDetalhe(t)}>
                <td>
                  <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 500 }}>{t.meta_template_name}</div>
                </td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)' }}>
                    <HeaderIcon type="TEXT" />
                    Texto
                  </span>
                </td>
                <td><CategoriaBadge cat={t.category ?? 'UTILITY'} /></td>
                <td>
                  <span className={`status-txt ${STATUS_CLS[t.status] ?? 'st-neutral'}`}>
                    {STATUS_LABEL[t.status] ?? t.status}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{formatarData(t.synced_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {/* Drawer de detalhe */}
      {templateSelecionado && (
        <DrawerDetalhe
          template={carregandoDetalhe ? templateSelecionado : (templateDetalhe ?? templateSelecionado)}
          onClose={() => { setTemplateSelecionado(null); setTemplateDetalhe(null) }}
          onUsarNaCampanha={() => { navigate('/criar-campanha', { state: { template: templateDetalhe ?? templateSelecionado } }) }}
        />
      )}
    </>
  )
}

// ── Biblioteca Meta ──────────────────────────────────────────────────────────

// Cache em memória — evita re-fetch enquanto a página está aberta
let _bibliotecaCache: LibTemplate[] | null = null
let _bibliotecaCacheTs = 0
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutos

interface LibTemplate {
  name: string
  category: string
  language: string
  components: any[]
  body?: string
  id?: string
}

type FiltroRecurso = 'todos' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
type FiltroBotao   = 'todos' | 'NONE' | 'CTA' | 'QUICK_REPLY'

function BibliotecaMeta({ onAdicionado, meusTemplatesNomes }: { onAdicionado: () => void; meusTemplatesNomes: Set<string> }) {
  const [templates, setTemplates] = useState<LibTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [filtroRecurso, setFiltroRecurso] = useState<FiltroRecurso>('todos')
  const [filtroBotao, setFiltroBotao] = useState<FiltroBotao>('todos')
  const [selecionado, setSelecionado] = useState<LibTemplate | null>(null)
  const [adicionando, setAdicionando] = useState(false)
  const [adicionadoOk, setAdicionadoOk] = useState(false)

  useEffect(() => {
    let cancelado = false

    function deduplicar(todos: LibTemplate[]): LibTemplate[] {
      const porNome = new Map<string, LibTemplate>()
      for (const t of todos) {
        // Normalizar components — a API às vezes retorna em formatos diferentes
        const comps = (t.components ?? []).map((c: any) => ({
          ...c,
          type: (c.type ?? '').toUpperCase(),
        }))
        const normalizado = { ...t, components: comps }

        const existente = porNome.get(t.name)
        if (!existente) { porNome.set(t.name, normalizado); continue }
        const lang = t.language ?? ''
        if (lang === 'pt_BR') { porNome.set(t.name, normalizado); continue }
        if (lang === 'en_US' && existente.language !== 'pt_BR') { porNome.set(t.name, normalizado) }
      }
      return Array.from(porNome.values())
    }

    async function carregar() {
      // Usa cache se ainda válido
      const agora = Date.now()
      if (_bibliotecaCache && (agora - _bibliotecaCacheTs) < CACHE_TTL_MS) {
        if (!cancelado) {
          setTemplates(_bibliotecaCache)
          setLoading(false)
        }
        return
      }

      setLoading(true)
      setErro(null)
      setTemplates([])
      try {
        let acumulado: LibTemplate[] = []
        let url = `https://graph.facebook.com/v20.0/message_template_library?fields=name,category,language,components,body&limit=200&access_token=${META_TOKEN}`
        let paginas = 0
        const MAX_PAGINAS = 5

        while (url && paginas < MAX_PAGINAS) {
          if (cancelado) return
          const res = await fetch(url)
          const json = await res.json()
          if (json.error) throw new Error(json.error.message)
          acumulado = acumulado.concat(json.data ?? [])
          paginas++
          const dedup = deduplicar(acumulado)
          if (!cancelado) setTemplates(dedup)
          url = json.paging?.next ?? ''
        }

        // Salva no cache
        const final = deduplicar(acumulado)
        _bibliotecaCache = final
        _bibliotecaCacheTs = Date.now()
      } catch (err) {
        if (!cancelado) setErro(err instanceof Error ? err.message : 'Erro ao carregar biblioteca')
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    carregar()
    return () => { cancelado = true }
  }, [])

  function getHeaderType(t: LibTemplate): string {
    const h = t.components?.find((c) => c.type === 'HEADER')
    return h?.format ?? 'TEXT'
  }

  function getBotaoTipo(t: LibTemplate): string {
    const btns = t.components?.find((c) => c.type === 'BUTTONS')?.buttons ?? []
    if (!btns.length) return 'NONE'
    if (btns.some((b: any) => b.type === 'URL' || b.type === 'PHONE_NUMBER')) return 'CTA'
    return 'QUICK_REPLY'
  }

  const filtrados = templates.filter((t) => {
    const okBusca = !busca || t.name.toLowerCase().includes(busca.toLowerCase())
    const okCat   = filtroCategoria === 'todas' || (t.category ?? '').toUpperCase() === filtroCategoria.toUpperCase()
    const okRecurso = filtroRecurso === 'todos' || getHeaderType(t) === filtroRecurso
    const okBotao = filtroBotao === 'todos' || getBotaoTipo(t) === filtroBotao
    return okBusca && okCat && okRecurso && okBotao
  })

  async function adicionarNaWABA(t: LibTemplate) {
    setAdicionando(true)
    setAdicionadoOk(false)

    // Tenta estratégias em ordem até uma funcionar
    const nomeFinal = normalizarNome(t.name)
    const estrategias = [
      // 1. library_template_name (caminho oficial da Meta para importar da biblioteca)
      {
        name: nomeFinal,
        category: t.category,
        language: t.language ?? 'pt_BR',
        library_template_name: t.name,
        library_template_button_inputs: [],
      },
      // 2. Só os campos essenciais sem components (alguns tokens aceitam assim)
      {
        name: nomeFinal,
        category: t.category,
        language: t.language ?? 'pt_BR',
      },
      // 3. Com components filtrados (sem campos que a API pode rejeitar)
      {
        name: nomeFinal,
        category: t.category,
        language: t.language ?? 'pt_BR',
        components: (t.components ?? []).map((c: any) => {
          // Remove campos extras que a API às vezes rejeita
          const { example, ...rest } = c
          return rest
        }),
      },
    ]

    let ultimoErro = ''
    for (const payload of estrategias) {
      try {
        const res = await fetch(
          `https://graph.facebook.com/v20.0/${WABA_ID}/message_templates`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${META_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        )
        const json = await res.json()
        if (json.error) {
          ultimoErro = json.error.message ?? JSON.stringify(json.error)
          continue // tenta próxima estratégia
        }

        // Sucesso — salva no Supabase
        await supabaseWpp.from('templates').upsert(
          {
            meta_template_id: json.id ?? null,
            meta_template_name: nomeFinal,
            status: normalizarStatus(json.status),
            category: (t.category ?? 'utility').toLowerCase(),
            language: t.language ?? 'pt_BR',
            body:      t.components?.find((c: any) => c.type === 'BODY')?.text ?? '',
            body_text: t.components?.find((c: any) => c.type === 'BODY')?.text ?? '',
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'meta_template_name' }
        )
        setAdicionadoOk(true)
        onAdicionado()
        return
      } catch (err) {
        ultimoErro = err instanceof Error ? err.message : String(err)
      }
    }

    // Todas as estratégias falharam
    alert(`Não foi possível adicionar o template à WABA.\n\nErro: ${ultimoErro}\n\nIsso pode acontecer porque:\n• O template já existe na sua WABA\n• O token não tem permissão de escrita em templates\n• A Meta não permite importar este template via API`)
    setAdicionando(false)
  }

  // Filtros laterais
  const FilterSection = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 10 }}>
        {titulo}
      </div>
      {children}
    </div>
  )

  function RadioOpt({ value, current, onSet, label, count }: any) {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: value === current ? 'var(--text)' : 'var(--text-2)', padding: '5px 0' }}>
        <span style={{
          width: 14, height: 14, borderRadius: '50%', border: `2px solid ${value === current ? 'var(--red)' : 'var(--line)'}`,
          background: value === current ? 'var(--red)' : 'transparent',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s',
        }}>
          {value === current && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff' }} />}
        </span>
        <input type="radio" value={value} checked={value === current} onChange={() => onSet(value)} style={{ display: 'none' }} />
        <span style={{ flex: 1 }}>{label}</span>
        {count !== undefined && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{count}</span>}
      </label>
    )
  }

  const contarCat = (cat: string) => templates.filter((t) => t.category === cat).length
  const contarRecurso = (r: string) => templates.filter((t) => getHeaderType(t) === r).length
  const contarBotao = (b: string) => templates.filter((t) => getBotaoTipo(t) === b).length

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'start' }}>

      {/* Painel de filtros lateral */}
      <div className="panel" style={{ padding: '16px 18px', position: 'sticky' as const, top: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 16, color: 'var(--text-2)' }}>Filtros</div>

        <FilterSection titulo="Categoria">
          <RadioOpt value="todas" current={filtroCategoria} onSet={setFiltroCategoria} label="Todas" count={templates.length} />
          <RadioOpt value="UTILITY"    current={filtroCategoria} onSet={setFiltroCategoria} label="Utilidade"    count={contarCat('UTILITY')} />
          <RadioOpt value="MARKETING"  current={filtroCategoria} onSet={setFiltroCategoria} label="Marketing"    count={contarCat('MARKETING')} />
          <RadioOpt value="AUTHENTICATION" current={filtroCategoria} onSet={setFiltroCategoria} label="Autenticação" count={contarCat('AUTHENTICATION')} />
        </FilterSection>

        <FilterSection titulo="Recurso">
          <RadioOpt value="todos"    current={filtroRecurso} onSet={setFiltroRecurso} label="Todos" />
          <RadioOpt value="TEXT"     current={filtroRecurso} onSet={setFiltroRecurso} label="Só texto"   count={contarRecurso('TEXT')} />
          <RadioOpt value="IMAGE"    current={filtroRecurso} onSet={setFiltroRecurso} label="Imagem"     count={contarRecurso('IMAGE')} />
          <RadioOpt value="VIDEO"    current={filtroRecurso} onSet={setFiltroRecurso} label="Vídeo"      count={contarRecurso('VIDEO')} />
          <RadioOpt value="DOCUMENT" current={filtroRecurso} onSet={setFiltroRecurso} label="Documento"  count={contarRecurso('DOCUMENT')} />
        </FilterSection>

        <FilterSection titulo="Botões">
          <RadioOpt value="todos"       current={filtroBotao} onSet={setFiltroBotao} label="Todos" />
          <RadioOpt value="NONE"        current={filtroBotao} onSet={setFiltroBotao} label="Sem botões" count={contarBotao('NONE')} />
          <RadioOpt value="CTA"         current={filtroBotao} onSet={setFiltroBotao} label="Link / Tel"  count={contarBotao('CTA')} />
          <RadioOpt value="QUICK_REPLY" current={filtroBotao} onSet={setFiltroBotao} label="Resp. rápida" count={contarBotao('QUICK_REPLY')} />
        </FilterSection>
      </div>

      {/* Área principal */}
      <div>
        {/* Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
            {loading ? 'Carregando...' : `${filtrados.length} modelos disponíveis`}
          </div>
          <div style={{ position: 'relative' as const }}>
            <input
              className="input"
              style={{ width: 220, padding: '7px 10px 7px 32px', fontSize: 12 }}
              placeholder="Buscar na biblioteca..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </div>
        </div>

        {erro && (
          <div className="panel" style={{ padding: '16px 20px', fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>
            {erro}
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
              A biblioteca de modelos pode exigir permissões adicionais no token. Tente recarregar ou verifique o token de acesso.
            </div>
          </div>
        )}

        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="panel" style={{ padding: 20, height: 180, opacity: 0.4, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {!loading && !erro && (
          filtrados.length === 0 ? (
            <div className="panel" style={{ padding: 40, textAlign: 'center' as const, fontSize: 13, color: 'var(--text-3)' }}>
              Nenhum modelo encontrado com esses filtros.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {filtrados.map((t, i) => {
                const headerType = getHeaderType(t)
                const botaoTipo  = getBotaoTipo(t)
                const allBtns    = t.components?.find((c) => c.type === 'BUTTONS')?.buttons ?? []
                return (
                  <div
                    key={i}
                    className="panel"
                    style={{ padding: 16, cursor: 'pointer', transition: 'border-color .15s', display: 'flex', flexDirection: 'column' as const, gap: 12 }}
                    onClick={() => { setSelecionado(t); setAdicionadoOk(meusTemplatesNomes.has(normalizarNome(t.name))) }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
                  >
                    {/* Card header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                          {t.name}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                          <CategoriaBadge cat={t.category} />
                          <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <HeaderIcon type={headerType} />
                            {headerType.charAt(0) + headerType.slice(1).toLowerCase()}
                          </span>
                          {botaoTipo !== 'NONE' && (
                            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
                              {allBtns.length} botão{allBtns.length > 1 ? 'ões' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--green)', background: 'rgba(61,190,123,0.1)', border: '1px solid rgba(61,190,123,0.2)', padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
                        Pré-aprovado
                      </span>
                    </div>

                    {/* Preview compacto */}
                    <TemplatePreview components={t.components} compact bodyFallback={t.body} />
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>

      {/* Drawer de detalhe */}
      {selecionado && (
        <DrawerDetalhe
          template={selecionado}
          onClose={() => setSelecionado(null)}
          modoLibrary
          onAdicionarNaWABA={() => adicionarNaWABA(selecionado)}
          adicionando={adicionando}
          adicionadoOk={adicionadoOk}
        />
      )}
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function Templates() {
  const [abaAtiva, setAbaAtiva] = useState<'meus' | 'biblioteca'>('meus')
  const [modalAberto, setModalAberto] = useState(false)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [meusTemplatesKey, setMeusTemplatesKey] = useState(0)
  const { templates: meusTemplates } = useTemplates(meusTemplatesKey)

  function onTemplateCriado() {
    setModalAberto(false)
    setSucesso('Template submetido à Meta! Aguarde a aprovação — pode levar até 24h.')
    setTimeout(() => setSucesso(null), 6000)
    setTimeout(() => window.location.reload(), 500)
  }

  return (
    <>
      {modalAberto && <ModalNovoTemplate onClose={() => setModalAberto(false)} onCriado={onTemplateCriado} />}

      {/* Tabs principais */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button
            className={`tab ${abaAtiva === 'meus' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('meus')}
          >
            Meus Templates
          </button>
          <button
            className={`tab ${abaAtiva === 'biblioteca' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('biblioteca')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            Biblioteca Meta
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: 'rgba(61,190,123,0.15)', color: 'var(--green)', letterSpacing: '0.04em' }}>
              PRÉ-APROVADOS
            </span>
          </button>
        </div>
        {abaAtiva === 'meus' && (
          <button className="btn primary" onClick={() => setModalAberto(true)}>+ Novo template</button>
        )}
      </div>

      {sucesso && (
        <div style={{ padding: '12px 16px', background: 'rgba(61,190,123,0.1)', border: '1px solid rgba(61,190,123,0.3)', borderRadius: 10, fontSize: 13, color: 'var(--green)', marginBottom: 16 }}>
          {sucesso}
        </div>
      )}

      {abaAtiva === 'meus'      && <MeusTemplates key={meusTemplatesKey} refreshKey={meusTemplatesKey} onNovoTemplate={() => setModalAberto(true)} />}
      {abaAtiva === 'biblioteca' && (
        <BibliotecaMeta
          meusTemplatesNomes={new Set(meusTemplates.map((t) => t.meta_template_name))}
          onAdicionado={() => {
            setMeusTemplatesKey((k) => k + 1)
          }}
        />
      )}
    </>
  )
}
