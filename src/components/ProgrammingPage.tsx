import { useMemo, useState } from 'react'
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CalendarDays, Download, ExternalLink, GripVertical, MessageSquareText, Pencil, Plus, Trash2, Video } from 'lucide-react'
import type { TvDisplayRecord, TvPlaylistRecord } from '../hooks/useTvData'
import { supabase } from '../services/supabase'
import { ContentComposer } from './ContentComposer'
import { EditProgrammingItem } from './EditProgrammingItem'
import { PreviewPanel } from './PreviewPanel'

export function ProgrammingPage({ companyId, displays, items, onReload }: { companyId: string; displays: TvDisplayRecord[]; items: TvPlaylistRecord[]; onReload: () => Promise<void> }) {
  const [composerOpen, setComposerOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<TvPlaylistRecord | null>(null)
  const [selectedDisplay, setSelectedDisplay] = useState(displays[0]?.id ?? '')
  const visibleItems = selectedDisplay ? items.filter(item => item.display_id === selectedDisplay) : items
  const selectedTv = displays.find(display => display.id === selectedDisplay)
  const displayNames = useMemo(() => new Map(displays.map(display => [display.id, display.name])), [displays])
  const groupedItems = useMemo(() => displays.map(display => ({ display, items: visibleItems.filter(item => item.display_id === display.id) })).filter(group => group.items.length), [displays, visibleItems])
  const scheduledCount = visibleItems.filter(item => hasSchedule(item)).length
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const moveItem = async ({ active, over }: DragEndEvent) => {
    if (!selectedDisplay || !over || active.id === over.id || !supabase) return
    const client = supabase
    const reordered = arrayMove(visibleItems, visibleItems.findIndex(item => item.id === active.id), visibleItems.findIndex(item => item.id === over.id))
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

  const contentList = (list: TvPlaylistRecord[], showTvName: boolean) => <DndContext sensors={sensors} onDragEnd={moveItem}>
    <SortableContext items={list} strategy={verticalListSortingStrategy}>
      <div className="timeline">{list.map(item => <SortableItem key={item.id} item={item} displayName={showTvName ? displayNames.get(item.display_id) : undefined} canReorder={Boolean(selectedDisplay)} onEdit={setEditingItem} onRemove={removeItem}/>)}</div>
    </SortableContext>
  </DndContext>

  return <>
    <div className="page-header"><div><h1>Programação</h1><p>Escolha uma TV, organize os conteúdos e defina quando cada um será exibido.</p></div><button className="button primary" onClick={() => setComposerOpen(true)}><Plus size={16}/> Adicionar conteúdo</button></div>

    <section className="card programming-control">
      <div className="programming-tv-select"><div><span className="step-label">1. Escolha onde configurar</span><strong>{selectedTv?.name ?? 'Visão geral de todas as TVs'}</strong><small>{selectedTv?.description ?? (selectedDisplay ? 'TV selecionada' : 'Os conteúdos estão agrupados por televisão.')}</small></div><label>Televisão<select value={selectedDisplay} onChange={event => setSelectedDisplay(event.target.value)}><option value="">Todas as TVs</option>{displays.map(display => <option key={display.id} value={display.id}>{display.name}</option>)}</select></label>{selectedDisplay ? <a className="button secondary" href={`/tv/${companyId}/${selectedDisplay}`} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Abrir TV</a> : null}</div>
      <div className="programming-summary"><div><strong>{visibleItems.length}</strong><span>conteúdos</span></div><div><strong>{visibleItems.length - scheduledCount}</strong><span>exibidos sempre</span></div><div><strong>{scheduledCount}</strong><span>com dias ou horários</span></div></div>
    </section>

    <div className="programming-layout"><section className="card programming-list"><div className="section-title"><div><span className="step-label">2. Organize e configure</span><h2>{selectedDisplay ? `Conteúdos de ${selectedTv?.name ?? 'TV'}` : 'Conteúdos por TV'}</h2></div><span className="badge">{visibleItems.length} itens</span></div>{selectedDisplay && visibleItems.length ? <p className="programming-hint">Arraste pelo marcador à esquerda para alterar a ordem de exibição.</p> : null}{visibleItems.length === 0 ? <div className="empty"><div><h3>Nenhum conteúdo configurado</h3><p>Adicione o primeiro conteúdo e escolha em quais TVs ele será exibido.</p><button className="button primary" onClick={() => setComposerOpen(true)}><Plus size={16}/> Adicionar primeiro conteúdo</button></div></div> : selectedDisplay ? contentList(visibleItems, false) : <div className="tv-program-groups">{groupedItems.map(group => <section key={group.display.id} className="tv-program-group"><header><div><strong>{group.display.name}</strong><span>{group.items.length} conteúdo(s)</span></div><a href={`/tv/${companyId}/${group.display.id}`} target="_blank" rel="noreferrer">Abrir TV <ExternalLink size={13}/></a></header>{contentList(group.items, true)}</section>)}</div>}</section><PreviewPanel items={visibleItems}/></div>

    {composerOpen ? <ContentComposer companyId={companyId} displays={displays} items={items} onClose={() => setComposerOpen(false)} onSaved={onReload}/> : null}
    {editingItem ? <EditProgrammingItem companyId={companyId} displays={displays} items={items} item={editingItem} onClose={() => setEditingItem(null)} onSaved={onReload}/> : null}
  </>
}

function SortableItem({ item, displayName, canReorder, onEdit, onRemove }: { item: TvPlaylistRecord; displayName?: string; canReorder: boolean; onEdit: (item: TvPlaylistRecord) => void; onRemove: (id: string) => Promise<void> }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id, disabled: !canReorder })
  const typeLabel = item.media.media_type === 'message' ? 'Texto' : item.media.media_type === 'video' ? 'Vídeo' : 'Imagem'
  const mediaUrl = item.media.public_url ?? item.media.media_url
  return <article ref={setNodeRef} className="timeline-item programming-item" style={{ transform: CSS.Transform.toString(transform), transition }}><button className="drag button" aria-label={`Reordenar ${item.media.title}`} disabled={!canReorder} {...attributes} {...listeners}><GripVertical size={18}/></button><MediaThumbnail item={item} url={mediaUrl}/><div className="timeline-copy"><div className="programming-item-title"><strong>{item.media.title}</strong>{displayName ? <span className="tv-name">{displayName}</span> : null}</div><div className="content-meta"><span>{typeLabel}</span><span>{item.media.duration_seconds ?? 10} segundos</span></div>{item.media.media_type === 'message' && item.media.message_text ? <small>{item.media.message_text}</small> : null}<div className={`schedule-summary ${hasSchedule(item) ? 'scheduled' : ''}`}><CalendarDays size={15}/><div><strong>{hasSchedule(item) ? 'Exibição programada' : 'Exibir sempre'}</strong><span>{scheduleSummary(item)}</span></div></div></div><div className="timeline-actions"><button className="button secondary configure-button" onClick={() => onEdit(item)}><Pencil size={15}/> Configurar</button>{item.media.media_type === 'image' && mediaUrl ? <button className="icon-button" onClick={() => void downloadImage(mediaUrl, item.media.title)} aria-label={`Baixar ${item.media.title}`} title="Salvar imagem"><Download size={16}/></button> : null}<button className="icon-button danger" onClick={() => void onRemove(item.id)} aria-label={`Remover ${item.media.title}`} title="Remover"><Trash2 size={16}/></button></div></article>
}

