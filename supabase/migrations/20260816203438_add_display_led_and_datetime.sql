alter table public.tv_displays
  add column if not exists display_mode text not null default 'tv',
  add column if not exists display_width integer not null default 1920,
  add column if not exists display_height integer not null default 1080,
  add column if not exists datetime_enabled boolean not null default false,
  add column if not exists datetime_show_date boolean not null default true,
  add column if not exists datetime_show_time boolean not null default true,
  add column if not exists datetime_show_seconds boolean not null default false,
  add column if not exists datetime_position text not null default 'top_right',
  add column if not exists datetime_theme text not null default 'dark',
  add column if not exists datetime_time_zone text not null default 'America/Sao_Paulo';

alter table public.tv_displays
  drop constraint if exists tv_displays_display_mode_check,
  drop constraint if exists tv_displays_display_dimensions_check,
  drop constraint if exists tv_displays_datetime_content_check,
  drop constraint if exists tv_displays_datetime_position_check,
  drop constraint if exists tv_displays_datetime_theme_check,
  drop constraint if exists tv_displays_datetime_time_zone_check;

alter table public.tv_displays
  add constraint tv_displays_display_mode_check
    check (display_mode in ('tv', 'led')),
  add constraint tv_displays_display_dimensions_check
    check (display_width between 64 and 16384 and display_height between 64 and 16384),
  add constraint tv_displays_datetime_content_check
    check (not datetime_enabled or datetime_show_date or datetime_show_time),
  add constraint tv_displays_datetime_position_check
    check (datetime_position in ('top_left', 'top_center', 'top_right', 'bottom_left', 'bottom_center', 'bottom_right')),
  add constraint tv_displays_datetime_theme_check
    check (datetime_theme in ('dark', 'light', 'brand', 'minimal')),
  add constraint tv_displays_datetime_time_zone_check
    check (char_length(datetime_time_zone) between 1 and 64);

comment on column public.tv_displays.display_mode is 'Tipo de saída: TV convencional ou painel de LED.';
comment on column public.tv_displays.display_width is 'Largura lógica, em pixels, da matriz de exibição.';
comment on column public.tv_displays.display_height is 'Altura lógica, em pixels, da matriz de exibição.';
