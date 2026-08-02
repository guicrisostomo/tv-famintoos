-- Calls are an authenticated, company-scoped feature. RLS remains enabled and
-- its existing policies derive the company from the current authenticated user.
revoke all on table public.tv_calls from anon;
grant select, insert, update, delete on table public.tv_calls to authenticated;
