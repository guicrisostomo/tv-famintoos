import type { AudioPlaybackOrder, AudioRepeatMode } from '../domain/audioPlaylist'

export interface TvAudioDiagnostics {
  enabled: boolean
  unlocked: boolean
  volume: number
  contextState: AudioContextState | 'unavailable'
  lastError: string | null
  loadedMedia: string | null
}

type WebkitWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }
type Listener = (diagnostics: TvAudioDiagnostics) => void

export interface TvAudioPlaylistConfig {
  key: string
  tracks: { id: string; title?: string | null; url: string; volume: number }[]
  volume: number
  order: AudioPlaybackOrder
  repeat: AudioRepeatMode
}

function createBellUrl() {
  const sampleRate = 22050
  const duration = .42
  const samples = Math.floor(sampleRate * duration)
  const buffer = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(buffer)
  const write = (offset: number, value: string) => Array.from(value).forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)))
  write(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); write(8, 'WAVE'); write(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples * 2, true)
  for (let index = 0; index < samples; index += 1) {
    const time = index / sampleRate
    const envelope = Math.exp(-7 * time)
    const sample = (Math.sin(2 * Math.PI * 880 * time) + .45 * Math.sin(2 * Math.PI * 1320 * time)) * envelope * .55
    view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true)
  }
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
}

class TvAudioService {
  private context: AudioContext | null = null
  private gain: GainNode | null = null
  private bellSource: MediaElementAudioSourceNode | null = null
  private bell: HTMLAudioElement | null = null
  private soundtrack: HTMLAudioElement | null = null
  private playlist: TvAudioPlaylistConfig | null = null
  private playlistQueue: number[] = []
  private playlistIndex = -1
  private playlistErrors = 0
  private bellUrl: string | null = null
  private media = new Set<HTMLMediaElement>()
  private listeners = new Set<Listener>()
  private volume = 1
  private enabled = true
  private unlocked = false
  private lastError: string | null = null
  private loadedMedia: string | null = null
  private initialized = false

  initializeAudio() {
    if (this.initialized) return this.diagnostics()
    this.initialized = true
    const AudioContextClass = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext
    if (AudioContextClass) { this.context = new AudioContextClass(); this.gain = this.context.createGain(); this.gain.connect(this.context.destination) }
    this.bellUrl = createBellUrl()
    const bell = new Audio(this.bellUrl); bell.preload = 'auto'; this.bell = bell
    if (this.context && this.gain) { this.bellSource = this.context.createMediaElementSource(bell); this.bellSource.connect(this.gain) }
    bell.addEventListener('error', () => this.reportMediaError(bell, 'Não foi possível carregar a campainha.'))
    document.addEventListener('visibilitychange', this.handleVisibility)
    document.addEventListener('webkitvisibilitychange', this.handleVisibility)
    window.addEventListener('focus', this.handleResume)
    window.addEventListener('pageshow', this.handleResume)
    window.addEventListener('blur', this.handlePause)
    this.emit(); return this.diagnostics()
  }

  async unlockAudio() {
    this.initializeAudio()
    await this.resumeAudioContext()
    if (!this.bell) throw new Error('Campainha não inicializada.')
    this.bell.volume = .02
    this.bell.currentTime = 0
    try { await this.bell.play(); await new Promise(resolve => window.setTimeout(resolve, 90)); this.bell.pause(); this.bell.currentTime = 0; this.bell.volume = 1; this.unlocked = true; this.lastError = null; this.emit() }
    catch (error) { this.captureError(error, 'O Fire TV bloqueou a ativação inicial do áudio.'); throw error }
  }

  async playCallSound() {
    if (!this.enabled) return
    this.initializeAudio(); await this.resumeAudioContext()
    if (!this.bell) return
    this.bell.pause(); this.bell.currentTime = 0; this.bell.volume = 1; this.loadedMedia = 'Campainha de chamada'
    try { await this.bell.play(); this.lastError = null; this.emit() }
    catch (error) { this.captureError(error, 'Falha ao reproduzir a campainha.'); throw error }
  }

