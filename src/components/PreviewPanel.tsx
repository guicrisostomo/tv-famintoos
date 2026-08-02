import { useEffect, useState } from 'react'
import { Pause, Play, SkipForward } from 'lucide-react'
import type { TvPlaylistRecord } from '../hooks/useTvData'

export function PreviewPanel({ items }: { items: TvPlaylistRecord[] }) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const current = items[index % Math.max(items.length, 1)]?.media
  const imageUrl = current?.public_url ?? current?.media_url
  const next = () => setIndex(value => (value + 1) % Math.max(items.length, 1))

  useEffect(() => {
    if (!playing || !current || items.length === 0) return
    const timer = window.setTimeout(() => setIndex(value => (value + 1) % Math.max(items.length, 1)), (current.duration_seconds ?? 10) * 1000)
    return () => window.clearTimeout(timer)
  }, [current, items.length, playing])

  return <section className="card"><div className="section-title"><h2>Pré-visualização 16:9</h2><span className="badge">{items.length > 0 ? `${index % items.length + 1}/${items.length}` : 'Sem itens'}</span></div><div className="preview">{!current ? <div className="preview-placeholder">Tela preta<br/>Nenhuma mídia válida configurada</div> : current.media_type === 'image' && imageUrl ? <img src={imageUrl} alt={current.title}/> : current.media_type === 'video' && imageUrl ? <video src={imageUrl} autoPlay={playing} muted playsInline controls/> : current.media_type === 'message' ? <div className="preview-message">{current.message_text}</div> : <div className="preview-placeholder">{current.title}</div>}</div><div className="preview-actions"><button className="button primary" disabled={items.length === 0} onClick={() => setPlaying(value => !value)}>{playing ? <Pause size={15}/> : <Play size={15}/>} {playing ? 'Pausar prévia' : 'Reproduzir prévia'}</button><button className="button secondary" disabled={items.length < 2} onClick={next}><SkipForward size={15}/> Próximo item</button></div></section>
}
