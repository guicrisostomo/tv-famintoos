alter table public.tv_displays
  add column if not exists continuous_audio_enabled boolean not null default false,
  add column if not exists continuous_audio_media_id uuid,
  add column if not exists continuous_audio_volume numeric(4,3) not null default 0.700;

alter table public.tv_displays
  drop constraint if exists tv_displays_continuous_audio_media_id_fkey;

alter table public.tv_displays
  add constraint tv_displays_continuous_audio_media_id_fkey
  foreign key (continuous_audio_media_id)
  references public.tv_media(id)
  on delete set null;

alter table public.tv_displays
  drop constraint if exists tv_displays_continuous_audio_volume_check;

alter table public.tv_displays
  add constraint tv_displays_continuous_audio_volume_check
  check (continuous_audio_volume between 0 and 1);

create or replace function public.enforce_tv_display_continuous_audio_company()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.continuous_audio_media_id is not null and not exists (
    select 1
    from public.tv_media media
    where media.id = new.continuous_audio_media_id
      and media.company_id = new.company_id
      and media.media_type = 'audio'
      and media.is_active = true
  ) then
    raise exception 'A trilha contínua deve ser um áudio ativo da mesma empresa.';
  end if;
  return new;
end;
$$;

drop trigger if exists tv_displays_continuous_audio_company on public.tv_displays;
create trigger tv_displays_continuous_audio_company
before insert or update of continuous_audio_media_id, company_id
on public.tv_displays
for each row
execute function public.enforce_tv_display_continuous_audio_company();
