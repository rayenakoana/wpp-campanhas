export default function Radar() {
  return (
    <div>
      <h1 className="font-display font-semibold text-2xl mb-1">Radar de Conversões</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-8">
        Radar de conversões por campanha e por funil: gasto, CPL e ROAS.
      </p>

      <div className="glass-card p-6 text-sm text-[var(--color-text-muted)]">
        Esta página depende da sincronização de gasto do Meta Ads (Graph API), que ainda não foi implementada.
        Assim que o workflow de sync de insights estiver em produção, o Gasto, CPL e ROAS por campanha e por funil
        aparecerão aqui automaticamente.
      </div>
    </div>
  )
}
