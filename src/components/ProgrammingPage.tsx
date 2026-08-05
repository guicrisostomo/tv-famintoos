import { useState } from 'react'
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ExternalLink, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import type { TvDisplayRecord, TvPlaylistRecord } from '../hooks/useTvData'
import { supabase } from '../services/supabase'
import { ContentComposer } from './ContentComposer'
import { EditProgrammingItem } from './EditProgrammingItem'
import { PreviewPanel } from './PreviewPanel'

export function ProgrammingPage({ companyId, displays, items, onReload }: { companyId: string; displays: TvDisplayRecord[]; items: TvPlaylistRecord[]; onReload: () => Promise<void> }) {
  const [composerOpen, setComposerOpen] = useState(false); const [editingItem, setEditingItem] = useState<TvPlaylistRecord | null>(null); const [selectedDisplay, setSelectedDisplay] = useState(displays[0]?.id ?? '')
  const visibleItems = selectedDisplay ? items.filter(item => item.display_id === selectedDisplay) : items
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const moveItem = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || !supabase) return
    const client = supabase
    const reordered = arrayMove(visibleItems, visibleItems.findIndex(i => i.id === active.id), visibleItems.findIndex(i => i.id === over.id))
    await Promise.all(reordered.map((item, position) => client.from('tv_playlist_items').update({ position }).eq('id', item.id).eq('company_id', companyId)))
    await onReload()
  }
  const removeItem = async (id: string) => {
    if (!supabase || !window.confirm('Remover este item da programação desta TV?')) return
    const { data, error } = await supabase.from('tv_playlist_items').delete().eq('id', id).eq('company_id', companyId).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('Item não encontrado ou remoção não autorizada.')
    await onReload()
  }
  return <>
    <div className="page-header"><div><h1>Programação</h1><p>Adicione textos e imagens e escolha exatamente em quais TVs serão exibidos.</p></div><button className="button primary" onClick={() => setComposerOpen(true)}><Plus size={16}/> Adicionar conteúdo</button></div>
    <div className="program-toolbar"><span className="badge">Playlist contínua</span><label>TV<select value={selectedDisplay} onChange={e => setSelectedDisplay(e.target.value)}><option value="">Todas as TVs</option>{displays.map(display => <option key={display.id} value={display.id}>{display.name}</option>)}</select></label>{selectedDisplay ? <a className="button secondary" href={`/tv/${companyId}/${selectedDisplay}`} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Exibir na TV</a> : null}</div>
    <div className="grid-2"><section className="card"><div className="section-title"><h2>Sequência de reprodução</h2><span className="badge">{visibleItems.length} itens</span></div>{visibleItems.length === 0 ? <div className="empty"><div><h3>Nenhum conteúdo configurado</h3><p>Adicione um texto ou imagem e selecione as TVs onde será exibido.</p><button className="button primary" onClick={() => setComposerOpen(true)}><Plus size={16}/> Adicionar primeiro conteúdo</button></div></div> : <DndContext sensors={sensors} onDragEnd={moveItem}><SortableContext items={visibleItems} strategy={verticalListSortingStrategy}><div className="timeline">{visibleItems.map(item => <SortableItem key={item.id} item={item} onEdit={setEditingItem} onRemove={removeItem}/>)}</div></SortableContext></DndContext>}</section><PreviewPanel items={visibleItems}/></div>
    {composerOpen ? <ContentComposer companyId={companyId} displays={displays} items={items} onClose={() => setComposerOpen(false)} onSaved={onReload}/> : null}
    {editingItem ? <EditProgrammingItem companyId={companyId} displays={displays} items={items} item={editingItem} onClose={() => setEditingItem(null)} onSaved={onReload}/> : null}
  </>
}

function SortableItem({ item, onEdit, onRemove }: { item: TvPlaylistRecord; onEdit: (item: TvPlaylistRecord) => void; onRemove: (id: string) => Promise<void> }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  const typeLabel = item.media.media_type === 'message' ? 'Texto' : item.media.media_type === 'video' ? 'Vídeo' : 'Imagem'
  return <div ref={setNodeRef} className="timeline-item" style={{ transform: CSS.Transform.toString(transform), transition }}><button className="drag button" aria-label={`Reordenar ${item.media.title}`} {...attributes} {...listeners}><GripVertical size={18}/></button><div><strong>{item.media.title}</strong><span>{typeLabel} · {item.media.duration_seconds ?? 10} s</span></div><div className="timeline-actions"><button className="icon-button" onClick={() => onEdit(item)} aria-label={`Editar ${item.media.title}`}><Pencil size={16}/></button><button className="icon-button danger" onClick={() => void onRemove(item.id)} aria-label={`Remover ${item.media.title}`}><Trash2 size={16}/></button></div></div>
}
