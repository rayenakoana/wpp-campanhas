import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useSegmentos } from '../../hooks/useSegmentos'
import { useTemplates } from '../../hooks/useTemplates'
import { useDesempenho } from '../../hooks/useDesempenho'
import { supabaseWpp } from '../../lib/supabase'
import type { Lead } from '../../types/wpp'

// ── Hook: primeiro lead do segmento selecionado (para preview) ──────────────
function usePrimeiroLead(segmentoId: string | null) {
  const [lead, setLead] = useState<Lead | null>(null)

  useEffect(() => {
    if (!segmentoId) { setLead(null); return }
    let cancelado = false

    async function buscar() {
      const { data: vinculos } = await supabaseWpp
        .from('segment_leads')
        .select('lead_id')
        .eq('segment_id', segmentoId)
        .limit(1)

      if (cancelado || !vinculos || vinculos.length === 0) { setLead(null); return }

      const { data: leads } = await supabaseWpp
        .from('leads')
        .select('*')
        .eq('id', vinculos[0].lead_id)
        .limit(1)

      if (!cancelado) setLead((leads?.[0] as Lead) ?? null)
    }

    buscar()
    return () => { cancelado = true }
  }, [segmentoId])

  return lead
}

// ── Hook: contagem de leads sem telefone nos segmentos selecionados ──────────
function useLeadsSemTelefone(segmentoIds: string[]) {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    if (segmentoIds.length === 0) { setCount(null); return }
    let cancelado = false

    async function buscar() {
      // Busca todos os lead_ids dos segmentos selecionados
      const { data: vinculos } = await supabaseWpp
        .from('segment_leads')
        .select('lead_id')
        .in('segment_id', segmentoIds)

      if (cancelado || !vinculos || vinculos.length === 0) { setCount(0); return }

      const ids = [...new Set(vinculos.map((v: any) => v.lead_id as string))]

      // Conta quantos não têm whatsapp_e164
      const { count: semTel } = await supabaseWpp
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .in('id', ids)
        .is('whatsapp_e164', null)

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
  const nome = lead?.name ?? 'você'
  const empresa = (lead?.custom_fields as any)?.empresa ?? 'sua empresa'
  const cidade = (lead?.custom_fields as any)?.cidade ?? 'sua cidade'
  const produto = (lead?.custom_fields as any)?.produto_interesse ?? 'nossos produtos'

  return texto
    .replace(/\{\{nome\}\}/gi, `<b>${nome}</b>`)
    .replace(/\{\{empresa\}\}/gi, empresa)
    .replace(/\{\{cidade\}\}/gi, cidade)
    .replace(/\{\{produto_interesse\}\}/gi, produto)
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function CriarCampanha() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { segmentos, loading: loadingSegmentos } = useSegmentos()
  const { templates, loading: loadingTemplates } = useTemplates()
  const { data: dadosSaude } = useDesempenho()

  const [nome, setNome] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [segmentosSelecionados, setSegmentosSelecionados] = useState<string[]>([])
  const [mensagem, setMensagem] = useState('')
  const [modoDisparo, setModoDisparo] = useState<'now' | 'scheduled'>('scheduled')
  const [dataAgendamento, setDataAgendamento] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    return d.toISOString().slice(0, 16)
  })
  const [abTest, setAbTest] = useState(false)

  const [salvando, setSalvando] = useState(false)
  const [salvandoRascunho, setSalvandoRascunho] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  // Preview — usa o primeiro segmento selecionado
  const primeiroSegmentoId = segmentosSelecionados[0] ?? null
  const leadPreview = usePrimeiroLead(primeiroSegmentoId)
  const leadsSemTelefone = useLeadsSemTelefone(segmentosSelecionados)

  function alternarSegmento(id: string) {
    setSegmentosSelecionados((atual) =>
      atual.includes(id) ? atual.filter((s) => s !== id) : [...atual, id]
    )
  }

  function inserirVariavel(v: string) {
    setMensagem((m) => m + v)
  }

  const totalLeads = segmentos
    .filter((s) => segmentosSelecionados.includes(s.id))
    .reduce((acc, s) => acc + (s.contact_count ?? 0), 0)

  const templateSelecionado = templates.find((t) => t.id === templateId) ?? null
  const templatesAprovados = templates.filter(
    (t) => t.status === 'APPROVED' || t.status === 'approved' || t.status === 'aprovado'
  )
  const templateAprovado = templateSelecionado
    ? (templateSelecionado.status === 'APPROVED' || templateSelecionado.status === 'approved' || templateSelecionado.status === 'aprovado')
    : false

  const previewHtml = mensagem
    ? preencherVariaveis(mensagem, leadPreview)
    : preencherVariaveis(
        'Olá {{nome}}! Vimos que você demonstrou interesse em profissionalizar sua confecção. Temos uma condição especial esta semana — posso te contar mais?',
        leadPreview
      )

  // Tier disponível: messaging_tier ex: "1000" ou "TIER_1" etc
  const saudeNumero = dadosSaude?.saudeNumero ?? null

  // ── Salvar na fila ──
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!nome.trim()) { setErro('Dê um nome para a campanha.'); return }
    if (!templateId) { setErro('Selecione um template aprovado pela Meta.'); return }
    if (segmentosSelecionados.length === 0) { setErro('Selecione ao menos um segmento de destino.'); return }
    if (!mensagem.trim()) { setErro('Escreva o texto da mensagem.'); return }
    if (modoDisparo === 'scheduled' && !dataAgendamento) { setErro('Escolha uma data de agendamento.'); return }

    await salvar(modoDisparo === 'now' ? 'firing' : 'scheduled')
  }

  // ── Salvar rascunho ──
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
      const scheduled_at =
        status === 'scheduled' && dataAgendamento
          ? new Date(dataAgendamento).toISOString()
          : null

      const { data: campanha, error: campanhaError } = await supabaseWpp
        .from('campaigns')
        .insert({
          name: nome.trim(),
          template_id: templateId || null,
          status,
          scheduled_at,
          ab_test_enabled: abTest,
          created_by: user?.id ?? null,
        })
        .select()
        .single()

      if (campanhaError) throw campanhaError
      const campaignId = campanha.id as string

      if (segmentosSelecionados.length > 0) {
        const { error: segErr } = await supabaseWpp
          .from('campaign_segments')
          .insert(segmentosSelecionados.map((segment_id) => ({ campaign_id: campaignId, segment_id })))
        if (segErr) throw segErr
      }

      if (mensagem.trim()) {
        const { error: varErr } = await supabaseWpp
          .from('campaign_variants')
          .insert({ campaign_id: campaignId, label: 'Principal', body: mensagem.trim() })
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
        <div className="panel" style={{ padding: 16, marginBottom: 16, fontSize: 13, color: '#8fe0b6', borderColor: 'rgba(61,190,123,0.3)', background: 'rgba(61,190,123,0.1)' }}>
          {sucesso}
        </div>
      )}
      {erro && (
        <div className="panel" style={{ padding: 16, marginBottom: 16, fontSize: 13, color: '#f28c94', borderColor: 'rgba(232,25,44,0.3)', background: 'rgba(232,25,44,0.1)' }}>
          {erro}
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-grid">
        {/* ── Coluna esquerda ── */}
        <div>
          {/* 1 — Identificação */}
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-head">
              <div className="panel-title">1 · Identificação</div>
            </div>

            <div className="field">
              <label>Nome da campanha</label>
              <input
                className="input"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Reativação Base Fria — Segredos"
              />
            </div>

            <div className="field">
              <label>Segmentos</label>
              {loadingSegmentos ? (
                <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Carregando segmentos...</p>
              ) : (
                <>
                  {segmentos.map((s) => (
                    <div key={s.id} className="seg-option" onClick={() => alternarSegmento(s.id)}>
                      <input
                        type="checkbox"
                        checked={segmentosSelecionados.includes(s.id)}
                        onChange={() => alternarSegmento(s.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {s.name}
                      <span className="cnt num">{(s.contact_count ?? 0).toLocaleString('pt-BR')} leads</span>
                    </div>
                  ))}
                  {segmentosSelecionados.length > 0 && (
                    <div className="hint num">
                      {totalLeads.toLocaleString('pt-BR')} leads selecionados · duplicados removidos automaticamente
                    </div>
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

            <div className="field">
              <label>Template</label>
              {loadingTemplates ? (
                <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Carregando templates...</p>
              ) : (
                <>
                  <select className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                    <option value="">Selecione um template</option>
                    {templatesAprovados.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.meta_template_name} · {t.category ?? 'UTILITY'} · pt_BR
                      </option>
                    ))}
                  </select>
                  {!loadingTemplates && templatesAprovados.length === 0 && (
                    <div className="hint">Nenhum template aprovado encontrado. Sincronize os templates com a Meta.</div>
                  )}
                </>
              )}
            </div>

            <div className="field">
              <label>Corpo da mensagem</label>
              <textarea
                className="input"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Olá {{nome}}! Vimos que você demonstrou interesse em profissionalizar sua confecção..."
              />
              <div className="var-chips">
                {['{{nome}}', '{{empresa}}', '{{cidade}}', '{{produto_interesse}}'].map((v) => (
                  <span key={v} className="var-chip" onClick={() => inserirVariavel(v)}>{v}</span>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Teste A/B</label>
              <div className="seg-option" onClick={() => setAbTest((v) => !v)}>
                <input type="checkbox" checked={abTest} onChange={() => setAbTest((v) => !v)} onClick={(e) => e.stopPropagation()} />
                Ativar variante B
                {abTest && <span className="cnt">50% / 50%</span>}
              </div>
            </div>
          </div>

          {/* 3 — Agendamento */}
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">3 · Agendamento</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label>Modo de disparo</label>
                <select
                  className="input"
                  value={modoDisparo}
                  onChange={(e) => setModoDisparo(e.target.value as 'now' | 'scheduled')}
                >
                  <option value="scheduled">Agendado</option>
                  <option value="now">Manual (disparar agora)</option>
                </select>
              </div>
              {modoDisparo === 'scheduled' && (
                <div className="field">
                  <label>Data e hora</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={dataAgendamento}
                    onChange={(e) => setDataAgendamento(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
              <button
                type="button"
                className="btn"
                disabled={salvandoRascunho}
                onClick={handleRascunho}
              >
                {salvandoRascunho ? 'Salvando...' : 'Salvar rascunho'}
              </button>
              <button type="submit" className="btn primary" disabled={salvando}>
                {salvando ? 'Criando...' : 'Colocar na fila'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Coluna direita ── */}
        <div>
          {/* Preview */}
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-head">
              <div className="panel-title">Preview</div>
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

          {/* Verificações */}
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Verificações</div>
            </div>

            <div className="health-row">
              <span>Template aprovado</span>
              {!templateId ? (
                <span className="status-txt st-neutral">—</span>
              ) : templateAprovado ? (
                <span className="status-txt st-ok">Sim</span>
              ) : (
                <span className="status-txt st-fail">Não aprovado</span>
              )}
            </div>

            <div className="health-row">
              <span>Qualidade do número</span>
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
              <span className="num" style={{ color: 'var(--text-2)', fontSize: 13 }}>
                {saudeNumero?.messaging_tier ?? '—'}
              </span>
            </div>

            <div className="health-row">
              <span>Leads sem telefone válido</span>
              {leadsSemTelefone === null ? (
                <span className="status-txt st-neutral">
                  {segmentosSelecionados.length > 0 ? 'Verificando...' : '—'}
                </span>
              ) : leadsSemTelefone === 0 ? (
                <span className="status-txt st-ok">Nenhum</span>
              ) : (
                <span className="status-txt st-warn num">{leadsSemTelefone} ignorados</span>
              )}
            </div>

            <div className="health-row">
              <span>Total a enviar</span>
              <span className="num" style={{ fontWeight: 600, fontSize: 13 }}>
                {segmentosSelecionados.length > 0
                  ? (totalLeads - (leadsSemTelefone ?? 0)).toLocaleString('pt-BR')
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
