import { ArrowDown, ArrowUp, ListMusic, Plus, Shuffle, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { AudioPlaylistSettings } from '../domain/audioPlaylist'
import { moveAudioTrack } from '../domain/audioPlaylist'
import { SoundPicker, type SoundSettings } from './SoundPicker'

export function AudioPlaylistEditor({
  companyId,
  value,
  isVideo = false,
  onChange,
  legend = 'Playlist de músicas',
  hint = 'Adicione várias faixas e organize a experiência sonora.',
}: {
  companyId: string
  value: AudioPlaylistSettings
  isVideo?: boolean
  onChange: (value: AudioPlaylistSettings) => void
  legend?: string
  hint?: string
}) {
  const [candidate, setCandidate] = useState<SoundSettings>(() => ({
    mediaId: null,
    media: null,
    volume: 1,
    loop: false,
    muteOriginalAudio: isVideo && value.videoAudioMode !== 'original',
    videoAudioMode: value.videoAudioMode,
  }))

  const updateCandidate = (next: SoundSettings) => {
    setCandidate(next)
    if (next.videoAudioMode !== value.videoAudioMode) {
      onChange({ ...value, videoAudioMode: next.videoAudioMode })
    }
  }

  const addCandidate = () => {
    if (!candidate.mediaId || !candidate.media) return
    const existing = value.tracks.findIndex((track) => track.mediaId === candidate.mediaId)
    const tracks = existing >= 0
      ? value.tracks.map((track, index) => index === existing ? { ...track, volume: candidate.volume } : track)
      : [...value.tracks, { mediaId: candidate.mediaId, media: candidate.media, volume: candidate.volume }]
    onChange({ ...value, tracks })
    setCandidate((current) => ({ ...current, mediaId: null, media: null, volume: 1 }))
  }

  const showTracks = !isVideo || value.videoAudioMode === 'replace'

  return (
    <section className="audio-playlist-editor" aria-label={legend}>
      <SoundPicker
        companyId={companyId}
        value={candidate}
        isVideo={isVideo}
        onChange={updateCandidate}
        legend={legend}
        hint={hint}
        showLoop={false}
      />
      {showTracks ? (
        <>
          <button type="button" className="button secondary add-audio-track" disabled={!candidate.mediaId} onClick={addCandidate}>
            <Plus size={16} /> Adicionar à sequência
          </button>
          <div className="selected-audio-tracks">
            <div className="audio-playlist-heading">
              <span><ListMusic size={17} /> Sequência selecionada</span>
              <strong>{value.tracks.length} {value.tracks.length === 1 ? 'música' : 'músicas'}</strong>
            </div>
            {value.tracks.length ? value.tracks.map((track, index) => (
              <div className="selected-audio-track" key={track.mediaId}>
                <b>{index + 1}</b>
                <div><strong>{track.media.title}</strong><label>Volume da faixa <input type="range" min="0" max="1" step="0.05" value={track.volume} onChange={(event) => onChange({ ...value, tracks: value.tracks.map((item, itemIndex) => itemIndex === index ? { ...item, volume: Number(event.target.value) } : item) })} /><span>{Math.round(track.volume * 100)}%</span></label></div>
                <div className="audio-track-actions">
                  <button type="button" className="icon-button" disabled={index === 0} onClick={() => onChange({ ...value, tracks: moveAudioTrack(value.tracks, index, index - 1) })} aria-label={`Mover ${track.media.title} para cima`}><ArrowUp size={15} /></button>
                  <button type="button" className="icon-button" disabled={index === value.tracks.length - 1} onClick={() => onChange({ ...value, tracks: moveAudioTrack(value.tracks, index, index + 1) })} aria-label={`Mover ${track.media.title} para baixo`}><ArrowDown size={15} /></button>
                  <button type="button" className="icon-button danger" onClick={() => onChange({ ...value, tracks: value.tracks.filter((_, itemIndex) => itemIndex !== index) })} aria-label={`Remover ${track.media.title}`}><Trash2 size={15} /></button>
                </div>
              </div>
            )) : <p className="form-hint">Nenhuma música adicionada. Escolha uma faixa acima e clique em adicionar.</p>}
          </div>
          <div className="audio-playlist-options">
            <label>Ordem<select value={value.order} onChange={(event) => onChange({ ...value, order: event.target.value as AudioPlaylistSettings['order'] })}><option value="sequential">Na ordem da lista</option><option value="shuffle">Aleatória, sem repetir a anterior</option></select></label>
            <label>Ao terminar<select value={value.repeat} onChange={(event) => onChange({ ...value, repeat: event.target.value as AudioPlaylistSettings['repeat'] })}><option value="all">Repetir toda a lista</option><option value="one">Repetir a música atual</option><option value="none">Parar após tocar todas</option></select></label>
            <label className="audio-master-volume">Volume geral <input type="range" min="0" max="1" step="0.05" value={value.volume} onChange={(event) => onChange({ ...value, volume: Number(event.target.value) })} /><span>{Math.round(value.volume * 100)}%</span></label>
          </div>
          {value.order === 'shuffle' ? <p className="audio-playlist-tip"><Shuffle size={14} /> A ordem será renovada a cada ciclo e não repetirá imediatamente a última música.</p> : null}
        </>
      ) : null}
    </section>
  )
}
