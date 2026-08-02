-- Authentication and tenant isolation hardening for Famintoos TV.
-- No data is removed. The authenticated company is always derived server-side.
create or replace function public.get_current_active_company_id()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select u.cnpj
  from public.tb_user u
  where u.uid = (select auth.uid())
    and u.fg_ativo = true
    and u.cnpj is not null
  limit 1
$$;
revoke all on function public.get_current_active_company_id() from public, anon;
grant execute on function public.get_current_active_company_id() to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['tv_programs','tv_program_blocks','tv_program_items','tv_campaigns','tv_campaign_displays','tv_commercial_breaks','tv_display_themes','tv_call_templates','tv_interruptions','tv_content_impressions'] loop
    execute format('alter policy %I on public.%I to authenticated using (company_id = (select public.get_current_active_company_id()))', table_name || '_select_company', table_name);
    execute format('alter policy %I on public.%I to authenticated with check (company_id = (select public.get_current_active_company_id()))', table_name || '_insert_company', table_name);
    execute format('alter policy %I on public.%I to authenticated using (company_id = (select public.get_current_active_company_id())) with check (company_id = (select public.get_current_active_company_id()))', table_name || '_update_company', table_name);
    execute format('alter policy %I on public.%I to authenticated using (company_id = (select public.get_current_active_company_id()))', table_name || '_delete_company', table_name);
  end loop;
end $$;

-- Harden the first TV module without replacing or deleting its tables.
alter policy tv_displays_select_company on public.tv_displays to authenticated
  using (company_id = (select public.get_current_active_company_id()));
alter policy tv_displays_insert_company on public.tv_displays to authenticated
  with check (company_id = (select public.get_current_active_company_id()));
alter policy tv_displays_update_company on public.tv_displays to authenticated
  using (company_id = (select public.get_current_active_company_id()))
  with check (company_id = (select public.get_current_active_company_id()));
alter policy tv_displays_delete_company on public.tv_displays to authenticated
  using (company_id = (select public.get_current_active_company_id()));

alter policy tv_media_select_company on public.tv_media to authenticated
  using (company_id = (select public.get_current_active_company_id()));
alter policy tv_media_insert_company on public.tv_media to authenticated
  with check (company_id = (select public.get_current_active_company_id()));
alter policy tv_media_update_company on public.tv_media to authenticated
  using (company_id = (select public.get_current_active_company_id()))
  with check (company_id = (select public.get_current_active_company_id()));
alter policy tv_media_delete_company on public.tv_media to authenticated
  using (company_id = (select public.get_current_active_company_id()));

alter policy tv_calls_select_company on public.tv_calls to authenticated
  using (company_id = (select public.get_current_active_company_id()));
alter policy tv_calls_insert_company on public.tv_calls to authenticated
  with check (company_id = (select public.get_current_active_company_id()));
alter policy tv_calls_update_company on public.tv_calls to authenticated
  using (company_id = (select public.get_current_active_company_id()))
  with check (company_id = (select public.get_current_active_company_id()));
alter policy tv_calls_delete_company on public.tv_calls to authenticated
  using (company_id = (select public.get_current_active_company_id()));

alter policy tv_playlist_select_company on public.tv_playlist_items to authenticated
  using (company_id = (select public.get_current_active_company_id()));
alter policy tv_playlist_insert_company on public.tv_playlist_items to authenticated
  with check (
    company_id = (select public.get_current_active_company_id())
    and exists (select 1 from public.tv_displays d where d.id = tv_playlist_items.display_id and d.company_id = tv_playlist_items.company_id)
    and exists (select 1 from public.tv_media m where m.id = tv_playlist_items.media_id and m.company_id = tv_playlist_items.company_id)
  );
alter policy tv_playlist_update_company on public.tv_playlist_items to authenticated
  using (company_id = (select public.get_current_active_company_id()))
  with check (
    company_id = (select public.get_current_active_company_id())
    and exists (select 1 from public.tv_displays d where d.id = tv_playlist_items.display_id and d.company_id = tv_playlist_items.company_id)
    and exists (select 1 from public.tv_media m where m.id = tv_playlist_items.media_id and m.company_id = tv_playlist_items.company_id)
  );
alter policy tv_playlist_delete_company on public.tv_playlist_items to authenticated
  using (company_id = (select public.get_current_active_company_id()));

-- R2 metadata previously allowed every authenticated user to see and update every company.
alter policy r2_media_assets_select_authenticated on public.r2_media_assets to authenticated
  using (business_cnpj = (select public.get_current_active_company_id()));
alter policy r2_media_assets_insert_authenticated on public.r2_media_assets to authenticated
  with check (business_cnpj = (select public.get_current_active_company_id()));
alter policy r2_media_assets_update_authenticated on public.r2_media_assets to authenticated
  using (business_cnpj = (select public.get_current_active_company_id()))
  with check (business_cnpj = (select public.get_current_active_company_id()));
