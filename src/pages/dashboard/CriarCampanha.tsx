import Icon from '../../components/Icon'
import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useSegmentos } from '../../hooks/useSegmentos'
import { useTemplates } from '../../hooks/useTemplates'
import { useDesempenho } from '../../hooks/useDesempenho'
import { supabaseWpp } from '../../lib/supabase'
import type { Lead } from '../../types/wpp'

// ── Hook: primeiro lead do segmento selecionado ──────────────────────────────
function usePrimeiroLead(segmentoId: string | null) {
  const [lead, setLead] = useState<Lead | null>(null)
  useEffect(() => {
    if (!segmentoId) { setLead(null); return }
    let cancelado = false
    async function buscar() {
      const { data: vinculos } = await supabaseWpp
        .from('segment_leads').select('lead_id').eq('segment_id', segmentoId).limit(1)
      if (cancelado || !vinculos || vinculos.length === 0) { setLead(null); return }
      const { data: leads } = await supabaseWpp
        .from('leads').select('*').eq('id', vinculos[0].lead_id).limit(1)
      if (!cancelado) setLead((leads?.[0] as Lead) ?? null)
    }
    buscar()
    return () => { cancelado = true }
  }, [segmentoId])
  return lead
}

// ── Hook: leads sem telefone ─────────────────────────────────────────────────
function useLeadsSemTelefone(segmentoIds: string[]) {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    if (segmentoIds.length === 0) { setCount(null); return }
    let cancelado = false
    async function buscar() {
      const { data: vinculos } = await supabaseWpp
        .from('segment_leads').select('lead_id').in('segment_id', segmentoIds)
      if (cancelado || !vinculos || vinculos.length === 0) { setCount(0); return }
      const ids = [...new Set(vinculos.map((v: any) => v.lead_id as string))]
      const { count: semTel } = await supabaseWpp
        .from('leads').select('id', { count: 'exact', head: true }).in('id', ids).is('whatsapp_e164', null)
      if (!cancelado) setCount(semTel ?? 0)
    }
    buscar()
    return () => { cancelado = true }
  }, [segmentoIds.join(',')])
  return count
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function preencherVariaveis(texto: string, lead: Lead | null): string {
  if (!texto) return ''
  const nome    = lead?.name ?? 'você'
  const empresa = (lead?.custom_fields as any)?.empresa ?? 'sua empresa'
  const cidade  = (lead?.custom_fields as any)?.cidade ?? 'sua cidade'
  const produto = (lead?.custom_fields as any)?.produto_interesse ?? 'nossos produtos'
  return texto
    .replace(/\{\{nome\}\}/gi,               `<b>${nome}</b>`)
    .replace(/\{\{primeiro_nome\}\}/gi,       `<b>${nome.split(' ')[0]}</b>`)
    .replace(/\{\{empresa\}\}/gi,             empresa)
    .replace(/\{\{cidade\}\}/gi,              cidade)
    .replace(/\{\{produto_interesse\}\}/gi,   produto)
    .replace(/\{\{mes_imersao\}\}/gi,         'setembro')
}

function parseTier(tier: string | undefined | null): number {
  if (!tier) return 1000
  const m = String(tier).match(/\d+/)
  return m ? parseInt(m[0]) : 1000
}

