alter table public.tv_playlist_items
  add column if not exists caption_display_style text not null default 'compact',
  add column if not exists caption_position text not null default 'bottom',
  add column if not exists caption_text_color text not null default '#ffffff',
  add column if not exists caption_background_color text not null default '#000000',
  add column if not exists caption_background_opacity integer not null default 72,
  add column if not exists caption_font_family text not null default 'display',
  add column if not exists caption_font_size text not null default 'medium',
  add column if not exists caption_ticker_speed_seconds integer not null default 18;

alter table public.tv_playlist_items
  drop constraint if exists tv_playlist_items_caption_display_style_check,
  drop constraint if exists tv_playlist_items_caption_position_check,
  drop constraint if exists tv_playlist_items_caption_text_color_check,
  drop constraint if exists tv_playlist_items_caption_background_color_check,
  drop constraint if exists tv_playlist_items_caption_background_opacity_check,
  drop constraint if exists tv_playlist_items_caption_font_family_check,
  drop constraint if exists tv_playlist_items_caption_font_size_check,
  drop constraint if exists tv_playlist_items_caption_ticker_speed_check;

alter table public.tv_playlist_items
  add constraint tv_playlist_items_caption_display_style_check
    check (caption_display_style in ('compact', 'bar', 'ticker')),
  add constraint tv_playlist_items_caption_position_check
    check (caption_position in ('top', 'middle', 'bottom')),
  add constraint tv_playlist_items_caption_text_color_check
    check (caption_text_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint tv_playlist_items_caption_background_color_check
    check (caption_background_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint tv_playlist_items_caption_background_opacity_check
    check (caption_background_opacity between 0 and 100),
  add constraint tv_playlist_items_caption_font_family_check
    check (caption_font_family in ('sans', 'display', 'serif', 'mono')),
  add constraint tv_playlist_items_caption_font_size_check
    check (caption_font_size in ('small', 'medium', 'large')),
  add constraint tv_playlist_items_caption_ticker_speed_check
    check (caption_ticker_speed_seconds between 6 and 60);

comment on column public.tv_playlist_items.caption_display_style is
  'Caption layout: compact box, full-width bar or continuous ticker.';
comment on column public.tv_playlist_items.caption_position is
  'Vertical caption position: top, middle or bottom.';
comment on column public.tv_playlist_items.caption_text_color is
  'Caption text color in six-digit hexadecimal format.';
comment on column public.tv_playlist_items.caption_background_color is
  'Caption background color in six-digit hexadecimal format.';
comment on column public.tv_playlist_items.caption_background_opacity is
  'Caption background opacity from 0 to 100.';
comment on column public.tv_playlist_items.caption_font_family is
  'Caption font preset: sans, display, serif or mono.';
comment on column public.tv_playlist_items.caption_font_size is
  'Caption font size preset: small, medium or large.';
comment on column public.tv_playlist_items.caption_ticker_speed_seconds is
  'Seconds used for each complete ticker animation cycle.';
