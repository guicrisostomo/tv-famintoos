import { useState } from 'react'
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Copy, GripVertical, Plus } from 'lucide-react'
import { PreviewPanel } from './PreviewPanel'

type DraftItem = { id: string, title: string, type: string, duration: string }

export function ProgrammingPage({ section }: { section: string }) {
  const [mode, setMode] = useState<'playlist' | 'schedule'>('playlist')
  const [items, setItems] = useState<DraftItem[]>([])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const moveItem = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setItems((current) => arrayMove(current, current.findIndex(i => i.id === active.id), current.findIndex(i => i.id === over.id)))
  }
  const addDraft = () => setItems(current => [...current, { id: crypto.randomUUID(), title: `Item ${current.length + 1}`, type: 'Mensagem', duration: '10 s' }])

  return <>
    <div className="page-header"><div><h1>{section}</h1><p>Crie, ordene e distribua conteúdos sem preencher lacunas automaticamente.</p></div><div style={{display:'flex',gap:8}}><button className="button secondary"><Copy size={16}/> Copiar</button><button className="button primary" onClick={addDraft}><Plus size={16}/> Adicionar item</button></div></div>
    <div className="tabs" role="tablist" aria-label="Modo de programação"><button className={`tab ${mode === 'playlist' ? 'active' : ''}`} onClick={() => setMode('playlist')}>Playlist contínua</button><button className={`tab ${mode === 'schedule' ? 'active' : ''}`} onClick={() => setMode('schedule')}>Grade horária</button></div>
    <div className="grid-2">
      <section className="card"><div className="section-title"><h2>{mode === 'playlist' ? 'Sequência de reprodução' : 'Horários programados'}</h2><span className="badge">{items.length} itens</span></div>
        {items.length === 0 ? <div className="empty"><div><h3>Nenhum conteúdo configurado</h3><p>A tela da TV ficará preta nos períodos sem conteúdo válido.</p><button className="button primary" onClick={addDraft}><Plus size={16}/> Adicionar primeiro item</button></div></div> :
        <DndContext sensors={sensors} onDragEnd={moveItem}><SortableContext items={items} strategy={verticalListSortingStrategy}><div className="timeline">{items.map(item => <SortableItem key={item.id} item={item}/>)}</div></SortableContext></DndContext>}
      </section>
      <PreviewPanel items={items} />
    </div>
  </>
}

function SortableItem({ item }: { item: DraftItem }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  return <div ref={setNodeRef} className="timeline-item" style={{ transform: CSS.Transform.toString(transform), transition }}><button className="drag button" aria-label={`Reordenar ${item.title}`} {...attributes} {...listeners}><GripVertical size={18}/></button><div><strong>{item.title}</strong><span>{item.type} · {item.duration}</span></div><span className="badge">Ativo</span></div>
}
