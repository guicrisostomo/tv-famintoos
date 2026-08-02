alter policy r2_media_assets_select_authenticated on public.r2_media_assets to authenticated
  using ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true' and business_cnpj = (select public.get_current_active_company_id()));
alter policy r2_media_assets_insert_authenticated on public.r2_media_assets to authenticated
  with check ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true' and business_cnpj = (select public.get_current_active_company_id()));
alter policy r2_media_assets_update_authenticated on public.r2_media_assets to authenticated
  using ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true' and business_cnpj = (select public.get_current_active_company_id()))
  with check ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true' and business_cnpj = (select public.get_current_active_company_id()));

alter function public.set_r2_media_assets_updated_at() set search_path = '';
