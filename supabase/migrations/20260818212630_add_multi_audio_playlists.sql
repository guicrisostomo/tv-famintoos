alter table public.tv_displays
  add column if not exists continuous_audio_order text not null default 'sequential',
  add column if not exists continuous_audio_repeat text not null default 'all';

alter table public.tv_playlist_items
  add column if not exists sound_order text not null default 'sequential',
  add column if not exists sound_repeat text not null default 'all';

alter table public.tv_displays
  drop constraint if exists tv_displays_continuous_audio_order_check,
  drop constraint if exists tv_displays_continuous_audio_repeat_check;

alter table public.tv_displays
  add constraint tv_displays_continuous_audio_order_check
    check (continuous_audio_order in ('sequential', 'shuffle')),
  add constraint tv_displays_continuous_audio_repeat_check
    check (continuous_audio_repeat in ('all', 'one', 'none'));

alter table public.tv_playlist_items
  drop constraint if exists tv_playlist_items_sound_order_check,
  drop constraint if exists tv_playlist_items_sound_repeat_check;

alter table public.tv_playlist_items
  add constraint tv_playlist_items_sound_order_check
    check (sound_order in ('sequential', 'shuffle')),
  add constraint tv_playlist_items_sound_repeat_check
    check (sound_repeat in ('all', 'one', 'none'));

create table if not exists public.tv_audio_playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  display_id uuid references public.tv_displays(id) on delete cascade,
  playlist_item_id uuid references public.tv_playlist_items(id) on delete cascade,
  media_id uuid not null references public.tv_media(id) on delete cascade,
  position integer not null default 0,
  volume numeric(4,3) not null default 1.000,
  created_at timestamptz not null default now(),
  constraint tv_audio_playlist_tracks_one_owner_check
    check (num_nonnulls(display_id, playlist_item_id) = 1),
  constraint tv_audio_playlist_tracks_position_check
    check (position >= 0),
  constraint tv_audio_playlist_tracks_volume_check
    check (volume between 0 and 1)
);

create unique index if not exists tv_audio_tracks_display_media_unique
  on public.tv_audio_playlist_tracks(display_id, media_id)
  where display_id is not null;

create unique index if not exists tv_audio_tracks_item_media_unique
  on public.tv_audio_playlist_tracks(playlist_item_id, media_id)
  where playlist_item_id is not null;

create index if not exists tv_audio_tracks_display_position_idx
  on public.tv_audio_playlist_tracks(display_id, position)
  where display_id is not null;

create index if not exists tv_audio_tracks_item_position_idx
  on public.tv_audio_playlist_tracks(playlist_item_id, position)
  where playlist_item_id is not null;

create index if not exists tv_audio_tracks_company_idx
  on public.tv_audio_playlist_tracks(company_id);

create index if not exists tv_audio_tracks_media_idx
  on public.tv_audio_playlist_tracks(media_id);

alter table public.tv_audio_playlist_tracks enable row level security;

drop policy if exists tv_audio_tracks_select_company on public.tv_audio_playlist_tracks;
create policy tv_audio_tracks_select_company
  on public.tv_audio_playlist_tracks for select to authenticated
  using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and company_id = (select public.get_current_active_company_id())
  );

drop policy if exists tv_audio_tracks_insert_company on public.tv_audio_playlist_tracks;
create policy tv_audio_tracks_insert_company
  on public.tv_audio_playlist_tracks for insert to authenticated
  with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and company_id = (select public.get_current_active_company_id())
    and exists (
      select 1 from public.tv_media media
      where media.id = tv_audio_playlist_tracks.media_id
        and media.company_id = tv_audio_playlist_tracks.company_id
        and media.media_type = 'audio'
        and media.is_active
    )
    and (
      (
        display_id is not null and playlist_item_id is null
        and exists (
          select 1 from public.tv_displays display
          where display.id = tv_audio_playlist_tracks.display_id
            and display.company_id = tv_audio_playlist_tracks.company_id
        )
      )
      or
      (
        playlist_item_id is not null and display_id is null
        and exists (
          select 1 from public.tv_playlist_items item
          where item.id = tv_audio_playlist_tracks.playlist_item_id
            and item.company_id = tv_audio_playlist_tracks.company_id
        )
      )
    )
  );

