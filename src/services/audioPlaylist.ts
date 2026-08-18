import type { AudioPlaylistTrack } from '../domain/audioPlaylist'
import { supabase } from './supabase'

export async function replaceAudioPlaylistTracks({
  companyId,
  displayId = null,
  playlistItemId = null,
  tracks,
}: {
  companyId: string
  displayId?: string | null
  playlistItemId?: string | null
  tracks: AudioPlaylistTrack[]
}) {
  if (!supabase) throw new Error('Supabase não configurado.')
  const { error } = await supabase.rpc('replace_tv_audio_playlist_tracks', {
    p_company_id: companyId,
    p_display_id: displayId,
    p_playlist_item_id: playlistItemId,
    p_tracks: tracks.map((track) => ({ media_id: track.mediaId, volume: track.volume })),
  })
  if (error) throw error
}
