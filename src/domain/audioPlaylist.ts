import type { TvMediaRecord } from '../hooks/useTvData'

export type AudioPlaybackOrder = 'sequential' | 'shuffle'
export type AudioRepeatMode = 'all' | 'one' | 'none'

export interface AudioPlaylistTrack {
  id?: string
  mediaId: string
  media: TvMediaRecord
  volume: number
}

export interface AudioPlaylistSettings {
  tracks: AudioPlaylistTrack[]
  volume: number
  order: AudioPlaybackOrder
  repeat: AudioRepeatMode
  videoAudioMode: 'original' | 'muted' | 'replace'
}

export function moveAudioTrack(tracks: AudioPlaylistTrack[], from: number, to: number) {
  if (to < 0 || to >= tracks.length || from === to) return tracks
  const next = [...tracks]
  const [track] = next.splice(from, 1)
  next.splice(to, 0, track)
  return next
}
