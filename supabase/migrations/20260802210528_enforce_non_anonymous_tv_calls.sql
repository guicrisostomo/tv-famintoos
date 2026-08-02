alter policy tv_calls_select_company on public.tv_calls to authenticated
  using ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true' and company_id = (select public.get_current_active_company_id()));
alter policy tv_calls_insert_company on public.tv_calls to authenticated
  with check ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true' and company_id = (select public.get_current_active_company_id()));
alter policy tv_calls_update_company on public.tv_calls to authenticated
  using ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true' and company_id = (select public.get_current_active_company_id()))
  with check ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true' and company_id = (select public.get_current_active_company_id()));
alter policy tv_calls_delete_company on public.tv_calls to authenticated
  using ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true' and company_id = (select public.get_current_active_company_id()));