// ── Componente: Dropdown de segmentos colapsável ──────────────────────────────
function SegmentosDropdown({
  segmentos, loading, selecionados, onToggle, totalLeads,
}: {
  segmentos: any[]; loading: boolean; selecionados: string[]
  onToggle: (id: string) => void; totalLeads: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const resumo = selecionados.length === 0
    ? 'Nenhum segmento selecionado'
    : `${selecionados.length} segmento${selecionados.length > 1 ? 's' : ''} selecionado${selecionados.length > 1 ? 's' : ''}`

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Caixa colapsada */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg)', border: '1px solid var(--line)',
          borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontSize: 13.5,
        }}
      >
        <span style={{ color: selecionados.length > 0 ? 'var(--text)' : 'var(--text-3)' }}>
          {resumo}
          {selecionados.length > 0 && (
            <> · <b style={{ color: 'var(--gold)' }}>{totalLeads.toLocaleString('pt-BR')} contatos únicos</b></>
          )}
        </span>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth={2}
          style={{ transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          marginTop: 6, background: 'var(--bg)', border: '1px solid var(--line)',
          borderRadius: 10, padding: 8, maxHeight: 230, overflowY: 'auto',
          position: 'absolute', width: '100%', zIndex: 40,
          boxShadow: '0 12px 32px rgba(0,0,0,.5)',
        }}>
          {loading ? (
            <div style={{ padding: '10px 10px', fontSize: 13, color: 'var(--text-3)' }}>Carregando...</div>
          ) : segmentos.length === 0 ? (
            <div style={{ padding: '10px 10px', fontSize: 13, color: 'var(--text-3)' }}>Nenhum segmento encontrado.</div>
          ) : segmentos.map(s => {
            const checked = selecionados.includes(s.id)
            return (
              <div key={s.id} onClick={() => onToggle(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Checkbox customizado */}
                <div style={{
                  width: 16, height: 16, borderRadius: 5, flexShrink: 0,
                  border: checked ? '1.5px solid var(--red)' : '1.5px solid var(--text-3)',
                  background: checked ? 'var(--red)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {checked && <svg width={9} height={9} viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth={1.8} strokeLinecap="round"/></svg>}
                </div>
                <span style={{ flex: 1, fontWeight: 500 }}>{s.name}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                  {(s.contact_count ?? 0).toLocaleString('pt-BR')}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function CriarCampanha() {
  const { user }                                          = useAuth()
  const navigate                                          = useNavigate()
  const { segmentos, loading: loadingSegmentos }          = useSegmentos()
  const { templates, loading: loadingTemplates }          = useTemplates()
  const { data: dadosSaude }                              = useDesempenho()

  const [nome, setNome]                                   = useState('')
  const [templateId, setTemplateId]                       = useState('')
  const [segmentosSelecionados, setSegmentosSelecionados] = useState<string[]>([])
  const [mensagem, setMensagem]                           = useState('')
  const [modoDisparo, setModoDisparo]                     = useState<'now' | 'scheduled'>('scheduled')
  const [dataAgendamento, setDataAgendamento]             = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0)
    return d.toISOString().slice(0, 16)
  })
  // Teste A/B
  const [abTest, setAbTest]                               = useState(false)
  const [varianteB, setVarianteB]                         = useState('')
  const [abSplit, setAbSplit]                             = useState(50)
  const [abaAtiva, setAbaAtiva]                           = useState<'a' | 'b'>('a')

  const [salvando, setSalvando]                           = useState(false)
  const [salvandoRascunho, setSalvandoRascunho]           = useState(false)
  const [erro, setErro]                                   = useState<string | null>(null)
  const [sucesso, setSucesso]                             = useState<string | null>(null)

  // Ref para inserção de variável no cursor correto
  // focusTarget: 'a' = variante A (ou campo único), 'b' = variante B
  const msgBodyRef   = useRef<HTMLTextAreaElement>(null)
  const varBRef      = useRef<HTMLTextAreaElement>(null)
  const lastRangeRef = useRef<[number, number] | null>(null)
  const focusTarget  = useRef<'a' | 'b'>('a')

  const primeiroSegmentoId   = segmentosSelecionados[0] ?? null
  const leadPreview          = usePrimeiroLead(primeiroSegmentoId)
  const leadsSemTelefone     = useLeadsSemTelefone(segmentosSelecionados)

  function alternarSegmento(id: string) {
    setSegmentosSelecionados(atual => atual.includes(id) ? atual.filter(s => s !== id) : [...atual, id])
  }

  function inserirVariavel(v: string) {
    const isB = abTest && focusTarget.current === 'b'
    const ta  = isB ? varBRef.current : msgBodyRef.current
    const setter = isB ? setVarianteB : setMensagem
    if (!ta) { setter(m => m + v); return }
    const [s, e] = lastRangeRef.current ?? [ta.value.length, ta.value.length]
    const novo = ta.value.slice(0, s) + v + ta.value.slice(e)
    setter(novo)
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + v.length, s + v.length) }, 0)
  }

  const totalLeads      = segmentos.filter(s => segmentosSelecionados.includes(s.id)).reduce((a, s) => a + (s.contact_count ?? 0), 0)
  const templateSel     = templates.find(t => t.id === templateId) ?? null
  const templatesAprov  = templates.filter(t => ['APPROVED', 'approved', 'aprovado'].includes(t.status ?? ''))
  const templateAprovado = templateSel ? ['APPROVED', 'approved', 'aprovado'].includes(templateSel.status ?? '') : false

  const previewHtml = preencherVariaveis(
    mensagem || 'Olá {{nome}}! Vimos que você demonstrou interesse em profissionalizar sua confecção. Temos uma condição especial esta semana — posso te contar mais?',
    leadPreview
  )

  const saudeNumero = dadosSaude?.saudeNumero ?? null
  const tierMax     = parseTier(saudeNumero?.messaging_tier)
  const totalEnviar = Math.max(0, totalLeads - (leadsSemTelefone ?? 0))
  const tempoEstimado = tierMax > 0 && totalEnviar > 0
    ? totalEnviar >= tierMax
      ? `${Math.ceil(totalEnviar / tierMax * 24)} horas`
      : `${Math.ceil(totalEnviar / (tierMax / 60 / 24))} min`
    : null

  // ── Submits ──
  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setErro(null)
    if (!nome.trim())                          { setErro('Dê um nome para a campanha.'); return }
    if (!templateId)                           { setErro('Selecione um template aprovado pela Meta.'); return }
    if (segmentosSelecionados.length === 0)    { setErro('Selecione ao menos um segmento.'); return }
    if (!mensagem.trim())                      { setErro('Escreva o texto da mensagem.'); return }
    if (modoDisparo === 'scheduled' && !dataAgendamento) { setErro('Escolha uma data de agendamento.'); return }
    await salvar(modoDisparo === 'now' ? 'firing' : 'scheduled')
  }

  async function handleRascunho() {
    setErro(null)
    if (!nome.trim()) { setErro('Dê um nome para salvar o rascunho.'); return }
    setSalvandoRascunho(true)
    await salvar('draft', true)
    setSalvandoRascunho(false)
  }

  async function salvar(status: string, isRascunho = false) {
    if (!isRascunho) setSalvando(true)
    try {
      const scheduled_at = status === 'scheduled' && dataAgendamento ? new Date(dataAgendamento).toISOString() : null
      const { data: campanha, error: campanhaError } = await supabaseWpp
        .from('campaigns')
        .insert({ name: nome.trim(), template_id: templateId || null, status, scheduled_at, ab_test_enabled: abTest, created_by: user?.id ?? null })
        .select().single()
      if (campanhaError) throw campanhaError
      const campaignId = campanha.id as string

      if (segmentosSelecionados.length > 0) {
        const { error: segErr } = await supabaseWpp.from('campaign_segments')
          .insert(segmentosSelecionados.map(segment_id => ({ campaign_id: campaignId, segment_id })))
        if (segErr) throw segErr
      }

      if (mensagem.trim()) {
        const variants = [{ campaign_id: campaignId, label: 'Principal', body: mensagem.trim() }]
        if (abTest && varianteB.trim()) variants.push({ campaign_id: campaignId, label: 'Variante B', body: varianteB.trim() })
        const { error: varErr } = await supabaseWpp.from('campaign_variants').insert(variants)
        if (varErr) throw varErr
      }

      if (isRascunho) {
        setSucesso('Rascunho salvo com sucesso!')
        setTimeout(() => setSucesso(null), 3000)
      } else {
        setSucesso('Campanha criada com sucesso! Redirecionando...')
        setTimeout(() => navigate('/campanhas'), 1500)
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      if (!isRascunho) setSalvando(false)
    }
  }

  return (
    <div>
      {sucesso && (
        <div className="panel" style={{ padding: 14, marginBottom: 16, fontSize: 13, color: '#8fe0b6', borderColor: 'rgba(61,190,123,0.3)', background: 'rgba(61,190,123,0.08)' }}>
          {sucesso}
        </div>
      )}
      {erro && (
        <div className="panel" style={{ padding: 14, marginBottom: 16, fontSize: 13, color: '#f28c94', borderColor: 'rgba(232,25,44,0.3)', background: 'rgba(232,25,44,0.08)' }}>
          {erro}
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-grid">

        {/* ────────────────── Coluna esquerda ────────────────── */}
        <div>

          {/* 1 — Identificação */}
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-head">
              <div className="panel-title">1 · Identificação<span>nome interno, base e template</span></div>
            </div>

            <div className="field">
              <label>Nome da campanha</label>
              <input className="input" value={nome} onChange={e => setNome(e.target.value)}
                placeholder="Ex: Reativação Base Fria — Segredos" />
            </div>

            {/* Segmentos — dropdown colapsável */}
            <div className="field">
              <label>Base da campanha (segmentos)</label>
              <SegmentosDropdown
                segmentos={segmentos} loading={loadingSegmentos}
                selecionados={segmentosSelecionados} onToggle={alternarSegmento}
                totalLeads={totalLeads}
              />
              {segmentosSelecionados.length > 0 && (
                <div className="hint num" style={{ marginTop: 6 }}>
                  {totalLeads.toLocaleString('pt-BR')} leads · duplicados removidos automaticamente
                </div>
              )}
            </div>

            {/* Template */}
            <div className="field">
              <label>Template aprovado (Meta)</label>
              {loadingTemplates ? (
                <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Carregando templates...</p>
              ) : (
                <>
                  <select className="input" value={templateId} onChange={e => setTemplateId(e.target.value)}>
                    <option value="">Selecione um template</option>
                    {templatesAprov.map(t => (
                      <option key={t.id} value={t.id}>{t.meta_template_name} · {t.category ?? 'UTILITY'} · pt_BR</option>
                    ))}
                  </select>
                  {!loadingTemplates && templatesAprov.length === 0 && (
                    <div className="hint">Nenhum template aprovado. Sincronize em Templates.</div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 2 — Mensagem */}
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-head">
              <div className="panel-title">2 · Mensagem<span>template aprovado pela Meta</span></div>
            </div>

            {/* Banco de variáveis */}
            <div className="field">
              <label>Variáveis disponíveis</label>
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12,
                background: 'var(--bg)', border: '1px dashed var(--line)', borderRadius: 10,
              }}>
                {['{{nome}}', '{{primeiro_nome}}', '{{empresa}}', '{{cidade}}', '{{produto_interesse}}', '{{mes_imersao}}'].map(v => (
                  <span key={v} className="var-chip" onClick={() => inserirVariavel(v)}
                    style={{ cursor: 'grab' }}
                    draggable
                    onDragStart={e => e.dataTransfer.setData('text/plain', v)}
                  >
                    ⠿ {v.replace(/\{\{|\}\}/g, '')}
                  </span>
                ))}
              </div>
              <div className="hint">Clique para inserir no cursor, ou arraste até o campo de mensagem</div>
            </div>

            {/* Corpo da mensagem — campo único quando A/B desativado */}
            {!abTest && (
              <div className="field">
                <label>Corpo da mensagem</label>
                <textarea
                  ref={msgBodyRef}
                  className="input"
                  value={mensagem}
                  onChange={e => setMensagem(e.target.value)}
                  onFocus={() => { focusTarget.current = 'a' }}
                  onMouseUp={() => { const ta = msgBodyRef.current; if (ta) lastRangeRef.current = [ta.selectionStart, ta.selectionEnd] }}
                  onKeyUp={() => { const ta = msgBodyRef.current; if (ta) lastRangeRef.current = [ta.selectionStart, ta.selectionEnd] }}
                  onDragOver={e => { e.preventDefault(); (e.currentTarget as any).style.outline = '2px dashed var(--gold)' }}
                  onDragLeave={e => { (e.currentTarget as any).style.outline = '' }}
                  onDrop={e => {
                    e.preventDefault(); (e.currentTarget as any).style.outline = ''
                    const v = e.dataTransfer.getData('text/plain')
                    if (v) inserirVariavel(v)
                  }}
                  placeholder="Olá {{nome}}! Vimos que você demonstrou interesse em profissionalizar sua confecção..."
                />
              </div>
            )}

            {/* Mídia do template — só aparece quando A/B desativado */}
            {!abTest && (
              <div className="field">
                <label>Mídia do template</label>
                <div style={{ border: '1.5px dashed var(--line)', borderRadius: 10, padding: 22, textAlign: 'center', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--text-3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line)')}>
                  Arraste uma imagem ou vídeo aqui, ou{' '}
                  <b style={{ color: 'var(--gold)', fontWeight: 500 }}>selecione um arquivo</b>
                  <br />
                  <span style={{ fontSize: 11.5, marginTop: 4, display: 'block' }}>JPG, PNG ou MP4 · até 16 MB</span>
                </div>
              </div>
            )}

            {/* Teste A/B */}
            <div className="field">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: abTest ? 12 : 0 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>Teste A/B</div>
                  <div className="hint" style={{ marginTop: 2 }}>Divide a base entre duas variações de mensagem</div>
                </div>
                {/* Switch toggle */}
                <div onClick={() => setAbTest(v => !v)} style={{
                  width: 40, height: 22, borderRadius: 14, cursor: 'pointer', position: 'relative',
                  background: abTest ? 'var(--red)' : 'var(--surface-2)',
                  border: '1px solid var(--line)', transition: 'background .15s',
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 2, transition: 'left .15s',
                    left: abTest ? 20 : 2,
                  }} />
                </div>
              </div>

              {abTest && (
                <>
                  {/* Abas A / B */}
                  <div style={{ display: 'flex', gap: 0, marginBottom: 0, borderBottom: '1px solid var(--line-soft)' }}>
                    {(['a', 'b'] as ('a' | 'b')[]).map(v => (
                      <div key={v} onClick={() => { setAbaAtiva(v); focusTarget.current = v; lastRangeRef.current = null }}
                        style={{
                          padding: '7px 20px', cursor: 'pointer',
                          color: abaAtiva === v ? 'var(--gold)' : 'var(--text-3)',
                          borderBottom: abaAtiva === v ? '2px solid var(--gold)' : '2px solid transparent',
                          marginBottom: -1, textTransform: 'uppercase', letterSpacing: '.06em', fontSize: '11.5px', fontWeight: 600,
                        }}
                      >
                        Variante {v.toUpperCase()}
                      </div>
                    ))}
                  </div>

                  {/* Conteúdo da aba ativa */}
                  <div style={{ paddingTop: 14 }}>
                    {abaAtiva === 'a' ? (
                      <>
                        <div className="field">
                          <label>Texto — Variante A</label>
                          <textarea
                            ref={msgBodyRef}
                            className="input" rows={5}
                            value={mensagem}
                            onChange={e => setMensagem(e.target.value)}
                            onMouseUp={() => { const ta = msgBodyRef.current; if (ta) lastRangeRef.current = [ta.selectionStart, ta.selectionEnd] }}
                            onKeyUp={() => { const ta = msgBodyRef.current; if (ta) lastRangeRef.current = [ta.selectionStart, ta.selectionEnd] }}
                            onDragOver={e => { e.preventDefault(); (e.currentTarget as any).style.outline = '2px dashed var(--gold)' }}
                            onDragLeave={e => { (e.currentTarget as any).style.outline = '' }}
                            onDrop={e => { e.preventDefault(); (e.currentTarget as any).style.outline = ''; inserirVariavel(e.dataTransfer.getData('text/plain')) }}
                            placeholder="Texto da variante A..."
                          />
                        </div>
                        <div className="field">
                          <label>Mídia — Variante A</label>
                          <div style={{ border: '1.5px dashed var(--line)', borderRadius: 10, padding: 22, textAlign: 'center', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--text-3)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line)')}>
                            Arraste uma imagem ou vídeo aqui, ou <b style={{ color: 'var(--gold)', fontWeight: 500 }}>selecione um arquivo</b>
                            <br /><span style={{ fontSize: 11.5, marginTop: 4, display: 'block' }}>JPG, PNG ou MP4 · até 16 MB</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="field">
                          <label>Texto — Variante B</label>
                          <textarea
                            ref={varBRef}
                            className="input" rows={5}
                            value={varianteB}
                            onChange={e => setVarianteB(e.target.value)}
                            onMouseUp={() => { const ta = varBRef.current; if (ta) lastRangeRef.current = [ta.selectionStart, ta.selectionEnd] }}
                            onKeyUp={() => { const ta = varBRef.current; if (ta) lastRangeRef.current = [ta.selectionStart, ta.selectionEnd] }}
                            onDragOver={e => { e.preventDefault(); (e.currentTarget as any).style.outline = '2px dashed var(--gold)' }}
                            onDragLeave={e => { (e.currentTarget as any).style.outline = '' }}
                            onDrop={e => { e.preventDefault(); (e.currentTarget as any).style.outline = ''; inserirVariavel(e.dataTransfer.getData('text/plain')) }}
                            placeholder="Texto alternativo para a variante B..."
                          />
                        </div>
                        <div className="field">
                          <label>Mídia — Variante B</label>
                          <div style={{ border: '1.5px dashed var(--line)', borderRadius: 10, padding: 22, textAlign: 'center', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--text-3)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line)')}>
                            Arraste uma imagem ou vídeo aqui, ou <b style={{ color: 'var(--gold)', fontWeight: 500 }}>selecione um arquivo</b>
                            <br /><span style={{ fontSize: 11.5, marginTop: 4, display: 'block' }}>JPG, PNG ou MP4 · até 16 MB</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ marginBottom: 10 }}></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--text-2)' }}>
                    <span>Divisão do envio</span>
                    <input type="range" min={10} max={90} value={abSplit} onChange={e => setAbSplit(Number(e.target.value))}
                      style={{ flex: 1, accentColor: 'var(--red)' }} />
                    <span className="num" style={{ fontWeight: 600, color: 'var(--text)', minWidth: 60 }}>
                      {abSplit}% / {100 - abSplit}%
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 3 — Agendamento e ritmo de envio */}
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">3 · Agendamento e ritmo de envio<span>respeitando o tier da conta</span></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label>Modo de disparo</label>
                <select className="input" value={modoDisparo} onChange={e => setModoDisparo(e.target.value as 'now' | 'scheduled')}>
                  <option value="scheduled">Agendado</option>
                  <option value="now">Manual (disparar agora)</option>
                </select>
              </div>
              {modoDisparo === 'scheduled' && (
                <div className="field">
                  <label>Data e hora</label>
                  <input type="datetime-local" className="input" value={dataAgendamento}
                    onChange={e => setDataAgendamento(e.target.value)} />
                </div>
              )}
            </div>

            {/* Nota de ritmo */}
            {saudeNumero && (
              <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 14, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--line-soft)' }}>
                Tier atual permite até{' '}
                <b style={{ color: 'var(--gold)' }}>{tierMax.toLocaleString('pt-BR')} contatos únicos / 24h</b>.
                {totalEnviar > 0 && tempoEstimado && (
                  <> Nessa velocidade, o disparo completo dessa base leva aproximadamente{' '}
                    <b style={{ color: 'var(--gold)' }}>{tempoEstimado}</b>.
                  </>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn" disabled={salvandoRascunho} onClick={handleRascunho}>
                {salvandoRascunho ? 'Salvando...' : 'Salvar rascunho'}
              </button>
              <button type="submit" className="btn primary" disabled={salvando}>
                {salvando ? 'Criando...' : 'Colocar na fila'}
              </button>
            </div>
          </div>

        </div>

        {/* ────────────────── Coluna direita ────────────────── */}
        <div>

          {/* Preview */}
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-head">
              <div className="panel-title">Pré-visualização<span>como o lead vai ver no WhatsApp</span></div>
            </div>
            <div className="preview-phone">
              <div className="bubble">
                <span dangerouslySetInnerHTML={{ __html: previewHtml }} />
                <small>09:00 ✓✓</small>
              </div>
            </div>
            <div className="hint" style={{ marginTop: 8 }}>
              {leadPreview
                ? `Variáveis preenchidas com dados de ${leadPreview.name ?? 'lead do segmento'}.`
                : segmentosSelecionados.length > 0
                  ? 'Buscando primeiro lead do segmento...'
                  : 'Selecione um segmento para pré-visualizar com dados reais.'}
            </div>
          </div>

          {/* Saúde do número */}
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-head">
              <div className="panel-title">Saúde do número</div>
            </div>
            <div className="health-row">
              <span>Qualidade (Meta)</span>
              {saudeNumero ? (
                <span className={`status-txt ${saudeNumero.quality_rating === 'HIGH' || saudeNumero.quality_rating === 'Alta' ? 'st-ok' : 'st-warn'}`}>
                  {saudeNumero.quality_rating}
                </span>
              ) : (
                <span className="status-txt st-neutral">—</span>
              )}
            </div>
            <div className="health-row">
              <span>Tier de envio</span>
              <span className="num" style={{ color: 'var(--text-2)', fontSize: 13, fontWeight: 600 }}>
                {saudeNumero?.messaging_tier ?? '—'}
              </span>
            </div>
            <div className="health-row">
              <span>Leads sem telefone válido</span>
              {leadsSemTelefone === null ? (
                <span className="status-txt st-neutral">{segmentosSelecionados.length > 0 ? 'Verificando...' : '—'}</span>
              ) : leadsSemTelefone === 0 ? (
                <span className="status-txt st-ok">Nenhum</span>
              ) : (
                <span className="status-txt st-warn num">{leadsSemTelefone} ignorados</span>
              )}
            </div>
            <div className="health-row">
              <span>Total a enviar</span>
              <span className="num" style={{ fontWeight: 600, fontSize: 13 }}>
                {segmentosSelecionados.length > 0 ? totalEnviar.toLocaleString('pt-BR') : '—'}
              </span>
            </div>
          </div>

          {/* Status na Meta */}
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Status na Meta<span>verificações antes do disparo</span></div>
            </div>

            {[
              {
                label: 'Template aprovado',
                ok: templateAprovado,
                pendente: !templateId,
              },
              {
                label: 'Segmento selecionado',
                ok: segmentosSelecionados.length > 0,
                pendente: segmentosSelecionados.length === 0,
              },
              {
                label: 'Mensagem preenchida',
                ok: mensagem.trim().length > 0,
                pendente: mensagem.trim().length === 0,
              },
              {
                label: 'Agendamento definido',
                ok: modoDisparo === 'now' || !!dataAgendamento,
                pendente: modoDisparo === 'scheduled' && !dataAgendamento,
              },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--line-soft)' }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0,
                  background: item.pendente ? 'var(--hover)' : item.ok ? 'var(--good-bg)' : 'var(--danger-bg)',
                  color: item.pendente ? 'var(--text-3)' : item.ok ? 'var(--green)' : 'var(--danger)',
                }}>
                  {item.pendente ? <Icon name="dot" size={10}/> : item.ok ? <Icon name="check" size={11}/> : <Icon name="x" size={11}/>}
                </div>
                <span style={{ color: item.pendente ? 'var(--text-3)' : 'var(--text)' }}>{item.label}</span>
              </div>
            ))}
          </div>

        </div>
      </form>
    </div>
  )
}
