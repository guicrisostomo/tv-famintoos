import { useState } from 'react'
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ExternalLink, GripVertical, Plus, Trash2 } from 'lucide-react'
import type { TvDisplayRecord, TvPlaylistRecord } from '../hooks/useTvData'
import { supabase } from '../services/supabase'
import { ContentComposer } from './ContentComposer'
import { PreviewPanel } from './PreviewPanel'

export function ProgrammingPage({ companyId, displays, items, onReload }: { companyId: string; displays: TvDisplayRecord[]; items: TvPlaylistRecord[]; onReload: () => Promise<void> }) {
  const [mode, setMode] = useState<'playlist' | 'schedule'>('playlist'); const [composerOpen, setComposerOpen] = useState(false); const [selectedDisplay, setSelectedDisplay] = useState(displays[0]?.id ?? '')
  const visibleItems = selectedDisplay ? items.filter(item => item.display_id === selectedDisplay) : items
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const moveItem = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || !supabase) return
    const client = supabase
    const reordered = arrayMove(visibleItems, visibleItems.findIndex(i => i.id === active.id), visibleItems.findIndex(i => i.id === over.id))
    await Promise.all(reordered.map((item, position) => client.from('tv_playlist_items').update({ position }).eq('id', item.id).eq('company_id', companyId)))
    await onReload()
  }
  const removeItem = async (id: string) => { if (!supabase || !window.confirm('Remover este item da programação desta TV?')) return; await supabase.from('tv_playlist_items').delete().eq('id', id).eq('company_id', companyId); await onReload() }
  return <>
    <div className="page-header"><div><h1>Programação</h1><p>Adicione textos e imagens e escolha exatamente em quais TVs serão exibidos.</p></div><button className="button primary" onClick={() => setComposerOpen(true)}><Plus size={16}/> Adicionar conteúdo</button></div>
    <div className="program-toolbar"><div className="tabs" role="tablist" aria-label="Modo de programação"><button className={`tab ${mode === 'playlist' ? 'active' : ''}`} onClick={() => setMode('playlist')}>Playlist contínua</button><button className={`tab ${mode === 'schedule' ? 'active' : ''}`} onClick={() => setMode('schedule')}>Grade horária</button></div><label>TV<select value={selectedDisplay} onChange={e => setSelectedDisplay(e.target.value)}><option value="">Todas as TVs</option>{displays.map(display => <option key={display.id} value={display.id}>{display.name}</option>)}</select></label>{selectedDisplay ? <a className="button secondary" href={`/tv/${companyId}/${selectedDisplay}`} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Exibir na TV</a> : null}</div>
    <div className="grid-2"><section className="card"><div className="section-title"><h2>{mode === 'playlist' ? 'Sequência de reprodução' : 'Horários programados'}</h2><span className="badge">{visibleItems.length} itens</span></div>{visibleItems.length === 0 ? <div className="empty"><div><h3>Nenhum conteúdo configurado</h3><p>Adicione um texto ou imagem e selecione as TVs onde será exibido.</p><button className="button primary" onClick={() => setComposerOpen(true)}><Plus size={16}/> Adicionar primeiro conteúdo</button></div></div> : <DndContext sensors={sensors} onDragEnd={moveItem}><SortableContext items={visibleItems} strategy={verticalListSortingStrategy}><div className="timeline">{visibleItems.map(item => <SortableItem key={item.id} item={item} onRemove={removeItem}/>)}</div></SortableContext></DndContext>}</section><PreviewPanel items={visibleItems}/></div>
    {composerOpen ? <ContentComposer companyId={companyId} displays={displays} items={items} onClose={() => setComposerOpen(false)} onSaved={onReload}/> : null}
  </>
}

function SortableItem({ item, onRemove }: { item: TvPlaylistRecord; onRemove: (id: string) => Promise<void> }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  return <div ref={setNodeRef} className="timeline-item" style={{ transform: CSS.Transform.toString(transform), transition }}><button className="drag button" aria-label={`Reordenar ${item.media.title}`} {...attributes} {...listeners}><GripVertical size={18}/></button><div><strong>{item.media.title}</strong><span>{item.media.media_type === 'message' ? 'Texto' : 'Imagem'} · {item.media.duration_seconds ?? 10} s</span></div><button className="icon-button danger" onClick={() => void onRemove(item.id)} aria-label={`Remover ${item.media.title}`}><Trash2 size={16}/></button></div>
}
