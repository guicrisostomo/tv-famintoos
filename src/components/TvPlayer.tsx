import { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { Interruption, PlayerPayload, ProgramItem } from '../domain/tv'
import { isPlayableMedia, resolveMediaUrl } from '../services/media'
import { readPayload, readPlayback, savePayload, savePlayback } from '../services/playerCache'
import { selectNextInterruption } from '../services/playerQueue'
import { supabase } from '../services/supabase'
import type { TvPlaylistRecord } from '../hooks/useTvData'

export function TvPlayer({ companyId, displayId }: { companyId: string, displayId: string }) {
  const [activated, setActivated] = useState(false)
  const [payload, setPayload] = useState<PlayerPayload | null>(() => readPayload(companyId, displayId))
  const [index, setIndex] = useState(() => readPlayback(companyId, displayId)?.itemIndex ?? 0)
  const [interruptions, setInterruptions] = useState<Interruption[]>([])
  const [activeInterruption, setActiveInterruption] = useState<Interruption | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const load = useCallback(async () => {
    if (!supabase || !companyId || !displayId) return
    const [programResult, playlistResult] = await Promise.all([
      supabase.rpc('get_tv_player_payload', { p_company_id: companyId, p_display_id: displayId }),
      supabase.from('tv_playlist_items').select('id,display_id,media_id,position,is_active,media:tv_media(id,title,media_type,media_url,message_text,duration_seconds,public_url,storage_provider)').eq('company_id', companyId).eq('display_id', displayId).eq('is_active', true).order('position'),
    ])
    if (programResult.error && playlistResult.error) return
    const programPayload = programResult.data as PlayerPayload | null
    const legacyItems = ((playlistResult.data ?? []) as unknown as TvPlaylistRecord[]).map(item => ({ id: item.id, companyId, displayIds: [displayId], durationSeconds: item.media.duration_seconds ?? 10, volume: 1, muted: true, fit: 'contain' as const, resumeBehavior: 'resume' as const, active: item.is_active, media: { id: item.media.id, companyId, type: item.media.media_type, mediaUrl: item.media.media_url, publicUrl: item.media.public_url, storageProvider: item.media.storage_provider as 'cloudflare_r2' | 'supabase_storage' | 'external_url' | null, title: item.media.media_type === 'message' ? item.media.message_text : item.media.title } }))
    const known = new Set(legacyItems.map(item => item.id))
    const programItems = (programPayload?.items ?? []).filter(item => !known.has(item.id))
    const next: PlayerPayload = { companyId, displayId, items: [...legacyItems, ...programItems], interruptions: programPayload?.interruptions ?? [], syncedAt: new Date().toISOString() }
    setPayload(next); setInterruptions(next.interruptions ?? []); savePayload(next)
  }, [companyId, displayId])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])
  useEffect(() => {
    if (!supabase || !companyId || !displayId) return
    const client = supabase
    const channel = client.channel(`tv:${companyId}:${displayId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'tv_programs', filter: `company_id=eq.${companyId}` }, () => void load()).on('postgres_changes', { event: '*', schema: 'public', table: 'tv_playlist_items', filter: `display_id=eq.${displayId}` }, () => void load()).on('postgres_changes', { event: '*', schema: 'public', table: 'tv_media', filter: `company_id=eq.${companyId}` }, () => void load()).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tv_interruptions', filter: `display_id=eq.${displayId}` }, () => void load()).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tv_calls', filter: `display_id=eq.${displayId}` }, () => void load()).subscribe()
    return () => { void client.removeChannel(channel) }
  }, [companyId, displayId, load])

  const items = (payload?.items ?? []).filter(item => item.companyId === companyId && item.displayIds.includes(displayId) && item.active && isPlayableMedia(item.media))
  const current = items[index % Math.max(items.length, 1)]

  useEffect(() => {
    if (!activated || activeInterruption) return
    const next = selectNextInterruption(interruptions)
    if (!next) return
    const startTimer = window.setTimeout(() => {
      savePlayback(companyId, displayId, { itemId: current?.id ?? '', itemIndex: index, elapsedSeconds: videoRef.current?.currentTime ?? 0, savedAt: new Date().toISOString() })
      videoRef.current?.pause()
      setActiveInterruption(next)
      if (next.kind === 'call' && supabase) void supabase.from('tv_calls').update({ status: 'showing', displayed_at: new Date().toISOString() }).eq('id', next.id).eq('company_id', companyId)
    }, 0)
    return () => window.clearTimeout(startTimer)
  }, [activated, activeInterruption, companyId, current?.id, displayId, index, interruptions])

  useEffect(() => {
    if (!activeInterruption) return
    const interruptionId = activeInterruption.id
    const isCall = activeInterruption.kind === 'call'
    const timer = window.setTimeout(() => {
      setInterruptions(queue => queue.filter(i => i.id !== interruptionId))
      setActiveInterruption(null)
      if (isCall && supabase) void supabase.from('tv_calls').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', interruptionId).eq('company_id', companyId)
      void videoRef.current?.play()
    }, activeInterruption.durationSeconds * 1000)
    return () => window.clearTimeout(timer)
  }, [activeInterruption, companyId])

  useEffect(() => {
    if (!activeInterruption || activeInterruption.kind !== 'call' || !activated || !('speechSynthesis' in window)) return
    const personName = activeInterruption.subtitle?.trim() || activeInterruption.title.replace(/^Chamando\s+/i, '')
    const utterance = new SpeechSynthesisUtterance(`Chamando ${personName}. Por favor, compareça ao atendimento.`)
    utterance.lang = 'pt-BR'; utterance.rate = 0.9; utterance.volume = 1
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance)
    return () => window.speechSynthesis.cancel()
  }, [activated, activeInterruption])

  useEffect(() => {
    if (!activated || !current || current.media.type === 'video' || activeInterruption) return
    const timer = window.setTimeout(() => setIndex(i => (i + 1) % items.length), current.durationSeconds * 1000)
    return () => window.clearTimeout(timer)
  }, [activated, activeInterruption, current, items.length])

  const activate = async () => { setActivated(true); try { await document.documentElement.requestFullscreen?.() } catch { /* fullscreen is optional */ } }
  if (!activated) return <main className="tv-screen"><button className="activation" onClick={activate}>Iniciar exibição</button></main>
  if (!current) return <main className="tv-screen" aria-label="TV sem programação">{activeInterruption ? <CallOverlay interruption={activeInterruption}/> : null}</main>

  return <main className="tv-screen"><Media item={current} displayId={displayId} videoRef={videoRef} onEnded={() => setIndex(i => (i + 1) % items.length)} />{activeInterruption ? <CallOverlay interruption={activeInterruption}/> : null}</main>
}

function CallOverlay({ interruption }: { interruption: Interruption }) {
  const isCall = interruption.kind === 'call'
  return <div className="call-overlay" role="status" aria-live="assertive"><div>{isCall ? <span className="call-kicker">Chamando</span> : null}<strong>{isCall ? interruption.subtitle ?? interruption.title.replace(/^Chamando\s+/i, '') : interruption.title}</strong><p>{isCall ? 'Por favor, compareça ao atendimento.' : interruption.subtitle}</p></div></div>
}

function Media({ item, displayId, videoRef, onEnded }: { item: ProgramItem, displayId: string, videoRef: React.RefObject<HTMLVideoElement | null>, onEnded: () => void }) {
  const url = resolveMediaUrl(item.media)
  const saved = readPlayback(item.companyId, displayId)
  const restore = () => { if (videoRef.current && saved?.itemId === item.id) videoRef.current.currentTime = saved.elapsedSeconds }
  return <div className="media-layer" style={{ '--media-fit': item.fit } as React.CSSProperties}>
    {item.media.type === 'video' && url ? <video ref={videoRef} src={url} autoPlay muted={item.muted} onLoadedMetadata={restore} onEnded={onEnded} playsInline /> : null}
    {item.media.type === 'image' && url ? <img src={url} alt={item.media.title ?? ''} /> : null}
    {item.media.type === 'message' ? <div className="message-content">{item.media.title}</div> : null}
    {item.overlayText ? <div className="message-content">{item.overlayText}</div> : null}
    {item.qrCodeUrl ? <div className="qr-overlay"><QRCodeSVG value={item.qrCodeUrl} size={128}/><small>Aponte a câmera</small></div> : null}
  </div>
}
