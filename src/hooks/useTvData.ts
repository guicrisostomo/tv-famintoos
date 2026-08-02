import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../services/supabase'

export interface TvDisplayRecord { id: string; company_id: string; name: string; description: string | null; is_active: boolean }
export interface TvMediaRecord { id: string; title: string; media_type: 'image' | 'video' | 'message'; media_url: string | null; message_text: string | null; duration_seconds: number | null; public_url: string | null; storage_provider: string | null }
export interface TvPlaylistRecord { id: string; display_id: string; media_id: string; position: number; is_active: boolean; media: TvMediaRecord }

export function useTvData(companyId: string) {
  const [displays, setDisplays] = useState<TvDisplayRecord[]>([])
  const [items, setItems] = useState<TvPlaylistRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!supabase) { setError('Supabase não configurado.'); setLoading(false); return }
    setLoading(true); setError(null)
    const [displayResult, playlistResult] = await Promise.all([
      supabase.from('tv_displays').select('id,company_id,name,description,is_active').eq('company_id', companyId).order('name'),
      supabase.from('tv_playlist_items').select('id,display_id,media_id,position,is_active,media:tv_media(id,title,media_type,media_url,message_text,duration_seconds,public_url,storage_provider)').eq('company_id', companyId).order('position'),
    ])
    if (displayResult.error || playlistResult.error) setError(displayResult.error?.message ?? playlistResult.error?.message ?? 'Falha ao carregar dados da TV.')
    else { setDisplays(displayResult.data as TvDisplayRecord[]); setItems(playlistResult.data as unknown as TvPlaylistRecord[]) }
    setLoading(false)
  }, [companyId])

  useEffect(() => { const timer = window.setTimeout(() => void reload(), 0); return () => window.clearTimeout(timer) }, [reload])
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    const channel = client.channel(`admin-tv:${companyId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'tv_displays', filter: `company_id=eq.${companyId}` }, () => void reload()).on('postgres_changes', { event: '*', schema: 'public', table: 'tv_playlist_items', filter: `company_id=eq.${companyId}` }, () => void reload()).subscribe()
    return () => { void client.removeChannel(channel) }
  }, [companyId, reload])
  return { displays, items, loading, error, reload }
}
