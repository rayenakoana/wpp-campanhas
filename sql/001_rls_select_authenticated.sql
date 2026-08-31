-- Garante que o papel "authenticated" (qualquer usuario logado via Supabase Auth)
-- pode usar o schema wpp e ler (SELECT) todas as suas tabelas.
-- Escrita (INSERT/UPDATE/DELETE) NAO e' concedida aqui de proposito --
-- sera adicionada tabela a tabela conforme as telas de escrita forem construidas.

grant usage on schema wpp to authenticated;
grant select on all tables in schema wpp to authenticated;

-- Politicas de RLS: permite SELECT para qualquer usuario autenticado.
-- Repetido para cada tabela porque o Postgres exige uma politica por tabela.

create policy "authenticated_can_select" on wpp.campaigns
  for select to authenticated using (true);

create policy "authenticated_can_select" on wpp.campaign_sends
  for select to authenticated using (true);

create policy "authenticated_can_select" on wpp.campaign_variants
  for select to authenticated using (true);

create policy "authenticated_can_select" on wpp.campaign_segments
  for select to authenticated using (true);

create policy "authenticated_can_select" on wpp.segments
  for select to authenticated using (true);

create policy "authenticated_can_select" on wpp.segment_leads
  for select to authenticated using (true);

create policy "authenticated_can_select" on wpp.leads
  for select to authenticated using (true);

create policy "authenticated_can_select" on wpp.templates
  for select to authenticated using (true);

create policy "authenticated_can_select" on wpp.message_events
  for select to authenticated using (true);

create policy "authenticated_can_select" on wpp.number_health_snapshots
  for select to authenticated using (true);

create policy "authenticated_can_select" on wpp.user_roles
  for select to authenticated using (true);
