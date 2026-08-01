-- Famintoos TV channel schema. Incremental only: no existing object is removed.
create extension if not exists pgcrypto;

create table if not exists public.tv_programs (
  id uuid primary key default gen_random_uuid(), company_id text not null references public.business(cnpj),
  name text not null, channel_name text, mode text not null default 'playlist' check (mode in ('playlist','schedule')),
  display_ids uuid[] not null default '{}', active boolean not null default true,
  starts_at timestamptz, ends_at timestamptz, days_of_week smallint[] not null default '{}',
  settings jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.tv_program_blocks (
  id uuid primary key default gen_random_uuid(), company_id text not null references public.business(cnpj), program_id uuid references public.tv_programs(id) on delete cascade,
  name text not null, description text, block_type text not null default 'custom', identification_color text,
  priority integer not null default 0, estimated_duration_seconds integer check (estimated_duration_seconds is null or estimated_duration_seconds > 0),
  active boolean not null default true, display_ids uuid[] not null default '{}', days_of_week smallint[] not null default '{}',
  start_time time, end_time time, starts_on date, ends_on date, position integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.tv_program_items (
  id uuid primary key default gen_random_uuid(), company_id text not null references public.business(cnpj), program_id uuid not null references public.tv_programs(id) on delete cascade,
  block_id uuid references public.tv_program_blocks(id) on delete cascade, media_id uuid references public.tv_media(id) on delete restrict,
  content_type text not null check (content_type in ('image','video','message','qr_code','audio','commercial_break')),
  title text, message_text text,
  duration_seconds integer not null default 10 check (duration_seconds > 0), transition_in text, transition_out text,
  volume numeric(4,3) not null default 1 check (volume between 0 and 1), muted boolean not null default true,
  image_fit text not null default 'contain' check (image_fit in ('contain','cover','fill')), background_color text,
  loop boolean not null default false, max_repetitions integer, qr_code jsonb, overlay jsonb,
  display_ids uuid[] not null default '{}', priority integer not null default 0,
  resume_behavior text not null default 'resume' check (resume_behavior in ('resume','restart')),
  schedule jsonb not null default '{}', active boolean not null default true, position integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.tv_campaigns (
  id uuid primary key default gen_random_uuid(), company_id text not null references public.business(cnpj), name text not null, description text,
  media_id uuid references public.tv_media(id) on delete restrict, priority integer not null default 0, interval_seconds integer not null check (interval_seconds > 0),
  duration_seconds integer not null check (duration_seconds > 0), starts_at timestamptz, ends_at timestamptz,
  days_of_week smallint[] not null default '{}', start_time time, end_time time, max_daily_impressions integer,
  max_impressions_per_display integer, active boolean not null default true, in_commercial_break boolean not null default true,
  standalone boolean not null default false, weight integer not null default 1 check (weight > 0),
  last_displayed_at timestamptz, next_display_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.tv_campaign_displays (
  id uuid primary key default gen_random_uuid(), company_id text not null references public.business(cnpj), campaign_id uuid not null references public.tv_campaigns(id) on delete cascade,
  display_id uuid not null references public.tv_displays(id) on delete cascade, created_at timestamptz not null default now(), unique(campaign_id, display_id)
);
create table if not exists public.tv_commercial_breaks (
  id uuid primary key default gen_random_uuid(), company_id text not null references public.business(cnpj), program_id uuid references public.tv_programs(id) on delete cascade,
  name text not null, display_ids uuid[] not null default '{}', programming_seconds integer not null check (programming_seconds > 0),
  commercial_seconds integer not null check (commercial_seconds > 0), max_campaigns integer, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.tv_display_themes (
  id uuid primary key default gen_random_uuid(), company_id text not null references public.business(cnpj), display_id uuid references public.tv_displays(id) on delete cascade,
  channel_name text, logo_media_id uuid references public.tv_media(id), background_media_id uuid references public.tv_media(id), colors jsonb not null default '{}', font_family text,
  opening_media_id uuid references public.tv_media(id), commercial_intro_media_id uuid references public.tv_media(id), commercial_outro_media_id uuid references public.tv_media(id),
  default_duration_seconds integer not null default 10, default_volume numeric(4,3) not null default 1,
  show_clock boolean not null default false, qr_code jsonb, footer jsonb, call_layout jsonb,
  empty_screen_behavior text not null default 'black' check (empty_screen_behavior = 'black'), settings jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id, display_id)
);
create table if not exists public.tv_call_templates (
  id uuid primary key default gen_random_uuid(), company_id text not null references public.business(cnpj), name text not null, template_type text not null default 'custom',
  primary_text text, secondary_text text, order_prefix text, show_name boolean not null default true, show_number boolean not null default true,
  background_color text, text_color text, logo_media_id uuid references public.tv_media(id), animation text, sound_media_id uuid references public.tv_media(id),
  volume numeric(4,3) not null default 1 check (volume between 0 and 1), duration_seconds integer not null default 8,
  repetitions integer not null default 1, layout jsonb not null default '{}', active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.tv_interruptions (
  id uuid primary key default gen_random_uuid(), company_id text not null references public.business(cnpj), display_id uuid not null references public.tv_displays(id) on delete cascade,
  interruption_type text not null check (interruption_type in ('urgent_notice','campaign')),
  source_id uuid, title text not null, subtitle text, priority integer not null default 0,
  requested_at timestamptz not null default now(), expires_at timestamptz, cancelled_at timestamptz,
  duration_seconds integer not null default 8, payload jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.tv_content_impressions (
  id uuid primary key default gen_random_uuid(), company_id text not null references public.business(cnpj), display_id uuid not null references public.tv_displays(id),
  media_id uuid references public.tv_media(id) on delete set null, campaign_id uuid references public.tv_campaigns(id) on delete set null,
  program_block_id uuid references public.tv_program_blocks(id) on delete set null,
  content_type text not null, started_at timestamptz not null default now(), completed_at timestamptz,
  interrupted_at timestamptz, resumed_at timestamptz,
  status text not null default 'started' check (status in ('started','completed','interrupted','skipped','failed','cancelled')),
  duration_seconds numeric(12,3), played_seconds numeric(12,3), error_message text, created_at timestamptz not null default now()
);

create index if not exists tv_programs_company_active_idx on public.tv_programs(company_id, active);
create index if not exists tv_program_blocks_program_position_idx on public.tv_program_blocks(program_id, position);
create index if not exists tv_program_items_program_position_idx on public.tv_program_items(program_id, position) where active;
create index if not exists tv_campaigns_due_idx on public.tv_campaigns(company_id, active, next_display_at);
create index if not exists tv_campaign_displays_display_idx on public.tv_campaign_displays(company_id, display_id);
create index if not exists tv_interruptions_queue_idx on public.tv_interruptions(company_id, display_id, requested_at, priority desc) where cancelled_at is null;
create index if not exists tv_impressions_daily_idx on public.tv_content_impressions(company_id, display_id, started_at desc);
create index if not exists tv_impressions_campaign_idx on public.tv_content_impressions(campaign_id, started_at desc) where campaign_id is not null;

-- Extend the existing media catalogue and retain media_url for backward compatibility.
alter table public.tv_media add column if not exists storage_provider text;
alter table public.tv_media add column if not exists storage_key text;
alter table public.tv_media add column if not exists storage_bucket text;
alter table public.tv_media add column if not exists public_url text;
alter table public.tv_media add column if not exists mime_type text;
alter table public.tv_media add column if not exists file_size bigint;
alter table public.tv_media add column if not exists r2_asset_id bigint references public.r2_media_assets(id) on delete set null;

create or replace function public.get_tv_player_payload(p_company_id text, p_display_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'companyId', p_company_id,
    'displayId', p_display_id::text,
    'syncedAt', now(),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'companyId', i.company_id, 'displayIds', i.display_ids,
        'durationSeconds', i.duration_seconds, 'volume', i.volume, 'muted', i.muted,
        'fit', i.image_fit, 'resumeBehavior', i.resume_behavior, 'active', i.active,
        'overlayText', i.overlay ->> 'text', 'qrCodeUrl', i.qr_code ->> 'url',
        'media', jsonb_build_object(
          'id', coalesce(m.id, i.id), 'companyId', i.company_id, 'type', i.content_type,
          'mediaUrl', m.media_url, 'publicUrl', coalesce(m.public_url, r.public_url), 'storageProvider', m.storage_provider,
          'storageKey', coalesce(m.storage_key, r.r2_key), 'storageBucket', m.storage_bucket, 'mimeType', coalesce(m.mime_type, r.mime_type),
          'title', coalesce(i.title, i.message_text, m.title, m.message_text)
        )
      ) order by b.position, i.position)
      from public.tv_program_items i
      join public.tv_programs p on p.id = i.program_id
      left join public.tv_program_blocks b on b.id = i.block_id
      left join public.tv_media m on m.id = i.media_id and m.company_id = i.company_id
      left join public.r2_media_assets r on r.id = m.r2_asset_id and r.business_cnpj = i.company_id
      where i.company_id = p_company_id and p.company_id = p_company_id
        and p.active and i.active and p_display_id = any(i.display_ids)
        and (p.starts_at is null or p.starts_at <= now()) and (p.ends_at is null or p.ends_at > now())
    ), '[]'::jsonb),
    'interruptions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'companyId', q.company_id, 'displayId', q.display_id,
        'kind', q.interruption_type, 'priority', q.priority, 'requestedAt', q.requested_at,
        'expiresAt', q.expires_at, 'cancelledAt', q.cancelled_at,
        'durationSeconds', q.duration_seconds, 'title', q.title, 'subtitle', q.subtitle
      ) order by q.priority desc, q.requested_at)
      from (
        select id, company_id, display_id, interruption_type, priority, requested_at, expires_at, cancelled_at, duration_seconds, title, subtitle
        from public.tv_interruptions
        union all
        select id, company_id, display_id, 'call', 1000, requested_at, null, case when status = 'cancelled' then completed_at end,
          coalesce((select call_duration_seconds from public.tv_displays d where d.id = c.display_id), 12), call_text, customer_name
        from public.tv_calls c where status = 'pending'
      ) q
      where q.company_id = p_company_id and q.display_id = p_display_id
        and q.cancelled_at is null and (q.expires_at is null or q.expires_at > now())
    ), '[]'::jsonb)
  )
  where p_company_id = (select public.get_current_user_cnpj())
     or (select public.get_current_user_type()) = 99999;
