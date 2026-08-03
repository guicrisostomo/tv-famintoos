import { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { Interruption, PlayerPayload, ProgramItem } from '../domain/tv'
import { isPlayableMedia, resolveMediaUrl } from '../services/media'
import { readPayload, readPlayback, savePayload, savePlayback } from '../services/playerCache'
import { selectNextInterruption } from '../services/playerQueue'
import { supabase } from '../services/supabase'
import type { TvPlaylistRecord } from '../hooks/useTvData'
import { useDeploymentRefresh } from '../hooks/useDeploymentRefresh'
import { tvAudioService, type TvAudioDiagnostics } from '../services/tvAudioService'
import { defaultCallSpeechSettings, speechService, type CallSpeechSettings } from '../services/speechService'

const activationKey = (displayId: string) => `famintoos-tv:activated:${displayId}`
const processedCallsKey = (displayId: string) => `famintoos-tv:processed-calls:${displayId}`

function readProcessedCalls(displayId: string) {
  try { return new Set<string>(JSON.parse(window.localStorage.getItem(processedCallsKey(displayId)) ?? '[]') as string[]) } catch { return new Set<string>() }
}

export function TvPlayer({ companyId, displayId }: { companyId: string, displayId: string }) {
  const [activated, setActivated] = useState(true)
  const [activating, setActivating] = useState(false)
  const [activationError, setActivationError] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [callSettings, setCallSettings] = useState<CallSpeechSettings>(defaultCallSpeechSettings)
  const [businessName, setBusinessName] = useState('')
  const [audioDiagnostics, setAudioDiagnostics] = useState<TvAudioDiagnostics>(() => tvAudioService.diagnostics())
  const [payload, setPayload] = useState<PlayerPayload | null>(() => readPayload(companyId, displayId))
  const [index, setIndex] = useState(() => readPlayback(companyId, displayId)?.itemIndex ?? 0)
  const [interruptions, setInterruptions] = useState<Interruption[]>([])
  const [activeInterruption, setActiveInterruption] = useState<Interruption | null>(null)
  const processedCalls = useRef(readProcessedCalls(displayId))
  const videoRef = useRef<HTMLVideoElement>(null)
  const diagnosticMode = new URLSearchParams(window.location.search).get('diagnostic') === 'audio'

  useEffect(() => {
    tvAudioService.initializeAudio()
    void speechService.initialize()
    const unsubscribe = tvAudioService.subscribe(setAudioDiagnostics)
    void tvAudioService.unlockAudio().then(() => setActivationError(null)).catch(error => setActivationError(error instanceof Error ? error.message : 'O navegador bloqueou o áudio.'))
    return () => { unsubscribe(); tvAudioService.dispose() }
  }, [])

  const load = useCallback(async () => {
    if (!supabase || !companyId || !displayId) return
    const [programResult, playlistResult, callsResult, displayResult, templateResult, businessResult] = await Promise.all([
      supabase.rpc('get_tv_player_payload', { p_company_id: companyId, p_display_id: displayId }),
      supabase.from('tv_playlist_items').select('id,display_id,media_id,position,is_active,media:tv_media(id,title,media_type,media_url,message_text,duration_seconds,public_url,storage_provider,starts_at,ends_at,weekdays,start_time,end_time)').eq('company_id', companyId).eq('display_id', displayId).eq('is_active', true).order('position'),
      supabase.from('tv_calls').select('id,company_id,display_id,customer_name,order_id,call_text,call_payload,requested_at').eq('company_id', companyId).eq('display_id', displayId).eq('status', 'pending').order('requested_at'),
      supabase.from('tv_displays').select('sound_enabled').eq('company_id', companyId).eq('id', displayId).single(),
      supabase.from('tv_call_templates').select('primary_text,volume,duration_seconds,repetitions,layout').eq('company_id', companyId).eq('active', true).limit(1).maybeSingle(),
      supabase.from('business').select('name').eq('cnpj', companyId).maybeSingle(),
    ])
    if (programResult.error && playlistResult.error && callsResult.error) return
    const programPayload = programResult.data as PlayerPayload | null
    const nextSoundEnabled = displayResult.data?.sound_enabled ?? true
    const nextCallSettings = templateResult.data ? { ...defaultCallSpeechSettings, ...(templateResult.data.layout as Partial<CallSpeechSettings>), template: templateResult.data.primary_text || defaultCallSpeechSettings.template, volume: Number(templateResult.data.volume), durationSeconds: templateResult.data.duration_seconds, repetitions: templateResult.data.repetitions } : defaultCallSpeechSettings
    setCallSettings(nextCallSettings); setBusinessName(businessResult.data?.name ?? '')
    setSoundEnabled(nextSoundEnabled); tvAudioService.setEnabled(nextSoundEnabled)
    const legacyItems = ((playlistResult.data ?? []) as unknown as TvPlaylistRecord[]).filter(item => isScheduledNow(item.media)).map(item => ({ id: item.id, companyId, displayIds: [displayId], durationSeconds: item.media.duration_seconds ?? 10, volume: 1, muted: !nextSoundEnabled, fit: 'contain' as const, resumeBehavior: 'resume' as const, active: item.is_active, media: { id: item.media.id, companyId, type: item.media.media_type, mediaUrl: item.media.media_url, publicUrl: item.media.public_url, storageProvider: item.media.storage_provider as 'cloudflare_r2' | 'supabase_storage' | 'external_url' | null, title: item.media.media_type === 'message' ? item.media.message_text : item.media.title } }))
    const known = new Set(legacyItems.map(item => item.id))
    const programItems = (programPayload?.items ?? []).filter(item => !known.has(item.id))
    const programInterruptions = (programPayload?.interruptions ?? []).filter(interruption => interruption.kind !== 'call')
    const pendingCalls: Interruption[] = (callsResult.data ?? []).filter(call => !processedCalls.current.has(call.id)).map(call => ({ id: call.id, companyId: call.company_id, displayId: call.display_id, kind: 'call', priority: 1000, requestedAt: call.requested_at, durationSeconds: nextCallSettings.durationSeconds, title: call.call_text, subtitle: call.customer_name, callValues: { ...((call.call_payload ?? {}) as Interruption['callValues']), customer_name: call.customer_name, order_number: ((call.call_payload ?? {}) as Interruption['callValues'])?.order_number ?? call.order_id, call_text: call.call_text, business_name: businessResult.data?.name ?? '' } }))
    const next: PlayerPayload = { companyId, displayId, items: [...legacyItems, ...programItems], interruptions: [...programInterruptions, ...pendingCalls], syncedAt: new Date().toISOString() }
    setPayload(next); setInterruptions(next.interruptions ?? []); savePayload(next)
  }, [companyId, displayId])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])
  useEffect(() => {
    if (!supabase || !companyId || !displayId) return
    const client = supabase
    const channel = client.channel(`tv:${companyId}:${displayId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'tv_programs', filter: `company_id=eq.${companyId}` }, () => void load()).on('postgres_changes', { event: '*', schema: 'public', table: 'tv_playlist_items', filter: `display_id=eq.${displayId}` }, () => void load()).on('postgres_changes', { event: '*', schema: 'public', table: 'tv_media', filter: `company_id=eq.${companyId}` }, () => void load()).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tv_displays', filter: `id=eq.${displayId}` }, () => void load()).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tv_interruptions', filter: `display_id=eq.${displayId}` }, () => void load()).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tv_calls', filter: `display_id=eq.${displayId}` }, () => void load()).subscribe()
    return () => { void client.removeChannel(channel) }
  }, [companyId, displayId, load])

  const items = (payload?.items ?? []).filter(item => item.companyId === companyId && item.displayIds.includes(displayId) && item.active && isPlayableMedia(item.media))
  const current = items[index % Math.max(items.length, 1)]

  useDeploymentRefresh(() => {
    if (activeInterruption) return
    savePlayback(companyId, displayId, { itemId: current?.id ?? '', itemIndex: index, elapsedSeconds: videoRef.current?.currentTime ?? 0, savedAt: new Date().toISOString() })
    if (activated) window.sessionStorage.setItem(activationKey(displayId), '1')
    window.location.reload()
  })

  useEffect(() => {
    if (!activated || activeInterruption) return
    const next = selectNextInterruption(interruptions)
    if (!next) return
    const startTimer = window.setTimeout(() => {
      savePlayback(companyId, displayId, { itemId: current?.id ?? '', itemIndex: index, elapsedSeconds: videoRef.current?.currentTime ?? 0, savedAt: new Date().toISOString() })
      tvAudioService.pauseAllAudio()
      setActiveInterruption(next)
      if (next.kind === 'call') {
        processedCalls.current.add(next.id)
        window.localStorage.setItem(processedCallsKey(displayId), JSON.stringify(Array.from(processedCalls.current).slice(-200)))
        void updateCall(next.id, companyId, { status: 'showing', displayed_at: new Date().toISOString() })
      }
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
      if (isCall) void updateCall(interruptionId, companyId, { status: 'completed', completed_at: new Date().toISOString() })
      if (videoRef.current) void tvAudioService.playMediaAudio(videoRef.current, current?.volume ?? 1).catch(() => undefined)
    }, activeInterruption.durationSeconds * 1000)
    return () => window.clearTimeout(timer)
  }, [activeInterruption, companyId, current?.volume])

  useEffect(() => {
    if (!activeInterruption || activeInterruption.kind !== 'call' || !activated || !soundEnabled) return
    let spoken = false
    const speak = async () => {
      if (spoken) return; spoken = true
      if (callSettings.bellEnabled) { try { await tvAudioService.playCallSound(); await new Promise(resolve => window.setTimeout(resolve, callSettings.bellDelayMs)) } catch { /* diagnostics expose playback errors */ } }
      await speechService.speakCall(activeInterruption.callValues ?? { customer_name: activeInterruption.subtitle, call_text: activeInterruption.title, business_name: businessName }, callSettings)
    }
    void speak()
    return () => speechService.cancel()
  }, [activated, activeInterruption, businessName, callSettings, soundEnabled])

  useEffect(() => {
    if (!activated || !current || current.media.type === 'video' || activeInterruption) return
    const timer = window.setTimeout(() => setIndex(i => (i + 1) % items.length), current.durationSeconds * 1000)
    return () => window.clearTimeout(timer)
  }, [activated, activeInterruption, current, items.length])

  const activate = async () => {
    setActivating(true); setActivationError(null)
    try {
      tvAudioService.initializeAudio(); tvAudioService.setEnabled(soundEnabled); await tvAudioService.unlockAudio()
      window.localStorage.setItem(activationKey(displayId), new Date().toISOString()); setActivated(true)
      try { await document.documentElement.requestFullscreen?.() } catch { /* fullscreen is optional */ }
    } catch (error) { setActivationError(error instanceof Error ? error.message : 'Não foi possível ativar o áudio. Tente novamente.') }
    finally { setActivating(false) }
  }
  if (!current) return <main className="tv-screen" aria-label="TV sem programação">{activeInterruption ? <CallOverlay interruption={activeInterruption}/> : null}{diagnosticMode ? <AudioDiagnostic diagnostics={audioDiagnostics} soundEnabled={soundEnabled}/> : null}</main>

  return <main className="tv-screen"><Media item={current} displayId={displayId} videoRef={videoRef} soundEnabled={soundEnabled} onEnded={() => setIndex(i => (i + 1) % items.length)} />{activeInterruption ? <CallOverlay interruption={activeInterruption}/> : null}{activationError ? <AudioUnlock onClick={activate} activating={activating}/> : null}{diagnosticMode ? <AudioDiagnostic diagnostics={audioDiagnostics} soundEnabled={soundEnabled}/> : null}</main>
}

function AudioUnlock({ onClick, activating }: { onClick: () => Promise<void>; activating: boolean }) { return <button className="audio-unlock" onClick={() => void onClick()} disabled={activating}>{activating ? 'Ativando som...' : 'Ativar som'}</button> }

function isScheduledNow(media: TvPlaylistRecord['media']) {
  const now = new Date(); if (media.starts_at && now < new Date(media.starts_at)) return false; if (media.ends_at && now > new Date(media.ends_at)) return false
  if (media.weekdays?.length && !media.weekdays.includes(now.getDay())) return false
  const time = now.toTimeString().slice(0, 8); if (media.start_time && time < media.start_time) return false; if (media.end_time && time > media.end_time) return false
  return true
}

async function updateCall(id: string, companyId: string, values: { status: 'showing'; displayed_at: string } | { status: 'completed'; completed_at: string }) {
  if (!supabase) return
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase.from('tv_calls').update(values).eq('id', id).eq('company_id', companyId).select('id').maybeSingle()
    if (!error && data) return
    await new Promise(resolve => window.setTimeout(resolve, 750 * (attempt + 1)))
  }
}

function CallOverlay({ interruption }: { interruption: Interruption }) {
  const isCall = interruption.kind === 'call'
  return <div className="call-overlay" role="status" aria-live="assertive"><div>{isCall ? <span className="call-kicker">Chamando</span> : null}<strong>{isCall ? interruption.subtitle ?? interruption.callValues?.order_number ?? interruption.title : interruption.title}</strong><p>{isCall ? interruption.callValues?.call_text ?? interruption.title : interruption.subtitle}</p></div></div>
}

function AudioDiagnostic({ diagnostics, soundEnabled }: { diagnostics: TvAudioDiagnostics; soundEnabled: boolean }) {
  const speech = speechService.diagnostics()
  return <aside className="audio-diagnostic"><strong>Diagnóstico de áudio</strong><span>áudio habilitado: {diagnostics.enabled ? 'sim' : 'não'}</span><span>sound_enabled: {soundEnabled ? 'true' : 'false'}</span><span>volume: {Math.round(diagnostics.volume * 100)}%</span><span>AudioContext: {diagnostics.contextState}</span><span>mídia: {diagnostics.loadedMedia ?? 'nenhuma'}</span><span>voz: {speech.supported ? `${speech.voiceCount} disponível(is)` : 'indisponível'}</span><span>erro de voz: {speech.lastError ?? 'nenhum'}</span><span>último erro: {diagnostics.lastError ?? 'nenhum'}</span></aside>
}

function Media({ item, displayId, videoRef, soundEnabled, onEnded }: { item: ProgramItem, displayId: string, videoRef: React.RefObject<HTMLVideoElement | null>, soundEnabled: boolean, onEnded: () => void }) {
  const url = resolveMediaUrl(item.media)
  const saved = readPlayback(item.companyId, displayId)
  const restoreAndPlay = () => { const video = videoRef.current; if (!video) return; if (saved?.itemId === item.id) video.currentTime = saved.elapsedSeconds; video.muted = !soundEnabled || item.muted; video.volume = item.volume; void tvAudioService.playMediaAudio(video, item.volume).catch(async () => { video.muted = true; try { await video.play() } catch { /* visual playback can also be blocked */ } }) }
  return <div className="media-layer" style={{ '--media-fit': item.fit } as React.CSSProperties}>
    {item.media.type === 'video' && url ? <video ref={videoRef} src={url} muted={!soundEnabled || item.muted} onLoadedMetadata={restoreAndPlay} onEnded={onEnded} playsInline /> : null}
    {item.media.type === 'image' && url ? <img src={url} alt={item.media.title ?? ''} /> : null}
    {item.media.type === 'message' ? <div className="message-content">{item.media.title}</div> : null}
    {item.overlayText ? <div className="message-content">{item.overlayText}</div> : null}
    {item.qrCodeUrl ? <div className="qr-overlay"><QRCodeSVG value={item.qrCodeUrl} size={128}/><small>Aponte a câmera</small></div> : null}
  </div>
}
