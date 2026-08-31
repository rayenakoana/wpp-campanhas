import { useIntegracoes } from '../../hooks/useIntegracoes'

function formatarData(iso: string | null): string {
  if (!iso) return 'Nunca sincronizado'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Integracoes() {
  const { data, loading, error } = useIntegracoes()

  return (
    <div>
      <h1 className="font-display font-semibold text-2xl mb-1">Integrações</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">
        Status das integrações com Meta, RD Station e Supabase.
      </p>

      {loading && (
        <div className="glass-card p-6 text-sm text-[var(--color-text-muted)]">Carregando...</div>
      )}

      {error && (
        <div className="glass-card p-6 text-sm text-[#f28c94] border-[rgba(232,25,44,0.3)]">
          Não foi possível carregar dados de integração: {error}
        </div>
      )}

      {!loading && !error && data && (
        <div className="flex flex-col gap-5">
          {/* WhatsApp Cloud API / Meta */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg">WhatsApp Cloud API</h2>
              {data.saudeNumero ? (
                <span className="text-xs px-2 py-1 rounded-md font-medium bg-[rgba(61,190,123,0.15)] text-[#3DBE7B]">
                  Monitorado
                </span>
              ) : (
                <span className="text-xs px-2 py-1 rounded-md font-medium bg-white/10 text-[var(--color-text-muted)]">
                  Sem dados
                </span>
              )}
            </div>

            {data.saudeNumero ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">Qualidade do número</p>
                  <p className="font-medium">{data.saudeNumero.quality_rating}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">Tier de mensagens</p>
                  <p className="font-medium">{data.saudeNumero.messaging_tier}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Última verificação: {formatarData(data.saudeNumero.captured_at)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">
                Nenhum snapshot de saúde do número registrado ainda.
              </p>
            )}
          </div>

          {/* Templates sincronizados */}
          <div className="glass-card p-5">
            <h2 className="font-display font-semibold text-lg mb-4">Templates de mensagem (Meta)</h2>
            {data.templates.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">Nenhum template sincronizado ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[var(--color-text-muted)] text-xs border-b border-white/5">
                      <th className="px-3 py-2 font-medium">Template</th>
                      <th className="px-3 py-2 font-medium">Categoria</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Sincronizado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.templates.map((t) => (
                      <tr key={t.id} className="border-b border-white/5 last:border-0">
                        <td className="px-3 py-2 font-medium">{t.meta_template_name}</td>
                        <td className="px-3 py-2 text-[var(--color-text-muted)]">{t.category ?? '—'}</td>
                        <td className="px-3 py-2 text-[var(--color-text-muted)]">{t.status}</td>
                        <td className="px-3 py-2 text-[var(--color-text-muted)]">{formatarData(t.synced_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RD Station e Supabase - status estatico, gerenciados via N8N */}
          <div className="glass-card p-5">
            <h2 className="font-display font-semibold text-lg mb-4">RD Station e Supabase</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              A sincronização de leads e segmentos com o RD Station CRM/Marketing é feita pelos workflows N8N em
              produção. O status detalhado dessas automações pode ser consultado diretamente no painel do N8N.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
