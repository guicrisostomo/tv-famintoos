alter table public.tv_playlist_items
  add column if not exists transition_type text not null default 'none',
  add column if not exists transition_duration_ms integer not null default 700,
  add column if not exists watermark_enabled boolean not null default false,
  add column if not exists watermark_name text,
  add column if not exists watermark_logo_media_id uuid references public.tv_media(id) on delete set null,
  add column if not exists watermark_phone text,
  add column if not exists watermark_extra_text text;

alter table public.tv_playlist_items
  drop constraint if exists tv_playlist_items_transition_type_check;
alter table public.tv_playlist_items
  add constraint tv_playlist_items_transition_type_check
  check (transition_type in ('none', 'fade', 'slide_left', 'slide_up', 'zoom', 'wipe'));

alter table public.tv_playlist_items
  drop constraint if exists tv_playlist_items_transition_duration_check;
alter table public.tv_playlist_items
  add constraint tv_playlist_items_transition_duration_check
  check (transition_duration_ms between 200 and 2500);

alter table public.tv_playlist_items
  drop constraint if exists tv_playlist_items_watermark_content_check;
alter table public.tv_playlist_items
  add constraint tv_playlist_items_watermark_content_check check (
    char_length(coalesce(watermark_name, '')) <= 80
    and char_length(coalesce(watermark_phone, '')) <= 40
    and char_length(coalesce(watermark_extra_text, '')) <= 160
    and (
      not watermark_enabled
      or watermark_logo_media_id is not null
      or nullif(btrim(coalesce(watermark_name, '')), '') is not null
      or nullif(btrim(coalesce(watermark_phone, '')), '') is not null
      or nullif(btrim(coalesce(watermark_extra_text, '')), '') is not null
    )
  );

create or replace function public.enforce_tv_playlist_watermark_company()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.watermark_logo_media_id is not null and not exists (
    select 1
    from public.tv_media m
    where m.id = new.watermark_logo_media_id
      and m.company_id = new.company_id
      and m.media_type = 'image'
      and m.is_active
  ) then
    raise exception 'O logo da marca d''agua precisa ser uma imagem ativa da mesma empresa.';
  end if;
  return new;
end;
$$;

drop trigger if exists tv_playlist_watermark_company on public.tv_playlist_items;
create trigger tv_playlist_watermark_company
before insert or update of watermark_logo_media_id, company_id
on public.tv_playlist_items
for each row execute function public.enforce_tv_playlist_watermark_company();

create index if not exists tv_playlist_items_watermark_logo_idx
on public.tv_playlist_items(watermark_logo_media_id)
where watermark_logo_media_id is not null;

comment on column public.tv_playlist_items.transition_type is
  'Entrance transition: none, fade, slide_left, slide_up, zoom or wipe.';
comment on column public.tv_playlist_items.transition_duration_ms is
  'Entrance transition duration in milliseconds.';
comment on column public.tv_playlist_items.watermark_enabled is
  'Displays the configured business signature at the bottom of this content.';