  async playMediaAudio(element: HTMLMediaElement, volume = 1) {
    this.initializeAudio(); this.media.add(element); await this.resumeAudioContext()
    element.volume = Math.max(0, Math.min(1, volume * this.volume)); this.loadedMedia = element.currentSrc || element.src || 'Mídia da programação'
    try { await element.play(); this.lastError = null; this.emit() }
    catch (error) { this.captureError(error, 'Falha ao iniciar o áudio da mídia.'); throw error }
  }

  async playSoundtrack(url: string, volume = .7, loop = true) {
    return this.playPlaylist({ key: `legacy:${url}`, tracks: [{ id: url, title: url, url, volume: 1 }], volume, order: 'sequential', repeat: loop ? 'all' : 'none' })
  }

  async playPlaylist(config: TvAudioPlaylistConfig) {
    if (!this.enabled || !config.tracks.length) return
    this.initializeAudio(); await this.resumeAudioContext()
    const audio = this.ensureSoundtrack()
    const samePlaylist = this.playlist?.key === config.key
    this.playlist = config
    if (!samePlaylist || this.playlistIndex < 0 || this.playlistIndex >= config.tracks.length) {
      this.playlistQueue = this.createQueue(config.order, config.tracks.length, -1)
      this.playlistIndex = this.playlistQueue.shift() ?? 0
      this.playlistErrors = 0
      await this.loadPlaylistTrack(audio)
      return
    }
    const track = config.tracks[this.playlistIndex]
    audio.volume = this.trackVolume(config.volume, track.volume)
    if (audio.paused) {
      try { await audio.play(); this.lastError = null; this.emit() }
      catch (error) { this.captureError(error, 'Falha ao retomar a playlist de músicas.'); throw error }
    }
  }

  stopSoundtrack() {
    if (this.soundtrack) { this.soundtrack.pause(); this.soundtrack.currentTime = 0 }
    this.playlist = null; this.playlistQueue = []; this.playlistIndex = -1; this.playlistErrors = 0; this.emit()
  }
  pauseSoundtrack() { if (!this.soundtrack) return; this.soundtrack.pause(); this.emit() }

  releaseMedia(element: HTMLMediaElement) {
    const source = element.currentSrc || element.src
    element.pause(); this.media.delete(element); element.removeAttribute('src'); element.load()
    if (source.startsWith('blob:')) URL.revokeObjectURL(source)
    if (this.loadedMedia === source) this.loadedMedia = null
    this.emit()
  }

  pauseAllAudio() { this.bell?.pause(); this.media.forEach(element => element.pause()); if ('speechSynthesis' in window) window.speechSynthesis.pause(); this.emit() }
  pauseForFocusLoss() {
    this.bell?.pause()
    this.soundtrack?.pause()
    this.media.forEach(element => {
      if (element instanceof HTMLVideoElement) element.muted = true
      else element.pause()
    })
    if ('speechSynthesis' in window) window.speechSynthesis.pause()
    this.emit()
  }
  async resumeAudioContext() { if (this.context?.state === 'suspended') { try { await this.context.resume(); this.lastError = null } catch (error) { this.captureError(error, 'AudioContext suspenso e não pôde ser retomado.'); throw error } } this.emit() }
  setVolume(volume: number) { this.volume = Math.max(0, Math.min(1, volume)); if (this.gain) this.gain.gain.value = this.volume; this.emit() }
  setEnabled(enabled: boolean) { this.enabled = enabled; if (!enabled) this.pauseAllAudio(); this.emit() }
  subscribe(listener: Listener) { this.listeners.add(listener); listener(this.diagnostics()); return () => this.listeners.delete(listener) }
  diagnostics(): TvAudioDiagnostics { return { enabled: this.enabled, unlocked: this.unlocked, volume: this.volume, contextState: this.context?.state ?? 'unavailable', lastError: this.lastError, loadedMedia: this.loadedMedia } }