drop policy if exists tv_audio_tracks_update_company on public.tv_audio_playlist_tracks;
create policy tv_audio_tracks_update_company
  on public.tv_audio_playlist_tracks for update to authenticated
  using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and company_id = (select public.get_current_active_company_id())
  )
  with check (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and company_id = (select public.get_current_active_company_id())
    and exists (
      select 1 from public.tv_media media
      where media.id = tv_audio_playlist_tracks.media_id
        and media.company_id = tv_audio_playlist_tracks.company_id
        and media.media_type = 'audio'
        and media.is_active
    )
    and (
      (
        display_id is not null and playlist_item_id is null
        and exists (
          select 1 from public.tv_displays display
          where display.id = tv_audio_playlist_tracks.display_id
            and display.company_id = tv_audio_playlist_tracks.company_id
        )
      )
      or
      (
        playlist_item_id is not null and display_id is null
        and exists (
          select 1 from public.tv_playlist_items item
          where item.id = tv_audio_playlist_tracks.playlist_item_id
            and item.company_id = tv_audio_playlist_tracks.company_id
        )
      )
    )
  );

drop policy if exists tv_audio_tracks_delete_company on public.tv_audio_playlist_tracks;
create policy tv_audio_tracks_delete_company
  on public.tv_audio_playlist_tracks for delete to authenticated
  using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and company_id = (select public.get_current_active_company_id())
  );

grant select, insert, update, delete on table public.tv_audio_playlist_tracks to authenticated;

create or replace function public.replace_tv_audio_playlist_tracks(
  p_company_id text,
  p_display_id uuid default null,
  p_playlist_item_id uuid default null,
  p_tracks jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_company_id is distinct from (select public.get_current_active_company_id()) then
    raise exception 'Empresa não autorizada.';
  end if;
  if num_nonnulls(p_display_id, p_playlist_item_id) <> 1 then
    raise exception 'Informe uma TV ou um conteúdo, exclusivamente.';
  end if;
  if jsonb_typeof(coalesce(p_tracks, '[]'::jsonb)) <> 'array' then
    raise exception 'A lista de músicas precisa ser um array.';
  end if;

  delete from public.tv_audio_playlist_tracks tracks
  where tracks.company_id = p_company_id
    and (
      (p_display_id is not null and tracks.display_id = p_display_id)
      or (p_playlist_item_id is not null and tracks.playlist_item_id = p_playlist_item_id)
    );

  insert into public.tv_audio_playlist_tracks (
    company_id,
    display_id,
    playlist_item_id,
    media_id,
    position,
    volume
  )
  select
    p_company_id,
    p_display_id,
    p_playlist_item_id,
    (entry.value ->> 'media_id')::uuid,
    entry.ordinality - 1,
    greatest(0, least(1, coalesce((entry.value ->> 'volume')::numeric, 1)))
  from jsonb_array_elements(coalesce(p_tracks, '[]'::jsonb)) with ordinality as entry(value, ordinality);
end;
$$;

revoke all on function public.replace_tv_audio_playlist_tracks(text, uuid, uuid, jsonb) from public, anon;
grant execute on function public.replace_tv_audio_playlist_tracks(text, uuid, uuid, jsonb) to authenticated;

insert into public.tv_audio_playlist_tracks (company_id, display_id, media_id, position)
select display.company_id, display.id, display.continuous_audio_media_id, 0
from public.tv_displays display
where display.continuous_audio_media_id is not null
on conflict do nothing;

insert into public.tv_audio_playlist_tracks (company_id, playlist_item_id, media_id, position)
select item.company_id, item.id, item.sound_media_id, 0
from public.tv_playlist_items item
where item.sound_media_id is not null
on conflict do nothing;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tv_audio_playlist_tracks'
  ) then
    alter publication supabase_realtime add table public.tv_audio_playlist_tracks;
  end if;
end
$$;

comment on table public.tv_audio_playlist_tracks is
  'Faixas de áudio ordenadas de uma TV ou de um conteúdo da programação.';
comment on column public.tv_displays.continuous_audio_order is
  'Ordem de reprodução da trilha geral: sequencial ou aleatória.';
comment on column public.tv_playlist_items.sound_order is
  'Ordem de reprodução das faixas associadas ao conteúdo.';
