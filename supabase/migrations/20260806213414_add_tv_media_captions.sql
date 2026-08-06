alter table public.tv_playlist_items
  add column if not exists caption_text text,
  add column if not exists caption_animation text not null default 'none';

alter table public.tv_playlist_items
  drop constraint if exists tv_playlist_items_caption_animation_check;
alter table public.tv_playlist_items
  add constraint tv_playlist_items_caption_animation_check
  check (caption_animation in ('none', 'fade', 'slide_up', 'pulse'));

comment on column public.tv_playlist_items.caption_text is
  'Optional caption displayed over an image or video.';
comment on column public.tv_playlist_items.caption_animation is
  'Caption animation: none, fade, slide_up or pulse.';