$$;
revoke all on function public.get_tv_player_payload(text, uuid) from public, anon;
grant execute on function public.get_tv_player_payload(text, uuid) to authenticated;

-- The project-provided helpers are deliberately required; authorization never trusts a client company_id alone.
do $$
declare table_name text;
begin
  if to_regprocedure('public.get_current_user_cnpj()') is null or to_regprocedure('public.get_current_user_type()') is null then
    raise exception 'Required Famintoos auth helpers get_current_user_cnpj() and get_current_user_type() were not found';
  end if;
  foreach table_name in array array['tv_programs','tv_program_blocks','tv_program_items','tv_campaigns','tv_campaign_displays','tv_commercial_breaks','tv_display_themes','tv_call_templates','tv_interruptions','tv_content_impressions'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (company_id = (select public.get_current_user_cnpj()) or (select public.get_current_user_type()) = 99999)', table_name || '_select_company', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (company_id = (select public.get_current_user_cnpj()) or (select public.get_current_user_type()) = 99999)', table_name || '_insert_company', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (company_id = (select public.get_current_user_cnpj()) or (select public.get_current_user_type()) = 99999) with check (company_id = (select public.get_current_user_cnpj()) or (select public.get_current_user_type()) = 99999)', table_name || '_update_company', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (company_id = (select public.get_current_user_cnpj()) or (select public.get_current_user_type()) = 99999)', table_name || '_delete_company', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end $$;

-- Realtime publication is idempotently extended for targeted player refreshes.
do $$
declare table_name text;
begin
  foreach table_name in array array['tv_programs','tv_program_items','tv_campaigns','tv_interruptions'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
