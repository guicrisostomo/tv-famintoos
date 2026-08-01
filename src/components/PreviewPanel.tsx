import { BellRing, Play, RotateCcw } from 'lucide-react'

export function PreviewPanel({ items }: { items: { id: string }[] }) {
  return <section className="card"><div className="section-title"><h2>Pré-visualização 16:9</h2><span className="badge">Simulação</span></div><div className="preview">{items.length === 0 ? <div className="preview-placeholder">Tela preta<br/>Nenhuma mídia válida configurada</div> : <div className="preview-placeholder">Prévia local da sequência<br/>{items.length} {items.length === 1 ? 'item' : 'itens'}</div>}</div><div className="preview-actions"><button className="button primary" disabled={items.length === 0}><Play size={15}/> Reproduzir</button><button className="button secondary"><BellRing size={15}/> Testar chamada</button><button className="button secondary"><RotateCcw size={15}/> Testar comercial</button></div></section>
}
