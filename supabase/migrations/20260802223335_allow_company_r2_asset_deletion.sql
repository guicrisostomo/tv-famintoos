create policy r2_media_assets_delete_company
on public.r2_media_assets for delete
to authenticated
using (
  (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  and business_cnpj = (select public.get_current_active_company_id())
);

grant delete on table public.r2_media_assets to authenticated;
