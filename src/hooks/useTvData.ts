import { useCallback, useEffect, useState } from 'react'
import type { WatermarkStyle } from '../domain/watermark'
import { supabase } from '../services/supabase'

export interface TvDisplayRecord { id: string; company_id: string; name: string; description: string | null; is_active: boolean; sound_enabled: boolean }
export type ImageAnimation = 'none' | 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right'
export type TvImageFit = 'contain' | 'cover' | 'fill' | 'blur_background'
export type TvCaptionAnimation = 'none' | 'fade' | 'slide_up' | 'pulse'
export type TvTransitionType = 'none' | 'fade' | 'slide_left' | 'slide_up' | 'zoom' | 'wipe'
export interface TvMediaRecord { id: string; company_id?: string; title: string; media_type: 'image' | 'video' | 'message' | 'audio'; media_url: string | null; message_text: string | null; duration_seconds: number | null; public_url: string | null; storage_provider: string | null; animation?: ImageAnimation; storage_key?: string | null; file_size?: number | null; r2_asset_id?: number | null; created_at?: string; starts_at?: string | null; ends_at?: string | null; weekdays?: number[]; start_time?: string | null; end_time?: string | null }
export interface TvPlaylistRecord { id: string; display_id: string; media_id: string; position: number; is_active: boolean; image_fit?: TvImageFit; caption_text?: string | null; caption_animation?: TvCaptionAnimation; transition_type?: TvTransitionType; transition_duration_ms?: number; watermark_enabled?: boolean; watermark_style?: WatermarkStyle; watermark_name?: string | null; watermark_logo_media_id?: string | null; watermark_logo_url?: string | null; watermark_phone?: string | null; watermark_extra_text?: string | null; watermark_qr_enabled?: boolean; watermark_qr_value?: string | null; watermark_logo?: TvMediaRecord | null; sound_media_id?: string | null; sound_volume?: number; sound_loop?: boolean; mute_original_audio?: boolean; sound_media?: TvMediaRecord | null; media: TvMediaRecord }

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
    const [displayResult, playlistResult, mediaResult] = await Promise.all([
      supabase.from('tv_displays').select('id,company_id,name,description,is_active,sound_enabled').eq('company_id', companyId).order('name'),
      supabase.from('tv_playlist_items').select(`id,display_id,media_id,position,is_active,image_fit,caption_text,caption_animation,${playlistPresentationSelect},sound_media_id,sound_volume,sound_loop,mute_original_audio,media:tv_media!tv_playlist_items_media_id_fkey(id,title,media_type,media_url,message_text,duration_seconds,public_url,storage_provider,storage_key,animation,starts_at,ends_at,weekdays,start_time,end_time),sound_media:tv_media!tv_playlist_items_sound_media_id_fkey(id,title,media_type,media_url,message_text,duration_seconds,public_url,storage_provider,animation)`).eq('company_id', companyId).order('position'),
      supabase.from('tv_media').select('id,company_id,title,media_type,media_url,message_text,duration_seconds,public_url,storage_provider,animation,storage_key,file_size,r2_asset_id,created_at').eq('company_id', companyId).order('created_at', { ascending: false }),
    ])
    if (displayResult.error || playlistResult.error || mediaResult.error) setError(displayResult.error?.message ?? playlistResult.error?.message ?? mediaResult.error?.message ?? 'Falha ao carregar dados da TV.')
    else { setDisplays(displayResult.data as TvDisplayRecord[]); setItems(playlistResult.data as unknown as TvPlaylistRecord[]); setMedia(mediaResult.data as TvMediaRecord[]) }
    setLoading(false)
  }, [companyId])

  useEffect(() => { const timer = window.setTimeout(() => void reload(), 0); return () => window.clearTimeout(timer) }, [reload])
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    const channel = client.channel(`admin-tv:${companyId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'tv_displays', filter: `company_id=eq.${companyId}` }, () => void reload()).on('postgres_changes', { event: '*', schema: 'public', table: 'tv_playlist_items', filter: `company_id=eq.${companyId}` }, () => void reload()).on('postgres_changes', { event: '*', schema: 'public', table: 'tv_media', filter: `company_id=eq.${companyId}` }, () => void reload()).subscribe()
    return () => { void client.removeChannel(channel) }
  }, [companyId, reload])
  return { displays, items, media, loading, error, reload }
}
