-- Editable call metadata complements the existing tv_call_templates table.
alter table public.tv_calls add column if not exists call_payload jsonb not null default '{}'::jsonb;

create table if not exists public.tv_generated_promotions (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.business(cnpj),
  title text not null,
  subtitle text,
  status text not null default 'draft' check (status in ('draft','approved','scheduled','active','archived')),
  layout_type text not null default 'auto' check (layout_type in ('auto','single','double','triple','hero','qr')),
  design jsonb not null default '{}'::jsonb,
  display_ids uuid[] not null default '{}'::uuid[],
  duration_seconds integer not null default 12 check (duration_seconds between 3 and 300),
  schedule jsonb not null default '{}'::jsonb,
  current_media_id uuid references public.tv_media(id) on delete set null,
  created_by uuid not null default auth.uid() references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tv_generated_promotion_products (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.business(cnpj),
  promotion_id uuid not null references public.tv_generated_promotions(id) on delete cascade,
  name text not null,
  short_description text,
  original_price numeric(12,2) check (original_price is null or original_price >= 0),
  promotional_price numeric(12,2) not null check (promotional_price >= 0),
  image_key text,
  image_url text,
  badge_text text,
  note text,
  position smallint not null check (position between 0 and 2),
  image_transform jsonb not null default '{"scale":1,"x":0,"y":0}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (promotion_id, position)
);

create table if not exists public.tv_generated_promotion_versions (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.business(cnpj),
  promotion_id uuid not null references public.tv_generated_promotions(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null,
  generated_image_key text not null,
  generated_image_url text not null,
  width integer not null check (width in (1280, 1920)),
  height integer not null check (height in (720, 1080)),
  mime_type text not null default 'image/webp' check (mime_type in ('image/webp','image/png')),
  media_id uuid not null references public.tv_media(id) on delete restrict,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (promotion_id, version_number)
);

create index if not exists tv_generated_promotions_company_status_idx on public.tv_generated_promotions(company_id, status, updated_at desc);
create index if not exists tv_generated_promotion_products_promotion_idx on public.tv_generated_promotion_products(company_id, promotion_id, position);
create index if not exists tv_generated_promotion_versions_promotion_idx on public.tv_generated_promotion_versions(company_id, promotion_id, version_number desc);

do $$
declare table_name text;
begin
  foreach table_name in array array['tv_generated_promotions','tv_generated_promotion_products','tv_generated_promotion_versions'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.jwt() ->> ''is_anonymous'') is distinct from ''true'' and (company_id = (select public.get_current_user_cnpj()) or (select public.get_current_user_type()) = 99999))', table_name || '_select_company', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.jwt() ->> ''is_anonymous'') is distinct from ''true'' and (company_id = (select public.get_current_user_cnpj()) or (select public.get_current_user_type()) = 99999))', table_name || '_insert_company', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.jwt() ->> ''is_anonymous'') is distinct from ''true'' and (company_id = (select public.get_current_user_cnpj()) or (select public.get_current_user_type()) = 99999)) with check ((select auth.jwt() ->> ''is_anonymous'') is distinct from ''true'' and (company_id = (select public.get_current_user_cnpj()) or (select public.get_current_user_type()) = 99999))', table_name || '_update_company', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.jwt() ->> ''is_anonymous'') is distinct from ''true'' and (company_id = (select public.get_current_user_cnpj()) or (select public.get_current_user_type()) = 99999))', table_name || '_delete_company', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
  end loop;
end $$;

alter policy tv_generated_promotion_products_insert_company on public.tv_generated_promotion_products
  with check (
    (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
    and (company_id = (select public.get_current_user_cnpj()) or (select public.get_current_user_type()) = 99999)
    and exists (select 1 from public.tv_generated_promotions p where p.id = tv_generated_promotion_products.promotion_id and p.company_id = tv_generated_promotion_products.company_id)
  );
alter policy tv_generated_promotion_products_update_company on public.tv_generated_promotion_products
  using ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true' and (company_id = (select public.get_current_user_cnpj()) or (select public.get_current_user_type()) = 99999))
  with check (
    (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
    and (company_id = (select public.get_current_user_cnpj()) or (select public.get_current_user_type()) = 99999)
    and exists (select 1 from public.tv_generated_promotions p where p.id = tv_generated_promotion_products.promotion_id and p.company_id = tv_generated_promotion_products.company_id)
  );
alter policy tv_generated_promotion_versions_insert_company on public.tv_generated_promotion_versions
  with check (
    (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
    and (company_id = (select public.get_current_user_cnpj()) or (select public.get_current_user_type()) = 99999)
    and exists (select 1 from public.tv_generated_promotions p where p.id = tv_generated_promotion_versions.promotion_id and p.company_id = tv_generated_promotion_versions.company_id)
    and exists (select 1 from public.tv_media m where m.id = tv_generated_promotion_versions.media_id and m.company_id = tv_generated_promotion_versions.company_id)
  );
alter policy tv_generated_promotion_versions_update_company on public.tv_generated_promotion_versions
  using ((select auth.jwt() ->> 'is_anonymous') is distinct from 'true' and (company_id = (select public.get_current_user_cnpj()) or (select public.get_current_user_type()) = 99999))
  with check (
    (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
    and (company_id = (select public.get_current_user_cnpj()) or (select public.get_current_user_type()) = 99999)
    and exists (select 1 from public.tv_generated_promotions p where p.id = tv_generated_promotion_versions.promotion_id and p.company_id = tv_generated_promotion_versions.company_id)
    and exists (select 1 from public.tv_media m where m.id = tv_generated_promotion_versions.media_id and m.company_id = tv_generated_promotion_versions.company_id)
  );

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tv_generated_promotions') then
    alter publication supabase_realtime add table public.tv_generated_promotions;
  end if;
end $$;
