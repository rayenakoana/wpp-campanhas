import { useState, useEffect, type FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useSegmentos } from '../../hooks/useSegmentos'
import { useLeadsDoSegmento } from '../../hooks/useLeadsDoSegmento'
import { useTodosLeads } from '../../hooks/useTodosLeads'
import { supabaseWpp } from '../../lib/supabase'
import type { Segment } from '../../types/wpp'

// ── helpers ────────────────────────────────────────────────────────────────

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const SOURCE_LABELS: Record<string, string> = {
  rd_crm: 'RD CRM',
  rd_marketing: 'RD Marketing',
  manual: 'Manual',
}

const SYNC_LABELS: Record<string, { label: string; cls: string }> = {
  rd_crm:       { label: 'A cada 2h',           cls: 'st-ok'      },
  rd_marketing: { label: 'Tempo real (webhook)', cls: 'st-ok'      },
  manual:       { label: 'Estático',             cls: 'st-neutral' },
}

// ── Modal Novo Segmento ─────────────────────────────────────────────────────

interface ModalNovoSegmentoProps {
  onClose: () => void
  onSalvo: () => void
}

function ModalNovoSegmento({ onClose, onSalvo }: ModalNovoSegmentoProps) {
  const { user } = useAuth()
  const [nome, setNome] = useState('')
  const [source, setSource] = useState<'rd_crm' | 'rd_marketing' | 'manual'>('manual')
  const [sourceRef, setSourceRef] = useState('')
  const [isDynamic, setIsDynamic] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) { setErro('Dê um nome ao segmento.'); return }
    setSalvando(true)
    setErro(null)
    try {
      const { error } = await supabaseWpp.from('segments').insert({
        name: nome.trim(),
        source,
        source_ref: sourceRef.trim() || null,
        is_dynamic: isDynamic,
        contact_count: 0,
        created_by: user?.id ?? null,
      })
      if (error) throw error
      onSalvo()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar segmento.')
    } finally {
      setSalvando(false)
    }
  }

  // Fechar com Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        className="panel"
        style={{ width: 480, maxWidth: '95vw', padding: 28, background: 'var(--surface)', backdropFilter: 'blur(24px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18 }}>
            Novo segmento
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {erro && (
          <div style={{ padding: '10px 14px', background: 'rgba(232,25,44,0.1)', border: '1px solid rgba(232,25,44,0.3)', borderRadius: 8, fontSize: 13, color: '#f28c94', marginBottom: 16 }}>
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nome do segmento</label>
            <input
              className="input"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Funil Diagnóstico — Estágio BASE"
              autoFocus
            />
          </div>

          <div className="field">
            <label>Fonte</label>
            <select
              className="input"
              value={source}
              onChange={(e) => setSource(e.target.value as typeof source)}
            >
              <option value="manual">Manual (lista estática)</option>
              <option value="rd_crm">RD Station CRM</option>
              <option value="rd_marketing">RD Station Marketing</option>
            </select>
          </div>

          {source !== 'manual' && (
            <div className="field">
              <label>
                {source === 'rd_crm' ? 'Pipeline / estágio (referência)' : 'Tag ou filtro (referência)'}
              </label>
              <input
                className="input"
                value={sourceRef}
                onChange={(e) => setSourceRef(e.target.value)}
                placeholder={
                  source === 'rd_crm'
                    ? 'Ex: Pipeline Diagnóstico · estágio BASE'
                    : 'Ex: diagnostico-confeccao-lead'
                }
              />
              <div className="hint">Usado apenas como referência descritiva — a sincronização é feita via N8N.</div>
            </div>
          )}

          <div className="field" style={{ marginBottom: 24 }}>
            <div className="seg-option" onClick={() => setIsDynamic((v) => !v)}>
              <input
                type="checkbox"
                checked={isDynamic}
                onChange={() => setIsDynamic((v) => !v)}
                onClick={(e) => e.stopPropagation()}
              />
              Segmento dinâmico
              <span className="cnt">atualizado automaticamente</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn primary" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Criar segmento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Painel lateral de detalhe do segmento ──────────────────────────────────

interface PainelDetalheProps {
  segmento: Segment
  onClose: () => void
}

function PainelDetalhe({ segmento, onClose }: PainelDetalheProps) {
  const { leads, loading, error } = useLeadsDoSegmento(segmento.id)
  const [busca, setBusca] = useState('')

  const leadsFiltrados = busca.trim()
    ? leads.filter((l) =>
        (l.name ?? '').toLowerCase().includes(busca.toLowerCase()) ||
        (l.email ?? '').toLowerCase().includes(busca.toLowerCase()) ||
        (l.whatsapp_e164 ?? '').includes(busca)
      )
    : leads

  const src = segmento.source ?? 'manual'
  const sync = SYNC_LABELS[src] ?? { label: src, cls: 'st-neutral' }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      {/* Overlay semitransparente */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
      />

      {/* Drawer lateral direito */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
          width: 780, maxWidth: '92vw',
          background: 'var(--surface)',
          backdropFilter: 'blur(24px)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header do drawer */}
        <div style={{ padding: '22px 28px', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 22, letterSpacing: '0.01em', marginBottom: 8 }}>
              {segmento.name}
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span className="status-txt st-neutral">{SOURCE_LABELS[src] ?? src}</span>
              <span className={`status-txt ${sync.cls}`}>{sync.label}</span>
              {segmento.is_dynamic && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(201,160,23,0.15)', color: 'var(--gold)', fontWeight: 600 }}>
                  Dinâmico
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 22, cursor: 'pointer', lineHeight: 1, marginLeft: 16, flexShrink: 0 }}
          >
            ×
          </button>
        </div>

        {/* Stats rápidas */}
        <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--line-soft)', display: 'flex', gap: 40, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>LEADS</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 28, letterSpacing: '-0.01em' }}>
              {(segmento.contact_count ?? leads.length).toLocaleString('pt-BR')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>ÚLTIMA ATUALIZAÇÃO</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', paddingTop: 4 }}>
              {formatarData(segmento.last_synced_at ?? null)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>CRIADO EM</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', paddingTop: 4 }}>
              {formatarData(segmento.created_at)}
            </div>
          </div>
        </div>

        {/* Busca dentro do segmento */}
        <div style={{ padding: '14px 28px', borderBottom: '1px solid var(--line-soft)', flexShrink: 0 }}>
          <input
            className="input"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone..."
            style={{ fontSize: 13 }}
          />
        </div>

        {/* Lista de leads */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: 24, fontSize: 13, color: 'var(--text-2)' }}>Carregando leads...</div>
          )}
          {error && (
            <div style={{ padding: 24, fontSize: 13, color: '#f28c94' }}>Erro: {error}</div>
          )}
          {!loading && !error && leadsFiltrados.length === 0 && (
            <div style={{ padding: 24, fontSize: 13, color: 'var(--text-3)' }}>
              {busca ? 'Nenhum lead encontrado com essa busca.' : 'Nenhum lead vinculado a este segmento ainda.'}
            </div>
          )}
          {!loading && !error && leadsFiltrados.length > 0 && (
            <div style={{overflowX:'auto',borderRadius:14}}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                  <th style={{ textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-3)', padding: '10px 28px', borderBottom: '1px solid var(--line-soft)', fontWeight: 600 }}>Nome</th>
                  <th style={{ textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-3)', padding: '10px 16px', borderBottom: '1px solid var(--line-soft)', fontWeight: 600 }}>WhatsApp</th>
                  <th style={{ textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-3)', padding: '10px 16px', borderBottom: '1px solid var(--line-soft)', fontWeight: 600 }}>E-mail</th>
                  <th style={{ textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-3)', padding: '10px 16px', borderBottom: '1px solid var(--line-soft)', fontWeight: 600 }}>Origem</th>
                </tr>
              </thead>
              <tbody>
                {leadsFiltrados.map((lead) => (
                  <tr key={lead.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '13px 28px', fontSize: 13.5, fontWeight: 500, letterSpacing: '0.01em' }}>{lead.name ?? '—'}</td>
                    <td style={{ padding: '13px 18px', fontSize: 13, color: 'var(--text-2)', fontFamily: 'monospace', letterSpacing: '0.02em' }}>{lead.whatsapp_e164 ?? '—'}</td>
                    <td style={{ padding: '13px 18px', fontSize: 13, color: 'var(--text-2)' }}>{lead.email ?? '—'}</td>
                    <td style={{ padding: '13px 18px', fontSize: 11.5, color: 'var(--text-3)', letterSpacing: '0.02em' }}>{lead.origin ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && leadsFiltrados.length > 0 && (
          <div style={{ padding: '13px 28px', borderTop: '1px solid var(--line-soft)', fontSize: 11.5, color: 'var(--text-3)', flexShrink: 0, letterSpacing: '0.02em' }}>
            {busca
              ? `${leadsFiltrados.length} resultado${leadsFiltrados.length !== 1 ? 's' : ''} para "${busca}"`
              : `${leadsFiltrados.length} lead${leadsFiltrados.length !== 1 ? 's' : ''} carregado${leadsFiltrados.length !== 1 ? 's' : ''}`}
            {leads.length >= 500 && ' · mostrando primeiros 500'}
          </div>
        )}
      </div>
    </>
  )
}

// ── Aba: Todos os leads ─────────────────────────────────────────────────────

function TabTodosLeads() {
  const [busca, setBusca] = useState('')
  const { leads, loading, error } = useTodosLeads(busca)

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <input
          className="input"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, e-mail ou telefone..."
          style={{ maxWidth: 380, fontSize: 13 }}
        />
      </div>

      {loading && (
        <div style={{ padding: 24, fontSize: 13, color: 'var(--text-2)' }}>Carregando leads...</div>
      )}
      {error && (
        <div style={{ padding: 24, fontSize: 13, color: '#f28c94' }}>Erro: {error}</div>
      )}
      {!loading && !error && (
        <div style={{overflowX:'auto',borderRadius:14}}>
          <table className="data-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>WhatsApp</th>
              <th>E-mail</th>
              <th>Origem</th>
              <th>Cadastrado em</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32, fontSize: 13 }}>
                  {busca ? 'Nenhum lead encontrado.' : 'Nenhum lead na base ainda.'}
                </td>
              </tr>
            )}
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td><div className="row-title">{lead.name ?? '—'}</div></td>
                <td style={{ fontSize: 13, color: 'var(--text-2)', fontFamily: 'monospace' }}>{lead.whatsapp_e164 ?? '—'}</td>
                <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{lead.email ?? '—'}</td>
                <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{lead.origin ?? '—'}</td>
                <td className="row-sub">{formatarData(lead.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
      {!loading && leads.length >= 200 && (
        <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 12, color: 'var(--text-3)' }}>
          Mostrando primeiros 200 leads. Use a busca para filtrar.
        </div>
      )}
    </div>
  )
}

// ── Página principal ────────────────────────────────────────────────────────

export default function Segmentos() {
  const { segmentos, loading, error } = useSegmentos()
  const [abaAtiva, setAbaAtiva] = useState<'segmentos' | 'leads'>('segmentos')
  const [segmentoDetalhe, setSegmentoDetalhe] = useState<Segment | null>(null)
  const [modalAberto, setModalAberto] = useState(false)

  // Forçar reload dos segmentos após criar novo
  // (useSegmentos não tem refresh externo, então remont via key)

  function onSegmentoSalvo() {
    setModalAberto(false)
    // Reload simples via refresh de página não é ideal;
    // a solução é recarregar via window.location mas melhor usar um callback
    window.location.reload()
  }

  return (
    <>
      {/* Modal novo segmento */}
      {modalAberto && (
        <ModalNovoSegmento
          onClose={() => setModalAberto(false)}
          onSalvo={onSegmentoSalvo}
        />
      )}

      {/* Drawer de detalhe */}
      {segmentoDetalhe && (
        <PainelDetalhe
          segmento={segmentoDetalhe}
          onClose={() => setSegmentoDetalhe(null)}
        />
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button
            className={`tab ${abaAtiva === 'segmentos' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('segmentos')}
          >
            Segmentos
          </button>
          <button
            className={`tab ${abaAtiva === 'leads' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('leads')}
          >
            Todos os leads
          </button>
        </div>
        {abaAtiva === 'segmentos' && (
          <button className="btn primary" onClick={() => setModalAberto(true)}>
            + Novo segmento
          </button>
        )}
      </div>

      {/* Conteúdo da aba */}
      {abaAtiva === 'leads' ? (
        <TabTodosLeads />
      ) : (
        <>
          {loading && (
            <div className="panel" style={{ padding: 24, fontSize: 13, color: 'var(--text-2)' }}>
              Carregando segmentos...
            </div>
          )}
          {error && (
            <div className="panel" style={{ padding: 24, fontSize: 13, color: '#f28c94' }}>
              Não foi possível carregar os segmentos: {error}
            </div>
          )}

          {!loading && !error && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Segmento</th>
                  <th>Fonte</th>
                  <th className="r">Leads</th>
                  <th>Sincronização</th>
                  <th className="r">Última atualização</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {segmentos.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32, fontSize: 13 }}>
                      Nenhum segmento criado ainda.
                    </td>
                  </tr>
                )}
                {segmentos.map((s) => {
                  const src = s.source ?? 'manual'
                  const sync = SYNC_LABELS[src] ?? { label: src, cls: 'st-neutral' }
                  const sourceRef = typeof s.source_ref === 'string' ? s.source_ref : null
                  return (
                    <tr
                      key={s.id}
                      className="rowlink"
                      onClick={() => setSegmentoDetalhe(s)}
                    >
                      <td>
                        <div className="row-title">{s.name}</div>
                        {sourceRef && <div className="row-sub">{sourceRef}</div>}
                      </td>
                      <td>
                        <span className="status-txt st-neutral">{SOURCE_LABELS[src] ?? src}</span>
                      </td>
                      <td className="r cell-num num">
                        {(s.contact_count ?? 0).toLocaleString('pt-BR')}
                      </td>
                      <td>
                        <span className={`status-txt ${sync.cls}`}>{sync.label}</span>
                      </td>
                      <td className="r row-sub">{formatarData(s.last_synced_at ?? null)}</td>
                      <td className="arrow-cell">›</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </>
  )
}
