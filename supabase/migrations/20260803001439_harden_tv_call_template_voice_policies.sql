alter policy tv_call_templates_select_company on public.tv_call_templates to authenticated
  using ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true' and (company_id = (select public.get_current_user_cnpj()) or (select public.get_current_user_type()) = 99999));
alter policy tv_call_templates_insert_company on public.tv_call_templates to authenticated
  with check ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true' and (company_id = (select public.get_current_user_cnpj()) or (select public.get_current_user_type()) = 99999));
alter policy tv_call_templates_update_company on public.tv_call_templates to authenticated
  using ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true' and (company_id = (select public.get_current_user_cnpj()) or (select public.get_current_user_type()) = 99999))
  with check ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true' and (company_id = (select public.get_current_user_cnpj()) or (select public.get_current_user_type()) = 99999));
alter policy tv_call_templates_delete_company on public.tv_call_templates to authenticated
  using ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true' and (company_id = (select public.get_current_user_cnpj()) or (select public.get_current_user_type()) = 99999));
