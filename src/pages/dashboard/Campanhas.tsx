import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCampanhas, type CampanhaCompleta } from '../../hooks/useCampanhas'
import { supabaseWpp } from '../../lib/supabase'
import type { CampaignSend } from '../../types/wpp'

// ── Helpers ──────────────────────────────────────────────────────────────────
const rotuloStatus: Record<string, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  running: 'Em andamento',
  firing: 'Em andamento',
  completed: 'Concluída',
  failed: 'Falhou',
  paused: 'Pausada',
}

const statusDot: Record<string, string> = {
  draft: 'st-neutral',
  scheduled: 'st-neutral',
  running: 'st-warn',
  firing: 'st-warn',
  completed: 'st-ok',
  failed: 'st-fail',
  paused: 'st-neutral',
}

const abas = [
  { key: 'todos',     label: 'Todas' },
  { key: 'running',   label: 'Em andamento' },
  { key: 'scheduled', label: 'Agendadas' },
  { key: 'completed', label: 'Concluídas' },
  { key: 'draft',     label: 'Rascunhos' },
]

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatarMoeda(valor: number): string {
  if (valor === 0) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pct(num: number, den: number): string {
  if (den === 0) return '0%'
  return Math.round((num / den) * 100) + '%'
}

// ── Barra de progresso ───────────────────────────────────────────────────────
function BarraPct({ valor, total, cor }: { valor: number; total: number; cor: string }) {
  const p = total > 0 ? Math.min((valor / total) * 100, 100) : 0
  return (
    <div style={{ height: 5, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${p}%`, background: cor, borderRadius: 3, transition: 'width 0.4s ease' }} />
    </div>
  )
}

// ── Hook: envios recentes de uma campanha ────────────────────────────────────
function useEnviosCampanha(campanhaId: string | null) {
  const [envios, setEnvios] = useState<CampaignSend[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!campanhaId) { setEnvios([]); return }
    let cancelado = false
    setLoading(true)

    supabaseWpp
      .from('campaign_sends')
      .select('*')
      .eq('campaign_id', campanhaId)
      .order('sent_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (!cancelado) {
          setEnvios((data ?? []) as CampaignSend[])
          setLoading(false)
        }
      })

    return () => { cancelado = true }
  }, [campanhaId])

  return { envios, loading }
}

// ── Drawer de detalhe da campanha ────────────────────────────────────────────
function DrawerCampanha({ campanha, onClose }: { campanha: CampanhaCompleta; onClose: () => void }) {
  const { envios, loading } = useEnviosCampanha(campanha.id)
  const [abaEnvios, setAbaEnvios] = useState<'todos' | 'falhas'>('todos')

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const enviados  = campanha.total_envios
  const entregues = campanha.entregues
  const lidos     = campanha.lidos
  const falhas    = campanha.falhas
  const custo     = campanha.custo_total

  const enviosFiltrados = abaEnvios === 'falhas'
    ? envios.filter((e) => e.status === 'failed')
    : envios

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.35)' }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
        width: 760, maxWidth: '92vw',
        background: 'var(--surface)',
        backdropFilter: 'blur(24px)',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-24px 0 64px rgba(0,0,0,0.5)',
      }}>

        {/* Header */}
        <div style={{ padding: '22px 28px', borderBottom: '1px solid var(--line-soft)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700, fontSize: 22,
                letterSpacing: '0.01em', marginBottom: 8,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {campanha.name}
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className={`status-txt ${statusDot[campanha.status] ?? 'st-neutral'}`}>
                  {rotuloStatus[campanha.status] ?? campanha.status}
                </span>
                {campanha.template_nome && (
                  <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontFamily: 'monospace', letterSpacing: '0.02em' }}>
                    {campanha.template_nome}
                  </span>
                )}
                {campanha.ab_test_enabled && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: 'rgba(201,160,23,0.15)', color: 'var(--gold)', letterSpacing: '0.04em' }}>
                    A/B
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 22, cursor: 'pointer', lineHeight: 1, marginLeft: 16, flexShrink: 0 }}>×</button>
          </div>

          {/* Datas */}
          <div style={{ display: 'flex', gap: 24, marginTop: 14, flexWrap: 'wrap' }}>
            {campanha.scheduled_at && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', marginBottom: 3 }}>AGENDADA PARA</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{formatarData(campanha.scheduled_at)}</div>
              </div>
            )}
            {campanha.started_at && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', marginBottom: 3 }}>INICIADA EM</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{formatarData(campanha.started_at)}</div>
              </div>
            )}
            {campanha.completed_at && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', marginBottom: 3 }}>CONCLUÍDA EM</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{formatarData(campanha.completed_at)}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', marginBottom: 3 }}>CRIADA EM</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{formatarData(campanha.created_at)}</div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
          borderBottom: '1px solid var(--line-soft)', flexShrink: 0,
        }}>
          {[
            { label: 'Enviados',  valor: enviados,  cor: 'var(--text)' },
            { label: 'Entregues', valor: entregues, cor: 'var(--green)', pct: pct(entregues, enviados) },
            { label: 'Lidos',     valor: lidos,     cor: '#60b4ff',     pct: pct(lidos, enviados) },
            { label: 'Falhas',    valor: falhas,    cor: 'var(--red)',  pct: pct(falhas, enviados) },
            { label: 'Custo',     valor: null,      cor: 'var(--gold)', texto: formatarMoeda(custo) },
          ].map((k, i) => (
            <div key={k.label} style={{
              padding: '16px 20px',
              borderRight: i < 4 ? '1px solid var(--line-soft)' : 'none',
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', marginBottom: 6 }}>{k.label.toUpperCase()}</div>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700, fontSize: 26,
                color: k.cor, letterSpacing: '-0.01em',
              }}>
                {k.texto ?? (k.valor ?? 0).toLocaleString('pt-BR')}
              </div>
              {k.pct && (
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{k.pct} dos enviados</div>
              )}
            </div>
          ))}
        </div>

        {/* Barras de progresso */}
        {enviados > 0 && (
          <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--line-soft)', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Taxa de entrega', valor: entregues, cor: 'var(--green)' },
                { label: 'Taxa de leitura', valor: lidos,     cor: '#60b4ff' },
                { label: 'Taxa de falha',   valor: falhas,    cor: 'var(--red)' },
              ].map((b) => (
                <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 120, fontSize: 11.5, color: 'var(--text-3)', letterSpacing: '0.01em', flexShrink: 0 }}>
                    {b.label}
                  </div>
                  <BarraPct valor={b.valor} total={enviados} cor={b.cor} />
                  <div style={{ width: 36, textAlign: 'right', fontSize: 12, fontWeight: 600, color: b.cor, flexShrink: 0 }}>
                    {pct(b.valor, enviados)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs envios */}
        <div style={{ padding: '14px 28px 0', borderBottom: '1px solid var(--line-soft)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { key: 'todos',  label: `Todos os envios (${envios.length})` },
              { key: 'falhas', label: `Falhas (${falhas})` },
            ].map((a) => (
              <button
                key={a.key}
                onClick={() => setAbaEnvios(a.key as 'todos' | 'falhas')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 500, fontFamily: 'Inter',
                  color: abaEnvios === a.key ? 'var(--text)' : 'var(--text-3)',
                  paddingBottom: 12,
                  borderBottom: abaEnvios === a.key ? '2px solid var(--red)' : '2px solid transparent',
                  letterSpacing: '0.01em',
                  transition: 'color 0.15s',
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de envios */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: 24, fontSize: 13, color: 'var(--text-2)' }}>Carregando envios...</div>
          )}

          {!loading && enviosFiltrados.length === 0 && (
            <div style={{ padding: 32, fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>
              {abaEnvios === 'falhas' ? 'Nenhuma falha registrada.' : 'Nenhum envio registrado ainda.'}
            </div>
          )}

          {!loading && enviosFiltrados.length > 0 && (
            <div style={{overflowX:'auto',width:'100%'}}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                  {['Lead ID', 'Status', 'Enviado em', 'Entregue em', 'Lido em', 'Motivo falha'].map((h) => (
                    <th key={h} style={{
                      textAlign: 'left', fontSize: 10.5, textTransform: 'uppercase',
                      letterSpacing: '0.07em', color: 'var(--text-3)',
                      padding: '10px 20px', borderBottom: '1px solid var(--line-soft)', fontWeight: 600,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enviosFiltrados.map((e) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '11px 20px', fontSize: 11.5, fontFamily: 'monospace', color: 'var(--text-3)' }}>
                      {e.lead_id.slice(0, 8)}…
                    </td>
                    <td style={{ padding: '11px 20px' }}>
                      <span className={`status-txt ${
                        e.status === 'read' ? 'st-ok' :
                        e.status === 'delivered' ? 'st-ok' :
                        e.status === 'sent' ? 'st-neutral' :
                        e.status === 'failed' ? 'st-fail' : 'st-neutral'
                      }`} style={{ fontSize: 12 }}>
                        {e.status === 'read' ? 'Lido' :
                         e.status === 'delivered' ? 'Entregue' :
                         e.status === 'sent' ? 'Enviado' :
                         e.status === 'failed' ? 'Falhou' : e.status}
                      </span>
                    </td>
                    <td style={{ padding: '11px 20px', fontSize: 12, color: 'var(--text-3)' }}>{formatarData(e.sent_at)}</td>
                    <td style={{ padding: '11px 20px', fontSize: 12, color: 'var(--text-3)' }}>{formatarData(e.delivered_at)}</td>
                    <td style={{ padding: '11px 20px', fontSize: 12, color: 'var(--text-3)' }}>{formatarData(e.read_at)}</td>
                    <td style={{ padding: '11px 20px', fontSize: 11.5, color: 'var(--red)', maxWidth: 180 }}>
                      {e.failed_reason ? (
                        <span title={e.failed_reason}>
                          {e.failed_reason.length > 40 ? e.failed_reason.slice(0, 40) + '…' : e.failed_reason}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* Footer */}
        {envios.length > 0 && (
          <div style={{
            padding: '12px 28px', borderTop: '1px solid var(--line-soft)',
            fontSize: 11.5, color: 'var(--text-3)', flexShrink: 0,
            letterSpacing: '0.02em',
          }}>
            {envios.length >= 100
              ? 'Mostrando os 100 envios mais recentes'
              : `${envios.length} envio${envios.length !== 1 ? 's' : ''} registrado${envios.length !== 1 ? 's' : ''}`}
          </div>
        )}
      </div>
    </>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function Campanhas() {
  const navigate = useNavigate()
  const { campanhas, loading, error } = useCampanhas()
  const [abaAtiva, setAbaAtiva] = useState('todos')
  const [campanhaDetalhe, setCampanhaDetalhe] = useState<CampanhaCompleta | null>(null)

  const campanhasFiltradas = useMemo(() => {
    if (abaAtiva === 'todos') return campanhas
    return campanhas.filter((c) => {
      if (abaAtiva === 'running') return c.status === 'running' || c.status === 'firing'
      return c.status === abaAtiva
    })
  }, [campanhas, abaAtiva])

  return (
    <>
      {/* Drawer de detalhe */}
      {campanhaDetalhe && (
        <DrawerCampanha
          campanha={campanhaDetalhe}
          onClose={() => setCampanhaDetalhe(null)}
        />
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {abas.map((a) => (
            <button
              key={a.key}
              className={`tab ${abaAtiva === a.key ? 'active' : ''}`}
              onClick={() => setAbaAtiva(a.key)}
            >
              {a.label}
            </button>
          ))}
        </div>
        <button className="btn primary" onClick={() => navigate('/criar-campanha')}>
          + Nova campanha
        </button>
      </div>

      {loading && (
        <div className="panel" style={{ padding: 24, fontSize: 13, color: 'var(--text-2)' }}>
          Carregando campanhas...
        </div>
      )}

      {error && (
        <div className="panel" style={{ padding: 24, fontSize: 13, color: '#f28c94' }}>
          Não foi possível carregar as campanhas: {error}
        </div>
      )}

      {!loading && !error && (
        <div style={{overflowX:'auto',width:'100%'}}>
          <table className="data-table">
          <thead>
            <tr>
              <th>Campanha</th>
              <th>Status</th>
              <th className="r">Leads</th>
              <th className="r">Enviadas</th>
              <th className="r">Entregues</th>
              <th className="r">Lidas</th>
              <th className="r">Custo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {campanhasFiltradas.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40, fontSize: 13 }}>
                  Nenhuma campanha encontrada.
                </td>
              </tr>
            )}
            {campanhasFiltradas.map((c) => (
              <tr
                key={c.id}
                className="rowlink"
                onClick={() => setCampanhaDetalhe(c)}
              >
                <td>
                  <div className="row-title">{c.name}</div>
                  <div className="row-sub">
                    {c.status === 'scheduled' && c.scheduled_at
                      ? `Agendada · ${formatarData(c.scheduled_at)}`
                      : c.status === 'draft'
                        ? 'Rascunho'
                        : c.completed_at
                          ? `Concluída · ${formatarData(c.completed_at)}`
                          : c.started_at
                            ? `Iniciada · ${formatarData(c.started_at)}`
                            : formatarData(c.created_at)}
                  </div>
                </td>
                <td>
                  <span className={`status-txt ${statusDot[c.status] ?? 'st-neutral'}`}>
                    {rotuloStatus[c.status] ?? c.status}
                  </span>
                </td>
                <td className="r cell-num num">
                  {c.total_envios > 0 ? c.total_envios.toLocaleString('pt-BR') : '—'}
                </td>
                <td className="r num">{c.total_envios > 0 ? c.total_envios.toLocaleString('pt-BR') : '—'}</td>
                <td className="r num">{c.entregues > 0 ? c.entregues.toLocaleString('pt-BR') : '—'}</td>
                <td className="r num">{c.lidos > 0 ? c.lidos.toLocaleString('pt-BR') : '—'}</td>
                <td className="r num">{c.custo_total > 0 ? formatarMoeda(c.custo_total) : '—'}</td>
                <td className="arrow-cell">›</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </>
  )
}
