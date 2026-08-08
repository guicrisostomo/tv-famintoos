-- Removing a catalogue item must also stop playback on every linked TV.
alter table public.tv_playlist_items
  drop constraint if exists tv_playlist_items_media_id_fkey;
alter table public.tv_playlist_items
  add constraint tv_playlist_items_media_id_fkey
  foreign key (media_id) references public.tv_media(id) on delete cascade;

alter table public.tv_playlist_items
  drop constraint if exists tv_playlist_items_sound_media_id_fkey;
alter table public.tv_playlist_items
  add constraint tv_playlist_items_sound_media_id_fkey
  foreign key (sound_media_id) references public.tv_media(id) on delete set null;
