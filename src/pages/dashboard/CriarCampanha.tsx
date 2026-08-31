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
  const [enviarAgora, setEnviarAgora] = useState(true)
  const [dataAgendamento, setDataAgendamento] = useState('')

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)

  function alternarSegmento(id: string) {
    setSegmentosSelecionados((atual) =>
      atual.includes(id) ? atual.filter((s) => s !== id) : [...atual, id]
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!nome.trim()) {
      setErro('Dê um nome para a campanha.')
      return
    }
    if (!templateId) {
      setErro('Selecione um template aprovado pela Meta.')
      return
    }
    if (segmentosSelecionados.length === 0) {
      setErro('Selecione ao menos um segmento de destino.')
      return
    }
    if (!mensagem.trim()) {
      setErro('Escreva o texto da mensagem.')
      return
    }
    if (!enviarAgora && !dataAgendamento) {
      setErro('Escolha uma data de agendamento ou marque "Enviar agora".')
      return
    }

    setSalvando(true)

    try {
      const status = enviarAgora ? 'firing' : 'scheduled'
      const scheduled_at = enviarAgora ? null : new Date(dataAgendamento).toISOString()

      const { data: campanha, error: campanhaError } = await supabaseWpp
        .from('campaigns')
        .insert({
          name: nome.trim(),
          template_id: templateId,
          status,
          scheduled_at,
          ab_test_enabled: false,
          created_by: user?.id ?? null,
        })
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

  const templatesAprovados = templates.filter((t) => t.status === 'APPROVED' || t.status === 'aprovado')

  return (
    <div className="max-w-2xl">
      <h1 className="font-display font-semibold text-2xl mb-1">Criar campanha</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">
        Fluxo de criação de uma nova campanha de WhatsApp.
      </p>

      {sucesso && (
        <div className="glass-card p-4 mb-5 text-sm text-[#8fe0b6] bg-[rgba(61,190,123,0.1)] border-[rgba(61,190,123,0.3)]">
          Campanha criada com sucesso! Redirecionando para a lista de campanhas...
        </div>
      )}

      {erro && (
        <div className="glass-card p-4 mb-5 text-sm text-[#f28c94] bg-[rgba(232,25,44,0.1)] border-[rgba(232,25,44,0.3)]">
          {erro}
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-card p-6 flex flex-col gap-5">
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 font-medium">
            Nome da campanha
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Reativação Segredos da Confecção - Setembro"
            className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-white/5 border border-white/10 outline-none focus:border-[var(--color-red-bright)]"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 font-medium">
            Template aprovado (Meta)
          </label>
          {loadingTemplates ? (
            <p className="text-sm text-[var(--color-text-muted)]">Carregando templates...</p>
          ) : (
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-white/5 border border-white/10 outline-none focus:border-[var(--color-red-bright)]"
            >
              <option value="">Selecione um template</option>
              {templatesAprovados.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.meta_template_name} {t.category ? `(${t.category})` : ''}
                </option>
              ))}
            </select>
          )}
          {!loadingTemplates && templatesAprovados.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Nenhum template aprovado encontrado. Sincronize os templates com a Meta antes de criar uma campanha.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 font-medium">
            Segmentos de destino
          </label>
          {loadingSegmentos ? (
            <p className="text-sm text-[var(--color-text-muted)]">Carregando segmentos...</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto border border-white/10 rounded-lg p-3">
              {segmentos.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={segmentosSelecionados.includes(s.id)}
                    onChange={() => alternarSegmento(s.id)}
                    className="accent-[var(--color-red-bright)]"
                  />
                  {s.name}
                  <span className="text-xs text-[var(--color-text-muted)]">
                    ({s.contact_count ?? 0} contatos)
                  </span>
                </label>
              ))}
              {segmentos.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)]">Nenhum segmento disponível.</p>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 font-medium">
            Texto da mensagem
          </label>
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={4}
            placeholder="Escreva a mensagem que será enviada aos leads deste segmento..."
            className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-white/5 border border-white/10 outline-none focus:border-[var(--color-red-bright)] resize-none"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enviarAgora}
              onChange={(e) => setEnviarAgora(e.target.checked)}
              className="accent-[var(--color-red-bright)]"
            />
            Enviar agora
          </label>

          {!enviarAgora && (
            <input
              type="datetime-local"
              value={dataAgendamento}
              onChange={(e) => setDataAgendamento(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-white/5 border border-white/10 outline-none focus:border-[var(--color-red-bright)]"
            />
          )}
        </div>

        <button
          type="submit"
          disabled={salvando}
          className="py-3 rounded-lg font-semibold text-sm text-white bg-gradient-to-br from-[var(--color-red-bright)] to-[var(--color-red-deep)] disabled:opacity-60"
        >
          {salvando ? 'Criando...' : enviarAgora ? 'Criar e enviar agora' : 'Agendar campanha'}
        </button>
      </form>
    </div>
  )
}
