create index if not exists tv_audio_tracks_media_idx
  on public.tv_audio_playlist_tracks(media_id);

alter policy tv_audio_tracks_select_company
  on public.tv_audio_playlist_tracks
  using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and company_id = (select public.get_current_active_company_id())
  );

alter policy tv_audio_tracks_insert_company
  on public.tv_audio_playlist_tracks
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

alter policy tv_audio_tracks_update_company
  on public.tv_audio_playlist_tracks
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

alter policy tv_audio_tracks_delete_company
  on public.tv_audio_playlist_tracks
  using (
    coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and company_id = (select public.get_current_active_company_id())
  );
