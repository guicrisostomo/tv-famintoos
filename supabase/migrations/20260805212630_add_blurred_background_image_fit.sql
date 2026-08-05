-- Adds a TV-safe layout for portrait/square artwork without modifying the source file.
alter table public.tv_playlist_items
  add column if not exists image_fit text not null default 'contain';

alter table public.tv_playlist_items
  drop constraint if exists tv_playlist_items_image_fit_check;
alter table public.tv_playlist_items
  add constraint tv_playlist_items_image_fit_check
  check (image_fit in ('contain', 'cover', 'fill', 'blur_background'));

alter table public.tv_program_items
  drop constraint if exists tv_program_items_image_fit_check;
alter table public.tv_program_items
  add constraint tv_program_items_image_fit_check
  check (image_fit in ('contain', 'cover', 'fill', 'blur_background'));

comment on column public.tv_playlist_items.image_fit is
  'TV image layout. blur_background centers the full artwork over a dark blurred copy.';
