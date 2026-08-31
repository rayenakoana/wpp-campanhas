import { useState } from 'react'
import { useSegmentos } from '../../hooks/useSegmentos'
import { useLeadsDoSegmento } from '../../hooks/useLeadsDoSegmento'

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function Segmentos() {
  const { segmentos, loading, error } = useSegmentos()
  const [segmentoSelecionado, setSegmentoSelecionado] = useState<string | null>(null)
  const { leads, loading: loadingLeads, error: errorLeads } = useLeadsDoSegmento(segmentoSelecionado)

  const segmento = segmentos.find((s) => s.id === segmentoSelecionado) ?? null

  return (
    <div>
      <h1 className="font-display font-semibold text-2xl mb-1">Segmentos e leads</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">
        Segmentos de leads e listas usadas para disparo de campanhas.
      </p>

      {loading && (
        <div className="glass-card p-6 text-sm text-[var(--color-text-muted)]">Carregando segmentos...</div>
      )}

      {error && (
        <div className="glass-card p-6 text-sm text-[#f28c94] border-[rgba(232,25,44,0.3)]">
          Não foi possível carregar os segmentos: {error}
        </div>
      )}

      {!loading && !error && segmentos.length === 0 && (
        <div className="glass-card p-6 text-sm text-[var(--color-text-muted)]">
          Nenhum segmento criado ainda.
        </div>
      )}

      {!loading && !error && segmentos.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
          {/* Lista de segmentos */}
          <div className="glass-card divide-y divide-white/5 overflow-hidden">
            {segmentos.map((s) => (
              <button
                key={s.id}
                onClick={() => setSegmentoSelecionado(s.id)}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  segmentoSelecionado === s.id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{s.name}</span>
                  {s.is_dynamic && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(201,160,23,0.15)] text-[var(--color-gold)]">
                      Dinâmico
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                  <span>{s.source ?? 'Origem não informada'}</span>
                  <span>{s.contact_count ?? 0} contatos</span>
                </div>
              </button>
            ))}
          </div>

          {/* Leads do segmento selecionado */}
          <div className="glass-card p-5">
            {!segmento && (
              <p className="text-sm text-[var(--color-text-muted)]">
                Selecione um segmento à esquerda para ver os leads.
              </p>
            )}

            {segmento && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-display font-semibold text-lg">{segmento.name}</h2>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Última sincronização: {formatarData(segmento.last_synced_at)}
                    </p>
                  </div>
                </div>

                {loadingLeads && (
                  <p className="text-sm text-[var(--color-text-muted)]">Carregando leads...</p>
                )}

                {errorLeads && (
                  <p className="text-sm text-[#f28c94]">Erro ao carregar leads: {errorLeads}</p>
                )}

                {!loadingLeads && !errorLeads && leads.length === 0 && (
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Nenhum lead vinculado a este segmento.
                  </p>
                )}

                {!loadingLeads && !errorLeads && leads.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[var(--color-text-muted)] text-xs border-b border-white/5">
                          <th className="px-3 py-2 font-medium">Nome</th>
                          <th className="px-3 py-2 font-medium">WhatsApp</th>
                          <th className="px-3 py-2 font-medium">E-mail</th>
                          <th className="px-3 py-2 font-medium">Origem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leads.map((lead) => (
                          <tr key={lead.id} className="border-b border-white/5 last:border-0">
                            <td className="px-3 py-2 font-medium">{lead.name ?? '—'}</td>
                            <td className="px-3 py-2 text-[var(--color-text-muted)]">
                              {lead.whatsapp_e164 ?? '—'}
                            </td>
                            <td className="px-3 py-2 text-[var(--color-text-muted)]">{lead.email ?? '—'}</td>
                            <td className="px-3 py-2 text-[var(--color-text-muted)]">{lead.origin ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
