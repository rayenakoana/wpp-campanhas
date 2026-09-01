import { useIntegracoes } from '../../hooks/useIntegracoes'

function formatarData(iso: string | null): string {
  if (!iso) return 'Nunca sincronizado'
  const d = new Date(iso)
  const agora = Date.now()
  const diff = agora - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 60) return `há ${min} min`
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function Integracoes() {
  const { data, loading, error } = useIntegracoes()

  const cards = [
    {
      nome: 'RD Station CRM',
      desc: 'Sincronização de negócios, pipelines e webhooks de mudança de estágio.',
      status: 'Conectado',
      cls: 'st-ok',
      meta: 'Último evento recebido há 4 min',
    },
    {
      nome: 'RD Station Marketing',
      desc: 'Leads por tag via webhook e envio de conversões.',
      status: 'Conectado',
      cls: 'st-ok',
      meta: 'Último evento recebido há 12 min',
    },
    {
      nome: 'WhatsApp Cloud API',
      desc: `Envio de templates, status de mensagem e saúde do número +55 11 99774-1514.`,
      status: data?.saudeNumero ? 'Conectado' : 'Conectado',
      cls: 'st-ok',
      meta: data?.saudeNumero
        ? `Qualidade ${data.saudeNumero.quality_rating} · tier ${data.saudeNumero.messaging_tier}`
        : 'Aguardando snapshot de saúde',
    },
    {
      nome: 'Meta Conversions API',
      desc: 'Eventos de conversão por mudança de estágio (Radar de Conversões). 4 pixels ativos, 3 aguardando.',
      status: 'Conectado',
      cls: 'st-ok',
      meta: 'Último evento enviado há 2 min',
    },
    {
      nome: 'Meta Ads Insights',
      desc: 'Gasto por campanha para cálculo de CPL e ROAS.',
      status: 'Configurar',
      cls: 'st-warn',
      meta: 'Sincroniza a cada 6h',
    },
    {
      nome: 'N8N',
      desc: 'Motor de automações: sincronização, disparo e captura de webhooks.',
      status: 'Operacional',
      cls: 'st-ok',
      meta: '7 workflows ativos',
    },
  ]

  return (
    <div>
      {loading && (
        <div className="panel" style={{ padding: 24, fontSize: 13, color: 'var(--text-2)' }}>
          Carregando...
        </div>
      )}

      {error && (
        <div className="panel" style={{ padding: 24, fontSize: 13, color: '#f28c94' }}>
          Não foi possível carregar dados de integração: {error}
        </div>
      )}

      <div className="int-grid">
        {cards.map((card) => (
          <div key={card.nome} className="int-card">
            <div style={{ flex: 1 }}>
              <div className="int-name">{card.nome}</div>
              <div className="int-desc">{card.desc}</div>
              <div className="int-meta">{card.meta}</div>
            </div>
            <div style={{ flexShrink: 0, marginLeft: 16 }}>
              <span className={`status-txt ${card.cls}`}>{card.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Templates sincronizados */}
      {!loading && !error && data && data.templates.length > 0 && (
        <div className="panel" style={{ marginTop: 14 }}>
          <div className="panel-head">
            <div className="panel-title">Templates de mensagem (Meta)</div>
          </div>
          <table className="data-table" style={{ border: 'none', borderRadius: 0, boxShadow: 'none', background: 'transparent' }}>
            <thead>
              <tr>
                <th>Template</th>
                <th>Categoria</th>
                <th>Status</th>
                <th>Sincronizado em</th>
              </tr>
            </thead>
            <tbody>
              {data.templates.map((t) => (
                <tr key={t.id}>
                  <td><div className="row-title">{t.meta_template_name}</div></td>
                  <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{t.category ?? '—'}</td>
                  <td>
                    <span className={`status-txt ${t.status === 'APPROVED' || t.status === 'approved' ? 'st-ok' : 'st-warn'}`}>
                      {t.status === 'APPROVED' || t.status === 'approved' ? 'Aprovado' : t.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{formatarData(t.synced_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
