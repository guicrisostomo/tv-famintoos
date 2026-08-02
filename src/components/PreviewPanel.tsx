import { BellRing, Play, RotateCcw } from 'lucide-react'
import type { TvPlaylistRecord } from '../hooks/useTvData'

export function PreviewPanel({ items }: { items: TvPlaylistRecord[] }) {
  const first = items[0]?.media
  const imageUrl = first?.public_url ?? first?.media_url
  return <section className="card"><div className="section-title"><h2>Pré-visualização 16:9</h2><span className="badge">Simulação</span></div><div className="preview">{!first ? <div className="preview-placeholder">Tela preta<br/>Nenhuma mídia válida configurada</div> : first.media_type === 'image' && imageUrl ? <img src={imageUrl} alt={first.title}/> : first.media_type === 'message' ? <div className="preview-message">{first.message_text}</div> : <div className="preview-placeholder">{first.title}<br/>{items.length} {items.length === 1 ? 'item' : 'itens'} na sequência</div>}</div><div className="preview-actions"><button className="button primary" disabled={items.length === 0}><Play size={15}/> Reproduzir</button><button className="button secondary"><BellRing size={15}/> Testar chamada</button><button className="button secondary"><RotateCcw size={15}/> Testar comercial</button></div></section>
}