  dispose() {
    this.pauseAllAudio(); document.removeEventListener('visibilitychange', this.handleVisibility); document.removeEventListener('webkitvisibilitychange', this.handleVisibility)
    window.removeEventListener('focus', this.handleResume); window.removeEventListener('pageshow', this.handleResume); window.removeEventListener('blur', this.handlePause)
    if (this.soundtrack) { this.soundtrack.removeEventListener('ended', this.handlePlaylistEnded); this.soundtrack.removeEventListener('error', this.handlePlaylistError); this.soundtrack.removeAttribute('src'); this.soundtrack.load() }
    this.soundtrack = null; this.playlist = null; this.playlistQueue = []; this.playlistIndex = -1; this.media.clear(); this.bellSource?.disconnect(); this.bell?.removeAttribute('src'); if (this.bellUrl) URL.revokeObjectURL(this.bellUrl); void this.context?.close()
    this.context = null; this.gain = null; this.bellSource = null; this.bell = null; this.bellUrl = null; this.initialized = false; this.unlocked = false; this.emit()
  }

  private handleVisibility = () => { if (document.hidden) this.pauseAllAudio(); else void this.resumeAudioContext() }
  private handleResume = () => { void this.resumeAudioContext(); if ('speechSynthesis' in window) window.speechSynthesis.resume() }
  private handlePause = () => this.pauseForFocusLoss()
  private ensureSoundtrack() {
    if (this.soundtrack) return this.soundtrack
    const audio = new Audio()
    audio.preload = 'auto'
    audio.addEventListener('ended', this.handlePlaylistEnded)
    audio.addEventListener('error', this.handlePlaylistError)
    this.soundtrack = audio
    this.media.add(audio)
    return audio
  }
  private handlePlaylistEnded = () => { this.playlistErrors = 0; void this.advancePlaylist() }
  private handlePlaylistError = () => {
    if (!this.soundtrack) return
    this.reportMediaError(this.soundtrack, 'Falha ao carregar uma música da playlist.')
    this.playlistErrors += 1
    if (this.playlist && this.playlistErrors >= this.playlist.tracks.length) { this.stopSoundtrack(); return }
    void this.advancePlaylist()
  }
  private async advancePlaylist() {
    const playlist = this.playlist
    const audio = this.soundtrack
    if (!playlist || !audio) return
    if (playlist.repeat !== 'one') {
      if (!this.playlistQueue.length) {
        if (playlist.repeat === 'none') { this.stopSoundtrack(); return }
        this.playlistQueue = this.createQueue(playlist.order, playlist.tracks.length, this.playlistIndex)
      }
      this.playlistIndex = this.playlistQueue.shift() ?? 0
    }
    try { await this.loadPlaylistTrack(audio) }
    catch { /* o diagnóstico já registra a falha; o evento error tenta a próxima faixa */ }
  }
  private async loadPlaylistTrack(audio: HTMLAudioElement) {
    const playlist = this.playlist
    const track = playlist?.tracks[this.playlistIndex]
    if (!playlist || !track) return
    audio.pause(); audio.loop = false; audio.src = track.url; audio.volume = this.trackVolume(playlist.volume, track.volume); audio.load()
    this.loadedMedia = track.title || track.url
    try { await audio.play(); this.lastError = null; this.emit() }
    catch (error) { this.captureError(error, 'Falha ao reproduzir uma música da playlist.'); throw error }
  }
  private createQueue(order: AudioPlaybackOrder, size: number, previousIndex: number) {
    const queue = Array.from({ length: size }, (_, index) => index)
    if (order === 'shuffle') {
      for (let index = queue.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(Math.random() * (index + 1)); [queue[index], queue[swap]] = [queue[swap], queue[index]]
      }
      if (queue.length > 1 && queue[0] === previousIndex) [queue[0], queue[1]] = [queue[1], queue[0]]
    }
    return queue
  }
  private trackVolume(playlistVolume: number, trackVolume: number) { return Math.max(0, Math.min(1, playlistVolume * trackVolume * this.volume)) }
  private reportMediaError(element: HTMLMediaElement, fallback: string) { const code = element.error?.code; const reason = code === 4 ? 'Formato de áudio incompatível.' : code === 2 ? 'Arquivo de áudio não encontrado ou inacessível.' : fallback; this.captureError(new Error(reason), reason) }
  private captureError(error: unknown, fallback: string) { const name = error instanceof DOMException ? error.name : ''; this.lastError = name === 'NotAllowedError' ? 'Reprodução bloqueada: pressione “Iniciar exibição” novamente.' : error instanceof Error ? error.message : fallback; this.emit() }
  private emit() { const value = this.diagnostics(); this.listeners.forEach(listener => listener(value)) }
}

export const tvAudioService = new TvAudioService()
