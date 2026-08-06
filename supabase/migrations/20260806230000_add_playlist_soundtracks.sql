alter table public.tv_media drop constraint if exists tv_media_media_type_check;
alter table public.tv_media add constraint tv_media_media_type_check
  check (media_type in ('image', 'video', 'message', 'audio'));

alter table public.tv_media drop constraint if exists tv_media_content_check;
alter table public.tv_media add constraint tv_media_content_check check (
  (media_type in ('image', 'video', 'audio') and media_url is not null)
  or (media_type = 'message' and message_text is not null)
);

alter table public.tv_playlist_items
  add column if not exists sound_media_id uuid references public.tv_media(id) on delete set null,
  add column if not exists sound_volume numeric(4,3) not null default 0.7,
  add column if not exists sound_loop boolean not null default true,
  add column if not exists mute_original_audio boolean not null default false;

alter table public.tv_playlist_items drop constraint if exists tv_playlist_items_sound_volume_check;
alter table public.tv_playlist_items add constraint tv_playlist_items_sound_volume_check check (sound_volume between 0 and 1);

create or replace function public.enforce_tv_playlist_sound_company()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.sound_media_id is not null and not exists (
    select 1 from public.tv_media m
    where m.id = new.sound_media_id and m.company_id = new.company_id and m.media_type = 'audio'
  ) then
    raise exception 'O som precisa pertencer à mesma empresa e ser do tipo áudio.';
  end if;
  return new;
end;
$$;

drop trigger if exists tv_playlist_sound_company on public.tv_playlist_items;
create trigger tv_playlist_sound_company before insert or update of sound_media_id, company_id
on public.tv_playlist_items for each row execute function public.enforce_tv_playlist_sound_company();
