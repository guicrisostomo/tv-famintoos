import { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { Interruption, PlayerPayload, ProgramItem } from '../domain/tv'
import { isPlayableMedia, resolveMediaUrl } from '../services/media'
import { readPayload, readPlayback, savePayload, savePlayback } from '../services/playerCache'
import { selectNextInterruption } from '../services/playerQueue'
import { supabase } from '../services/supabase'

export function TvPlayer({ companyId, displayId }: { companyId: string, displayId: string }) {
  const [activated, setActivated] = useState(false)
  const [payload, setPayload] = useState<PlayerPayload | null>(() => readPayload(companyId, displayId))
  const [index, setIndex] = useState(() => readPlayback(companyId, displayId)?.itemIndex ?? 0)
  const [interruptions, setInterruptions] = useState<Interruption[]>([])
  const [activeInterruption, setActiveInterruption] = useState<Interruption | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const load = useCallback(async () => {
    if (!supabase || !companyId || !displayId) return
    const { data, error } = await supabase.rpc('get_tv_player_payload', { p_company_id: companyId, p_display_id: displayId })
    if (error || !data) return
    const next = data as PlayerPayload
    if (next.companyId !== companyId || next.displayId !== displayId) return
    setPayload(next); setInterruptions(next.interruptions ?? []); savePayload(next)
  }, [companyId, displayId])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])
  useEffect(() => {
    if (!supabase || !companyId || !displayId) return
    const client = supabase
    const channel = client.channel(`tv:${companyId}:${displayId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'tv_programs', filter: `company_id=eq.${companyId}` }, () => void load()).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tv_interruptions', filter: `display_id=eq.${displayId}` }, () => void load()).subscribe()
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
    }, 0)
    return () => window.clearTimeout(startTimer)
  }, [activated, activeInterruption, companyId, current?.id, displayId, index, interruptions])

  useEffect(() => {
    if (!activeInterruption) return
    const interruptionId = activeInterruption.id
    const timer = window.setTimeout(() => {
      setInterruptions(queue => queue.filter(i => i.id !== interruptionId))
      setActiveInterruption(null)
      void videoRef.current?.play()
    }, activeInterruption.durationSeconds * 1000)
    return () => window.clearTimeout(timer)
  }, [activeInterruption])

  useEffect(() => {
    if (!activated || !current || current.media.type === 'video' || activeInterruption) return
    const timer = window.setTimeout(() => setIndex(i => (i + 1) % items.length), current.durationSeconds * 1000)
    return () => window.clearTimeout(timer)
  }, [activated, activeInterruption, current, items.length])

  const activate = async () => { setActivated(true); try { await document.documentElement.requestFullscreen?.() } catch { /* fullscreen is optional */ } }
  if (!activated) return <main className="tv-screen"><button className="activation" onClick={activate}>Iniciar exibição</button></main>
  if (!current) return <main className="tv-screen" aria-label="TV sem programação" />

  return <main className="tv-screen"><Media item={current} displayId={displayId} videoRef={videoRef} onEnded={() => setIndex(i => (i + 1) % items.length)} />{activeInterruption ? <div className="call-overlay"><div><strong>{activeInterruption.title}</strong>{activeInterruption.subtitle ? <p>{activeInterruption.subtitle}</p> : null}</div></div> : null}</main>
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
