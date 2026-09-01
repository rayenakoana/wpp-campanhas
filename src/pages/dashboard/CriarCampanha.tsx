import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useSegmentos } from '../../hooks/useSegmentos'
import { useTemplates } from '../../hooks/useTemplates'
import { supabaseWpp } from '../../lib/supabase'

export default function CriarCampanha() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { segmentos, loading: loadingSegmentos } = useSegmentos()
  const { templates, loading: loadingTemplates } = useTemplates()

  const [nome, setNome] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [segmentosSelecionados, setSegmentosSelecionados] = useState<string[]>([])
  const [mensagem, setMensagem] = useState('')
  const [modoDisparo, setModoDisparo] = useState<'now' | 'scheduled'>('scheduled')
  const [dataAgendamento, setDataAgendamento] = useState('2026-08-29T09:00')
  const [abTest, setAbTest] = useState(false)

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)

  function alternarSegmento(id: string) {
    setSegmentosSelecionados((atual) =>
      atual.includes(id) ? atual.filter((s) => s !== id) : [...atual, id]
    )
  }

  const totalLeads = segmentos
    .filter((s) => segmentosSelecionados.includes(s.id))
    .reduce((acc, s) => acc + (s.contact_count ?? 0), 0)

  const templateSelecionado = templates.find((t) => t.id === templateId) ?? null
  const templatesAprovados = templates.filter((t) => t.status === 'APPROVED' || t.status === 'approved' || t.status === 'aprovado')

  const previewTexto = mensagem
    ? mensagem.replace(/\{\{nome\}\}/gi, 'Rayena').replace(/\{\{empresa\}\}/gi, 'CS').replace(/\{\{cidade\}\}/gi, 'SP')
    : 'Olá <b>Rayena</b>! Vimos que você demonstrou interesse em profissionalizar sua confecção. Temos uma condição especial esta semana — posso te contar mais?'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!nome.trim()) { setErro('Dê um nome para a campanha.'); return }
    if (!templateId) { setErro('Selecione um template aprovado pela Meta.'); return }
    if (segmentosSelecionados.length === 0) { setErro('Selecione ao menos um segmento de destino.'); return }
    if (!mensagem.trim()) { setErro('Escreva o texto da mensagem.'); return }
    if (modoDisparo === 'scheduled' && !dataAgendamento) { setErro('Escolha uma data de agendamento.'); return }

    setSalvando(true)
    try {
      const status = modoDisparo === 'now' ? 'firing' : 'scheduled'
      const scheduled_at = modoDisparo === 'now' ? null : new Date(dataAgendamento).toISOString()

      const { data: campanha, error: campanhaError } = await supabaseWpp
        .from('campaigns')
        .insert({ name: nome.trim(), template_id: templateId, status, scheduled_at, ab_test_enabled: abTest, created_by: user?.id ?? null })
        .select()
        .single()

      if (campanhaError) throw campanhaError

      const campaignId = campanha.id as string

      const { error: segmentosError } = await supabaseWpp
        .from('campaign_segments')
        .insert(segmentosSelecionados.map((segment_id) => ({ campaign_id: campaignId, segment_id })))
      if (segmentosError) throw segmentosError

      const { error: variantError } = await supabaseWpp
        .from('campaign_variants')
        .insert({ campaign_id: campaignId, label: 'Principal', body: mensagem.trim() })
      if (variantError) throw variantError

      setSucesso(true)
      setTimeout(() => navigate('/campanhas'), 1500)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar a campanha.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div>
      {sucesso && (
        <div className="panel" style={{ padding: 16, marginBottom: 16, fontSize: 13, color: '#8fe0b6', borderColor: 'rgba(61,190,123,0.3)', background: 'rgba(61,190,123,0.1)' }}>
          Campanha criada com sucesso! Redirecionando...
        </div>
      )}
      {erro && (
        <div className="panel" style={{ padding: 16, marginBottom: 16, fontSize: 13, color: '#f28c94', borderColor: 'rgba(232,25,44,0.3)', background: 'rgba(232,25,44,0.1)' }}>
          {erro}
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-grid">
        {/* Coluna esquerda */}
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
                  <span key={v} className="var-chip" onClick={() => setMensagem((m) => m + v)}>{v}</span>
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
              <button type="button" className="btn">Salvar rascunho</button>
              <button type="submit" className="btn primary" disabled={salvando}>
                {salvando ? 'Criando...' : 'Colocar na fila'}
              </button>
            </div>
          </div>
        </div>

        {/* Coluna direita */}
        <div>
          {/* Preview */}
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-head">
              <div className="panel-title">Preview</div>
            </div>
            <div className="preview-phone">
              <div className="bubble">
                <span dangerouslySetInnerHTML={{ __html: previewTexto }} />
                <small>09:00 ✓✓</small>
              </div>
            </div>
            <div className="hint">Variáveis preenchidas com o primeiro lead do segmento.</div>
          </div>

          {/* Verificações */}
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Verificações</div>
            </div>
            <div className="health-row">
              <span>Template aprovado</span>
              <span className={`status-txt ${templateSelecionado ? 'st-ok' : 'st-neutral'}`}>
                {templateSelecionado ? 'Sim' : '—'}
              </span>
            </div>
            <div className="health-row">
              <span>Qualidade do número</span>
              <span className="status-txt st-ok">Alta</span>
            </div>
            <div className="health-row">
              <span>Tier disponível hoje</span>
              <span className="num" style={{ color: 'var(--text-2)' }}>8.796</span>
            </div>
            <div className="health-row">
              <span>Leads sem telefone válido</span>
              <span className="status-txt st-warn num">23 ignorados</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