function hasSchedule(item: TvPlaylistRecord) {
  const media = item.media
  return Boolean(media.starts_at || media.ends_at || media.start_time || media.end_time || media.weekdays?.length)
}

function scheduleSummary(item: TvPlaylistRecord) {
  const media = item.media
  if (!hasSchedule(item)) return 'Todos os dias, durante todo o dia'
  const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const days = media.weekdays?.length ? media.weekdays.map(day => names[day]).join(', ') : 'Todos os dias'
  const time = media.start_time || media.end_time ? ` · ${media.start_time?.slice(0, 5) ?? '00:00'} até ${media.end_time?.slice(0, 5) ?? '23:59'}` : ''
  const period = media.starts_at || media.ends_at ? ` · ${media.starts_at ? new Date(media.starts_at).toLocaleDateString('pt-BR') : 'agora'} até ${media.ends_at ? new Date(media.ends_at).toLocaleDateString('pt-BR') : 'sem data final'}` : ''
  return `${days}${time}${period}`
}

function MediaThumbnail({ item, url }: { item: TvPlaylistRecord; url: string | null }) {
  if (item.media.media_type === 'image' && url) return <img className="timeline-thumbnail" src={url} alt="" loading="lazy"/>
  if (item.media.media_type === 'video' && url) return <div className="timeline-thumbnail thumbnail-video"><video src={url} preload="metadata" muted playsInline/><Video size={15}/></div>
  return <div className="timeline-thumbnail thumbnail-text" aria-hidden="true"><MessageSquareText size={18}/></div>
}

async function downloadImage(url: string, title: string) {
  const safeName = title.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ') || 'imagem'
  const extension = new URL(url, window.location.href).pathname.split('.').pop()?.toLowerCase()
  const filename = /^(jpe?g|png|webp|gif|avif)$/.test(extension ?? '') ? `${safeName}.${extension}` : `${safeName}.jpg`
  try {
    const response = await fetch(url, { mode: 'cors' })
    if (!response.ok) throw new Error(`Download indisponível (${response.status})`)
    const objectUrl = URL.createObjectURL(await response.blob())
    triggerDownload(objectUrl, filename)
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
  } catch {
    const link = document.createElement('a')
    link.href = url
    link.target = '_blank'
    link.rel = 'noreferrer'
    link.click()
  }
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}
