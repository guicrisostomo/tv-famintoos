-- Optional recurring schedule for playlist media. Null/empty values mean always visible.
alter table public.tv_media add column if not exists starts_at timestamptz;
alter table public.tv_media add column if not exists ends_at timestamptz;
alter table public.tv_media add column if not exists weekdays smallint[] not null default '{}';
alter table public.tv_media add column if not exists start_time time;
alter table public.tv_media add column if not exists end_time time;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tv_media_schedule_dates_valid') then
    alter table public.tv_media add constraint tv_media_schedule_dates_valid check (ends_at is null or starts_at is null or ends_at >= starts_at);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tv_media_weekdays_valid') then
    alter table public.tv_media add constraint tv_media_weekdays_valid check (weekdays <@ array[0,1,2,3,4,5,6]::smallint[]);
  end if;
end $$;
