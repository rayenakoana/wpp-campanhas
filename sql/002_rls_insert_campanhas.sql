-- Permite que usuarios autenticados criem campanhas (necessario para a
-- tela "Criar campanha" do app). Igual ao script anterior, escopo minimo:
-- so INSERT nas tabelas realmente usadas pelo formulario de criacao.

grant insert on wpp.campaigns to authenticated;
grant insert on wpp.campaign_segments to authenticated;
grant insert on wpp.campaign_variants to authenticated;

create policy "authenticated_can_insert" on wpp.campaigns
  for insert to authenticated with check (true);

create policy "authenticated_can_insert" on wpp.campaign_segments
  for insert to authenticated with check (true);

create policy "authenticated_can_insert" on wpp.campaign_variants
  for insert to authenticated with check (true);
