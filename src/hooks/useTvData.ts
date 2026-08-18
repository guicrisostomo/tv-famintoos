import { useCallback, useEffect, useState } from 'react'
import type { CaptionAnimation, CaptionDisplayStyle, CaptionFontFamily, CaptionFontSize, CaptionPosition } from '../domain/caption'
import type { WatermarkStyle } from '../domain/watermark'
import type { TvDateTimePosition, TvDateTimeTheme, TvDisplayMode } from '../domain/display'
import type { AudioPlaybackOrder, AudioRepeatMode } from '../domain/audioPlaylist'
import { supabase } from '../services/supabase'

export type { TvDateTimePosition, TvDateTimeTheme, TvDisplayMode } from '../domain/display'

export interface TvDisplayRecord {
  id: string
  company_id: string
  name: string
  description: string | null
  is_active: boolean
  sound_enabled: boolean
  continuous_audio_enabled: boolean
  continuous_audio_media_id: string | null
  continuous_audio_volume: number
  continuous_audio_order: AudioPlaybackOrder
  continuous_audio_repeat: AudioRepeatMode
  continuous_audio_media?: TvMediaRecord | null
  continuous_audio_tracks?: TvAudioTrackRecord[]
  display_mode: TvDisplayMode
  display_width: number
  display_height: number
  datetime_enabled: boolean
  datetime_show_date: boolean
  datetime_show_time: boolean
  datetime_show_seconds: boolean
  datetime_position: TvDateTimePosition
  datetime_theme: TvDateTimeTheme
  datetime_time_zone: string
}
export type ImageAnimation = 'none' | 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right'
export type TvImageFit = 'contain' | 'cover' | 'fill' | 'blur_background'
export type TvCaptionAnimation = CaptionAnimation
export type TvTransitionType = 'none' | 'fade' | 'slide_left' | 'slide_up' | 'zoom' | 'wipe'
export interface TvMediaRecord { id: string; company_id?: string; title: string; media_type: 'image' | 'video' | 'message' | 'audio'; media_url: string | null; message_text: string | null; duration_seconds: number | null; public_url: string | null; storage_provider: string | null; animation?: ImageAnimation; storage_key?: string | null; file_size?: number | null; r2_asset_id?: number | null; created_at?: string; starts_at?: string | null; ends_at?: string | null; weekdays?: number[]; start_time?: string | null; end_time?: string | null }
export interface TvAudioTrackRecord { id: string; display_id: string | null; playlist_item_id: string | null; media_id: string; position: number; volume: number; media: TvMediaRecord }
export interface TvPlaylistRecord { id: string; display_id: string; media_id: string; position: number; is_active: boolean; image_fit?: TvImageFit; caption_text?: string | null; caption_animation?: TvCaptionAnimation; caption_display_style?: CaptionDisplayStyle; caption_position?: CaptionPosition; caption_text_color?: string; caption_background_color?: string; caption_background_opacity?: number; caption_font_family?: CaptionFontFamily; caption_font_size?: CaptionFontSize; caption_ticker_speed_seconds?: number; transition_type?: TvTransitionType; transition_duration_ms?: number; watermark_enabled?: boolean; watermark_style?: WatermarkStyle; watermark_name?: string | null; watermark_logo_media_id?: string | null; watermark_logo_url?: string | null; watermark_phone?: string | null; watermark_extra_text?: string | null; watermark_qr_enabled?: boolean; watermark_qr_value?: string | null; watermark_logo?: TvMediaRecord | null; sound_media_id?: string | null; sound_volume?: number; sound_loop?: boolean; sound_order?: AudioPlaybackOrder; sound_repeat?: AudioRepeatMode; mute_original_audio?: boolean; sound_media?: TvMediaRecord | null; sound_tracks?: TvAudioTrackRecord[]; media: TvMediaRecord }

export const playlistCaptionSelect = 'caption_text,caption_animation,caption_display_style,caption_position,caption_text_color,caption_background_color,caption_background_opacity,caption_font_family,caption_font_size,caption_ticker_speed_seconds'
export const playlistPresentationSelect = 'transition_type,transition_duration_ms,watermark_enabled,watermark_style,watermark_name,watermark_logo_media_id,watermark_logo_url,watermark_phone,watermark_extra_text,watermark_qr_enabled,watermark_qr_value,watermark_logo:tv_media!tv_playlist_items_watermark_logo_media_id_fkey(id,title,media_type,media_url,message_text,duration_seconds,public_url,storage_provider)'

export function useTvData(companyId: string) {
  const [displays, setDisplays] = useState<TvDisplayRecord[]>([])
  const [items, setItems] = useState<TvPlaylistRecord[]>([])
  const [media, setMedia] = useState<TvMediaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!supabase) { setError('Supabase não configurado.'); setLoading(false); return }
    setLoading(true); setError(null)
    const [displayResult, playlistResult, mediaResult, audioTracksResult] = await Promise.all([
      supabase.from('tv_displays').select('id,company_id,name,description,is_active,sound_enabled,continuous_audio_enabled,continuous_audio_media_id,continuous_audio_volume,continuous_audio_order,continuous_audio_repeat,display_mode,display_width,display_height,datetime_enabled,datetime_show_date,datetime_show_time,datetime_show_seconds,datetime_position,datetime_theme,datetime_time_zone,continuous_audio_media:tv_media!tv_displays_continuous_audio_media_id_fkey(id,company_id,title,media_type,media_url,message_text,duration_seconds,public_url,storage_provider,storage_key,file_size,created_at)').eq('company_id', companyId).order('name'),
      supabase.from('tv_playlist_items').select(`id,display_id,media_id,position,is_active,image_fit,${playlistCaptionSelect},${playlistPresentationSelect},sound_media_id,sound_volume,sound_loop,sound_order,sound_repeat,mute_original_audio,media:tv_media!tv_playlist_items_media_id_fkey(id,title,media_type,media_url,message_text,duration_seconds,public_url,storage_provider,storage_key,animation,starts_at,ends_at,weekdays,start_time,end_time),sound_media:tv_media!tv_playlist_items_sound_media_id_fkey(id,title,media_type,media_url,message_text,duration_seconds,public_url,storage_provider,animation)`).eq('company_id', companyId).order('position'),
      supabase.from('tv_media').select('id,company_id,title,media_type,media_url,message_text,duration_seconds,public_url,storage_provider,animation,storage_key,file_size,r2_asset_id,created_at').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('tv_audio_playlist_tracks').select('id,display_id,playlist_item_id,media_id,position,volume,media:tv_media!tv_audio_playlist_tracks_media_id_fkey(id,company_id,title,media_type,media_url,message_text,duration_seconds,public_url,storage_provider,storage_key,file_size,created_at)').eq('company_id', companyId).order('position'),
    ])
    if (displayResult.error || playlistResult.error || mediaResult.error || audioTracksResult.error) setError(displayResult.error?.message ?? playlistResult.error?.message ?? mediaResult.error?.message ?? audioTracksResult.error?.message ?? 'Falha ao carregar dados da TV.')
    else {
      const tracks = audioTracksResult.data as unknown as TvAudioTrackRecord[]
      const tracksByDisplay = new Map<string, TvAudioTrackRecord[]>()
      const tracksByItem = new Map<string, TvAudioTrackRecord[]>()
      for (const track of tracks) {
        const target = track.display_id ? tracksByDisplay : tracksByItem
        const ownerId = track.display_id ?? track.playlist_item_id
        if (!ownerId) continue
        const grouped = target.get(ownerId) ?? []
        grouped.push(track)
        target.set(ownerId, grouped)
      }
      setDisplays((displayResult.data as unknown as TvDisplayRecord[]).map((display) => ({ ...display, continuous_audio_tracks: tracksByDisplay.get(display.id) ?? [] })))
      setItems((playlistResult.data as unknown as TvPlaylistRecord[]).map((item) => ({ ...item, sound_tracks: tracksByItem.get(item.id) ?? [] })))
      setMedia(mediaResult.data as TvMediaRecord[])
    }
    setLoading(false)
  }, [companyId])

  useEffect(() => { const timer = window.setTimeout(() => void reload(), 0); return () => window.clearTimeout(timer) }, [reload])
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    const channel = client.channel(`admin-tv:${companyId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'tv_displays', filter: `company_id=eq.${companyId}` }, () => void reload()).on('postgres_changes', { event: '*', schema: 'public', table: 'tv_playlist_items', filter: `company_id=eq.${companyId}` }, () => void reload()).on('postgres_changes', { event: '*', schema: 'public', table: 'tv_media', filter: `company_id=eq.${companyId}` }, () => void reload()).on('postgres_changes', { event: '*', schema: 'public', table: 'tv_audio_playlist_tracks', filter: `company_id=eq.${companyId}` }, () => void reload()).subscribe()
    return () => { void client.removeChannel(channel) }
  }, [companyId, reload])
  return { displays, items, media, loading, error, reload }
}
