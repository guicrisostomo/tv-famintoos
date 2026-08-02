import { useMemo, useState, type FormEvent } from 'react'
import { Check, FileImage, LoaderCircle, MessageSquareText, Upload, X } from 'lucide-react'
import type { TvDisplayRecord, TvPlaylistRecord } from '../hooks/useTvData'
import { requestR2Upload, uploadToR2 } from '../services/storage'
import { supabase } from '../services/supabase'

async function sha256(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export function ContentComposer({ companyId, displays, items, onClose, onSaved }: { companyId: string; displays: TvDisplayRecord[]; items: TvPlaylistRecord[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [type, setType] = useState<'message' | 'image'>('message')
  const [title, setTitle] = useState(''); const [message, setMessage] = useState(''); const [duration, setDuration] = useState(10)
  const [file, setFile] = useState<File | null>(null); const [selectedDisplays, setSelectedDisplays] = useState<string[]>([])
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null); const [saved, setSaved] = useState(false)
  const selectedNames = useMemo(() => displays.filter(display => selectedDisplays.includes(display.id)).map(display => display.name), [displays, selectedDisplays])
  const toggleDisplay = (id: string) => setSelectedDisplays(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])

  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!supabase) return
    if (selectedDisplays.length === 0) { setError('Selecione pelo menos uma TV.'); return }
    if (type === 'image' && !file) { setError('Selecione uma imagem.'); return }
    if (type === 'message' && !message.trim()) { setError('Digite o texto que será exibido.'); return }
    setSaving(true); setError(null)
    try {
      let mediaUrl: string | null = null; let storageKey: string | null = null; let r2AssetId: number | null = null
      if (type === 'image' && file) {
        const ticket = await requestR2Upload(file, 'image')
        if (!ticket.publicUrl) throw new Error('O Cloudflare R2 não retornou uma URL pública. Confira R2_PUBLIC_BASE_URL na Vercel.')
        await uploadToR2(ticket, file)
        mediaUrl = ticket.publicUrl; storageKey = ticket.storageKey
        const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() ?? null : null
        const { data: asset, error: assetError } = await supabase.from('r2_media_assets').insert({ business_cnpj: companyId, original_name: file.name, file_ext: extension, mime_type: file.type, file_size: file.size, sha256: await sha256(file), r2_key: ticket.storageKey, public_url: ticket.publicUrl, bucket_folder: 'tv', media_kind: 'image', metadata: { source: 'famintoos_tv' } }).select('id').single()
        if (assetError) throw assetError
        r2AssetId = asset.id
      }
      const { data: media, error: mediaError } = await supabase.from('tv_media').insert({ company_id: companyId, title: title.trim() || (type === 'message' ? 'Mensagem' : file?.name ?? 'Imagem'), media_type: type, media_url: mediaUrl, message_text: type === 'message' ? message.trim() : null, duration_seconds: duration, is_active: true, storage_provider: type === 'image' ? 'cloudflare_r2' : null, storage_key: storageKey, public_url: mediaUrl, mime_type: file?.type ?? null, file_size: file?.size ?? null, r2_asset_id: r2AssetId }).select('id').single()
      if (mediaError) throw mediaError
      const maxPosition = new Map<string, number>()
      for (const item of items) maxPosition.set(item.display_id, Math.max(maxPosition.get(item.display_id) ?? -1, item.position))
      const rows = selectedDisplays.map(displayId => ({ company_id: companyId, display_id: displayId, media_id: media.id, position: (maxPosition.get(displayId) ?? -1) + 1, is_active: true }))
      const { error: playlistError } = await supabase.from('tv_playlist_items').insert(rows)
      if (playlistError) { await supabase.from('tv_media').delete().eq('id', media.id); throw playlistError }
      await onSaved(); setSaved(true)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível salvar o conteúdo.') }
    finally { setSaving(false) }
  }

  return <div className="modal-backdrop" role="presentation"><section className="composer-modal" role="dialog" aria-modal="true" aria-labelledby="composer-title"><div className="modal-header"><div><h2 id="composer-title">Adicionar conteúdo</h2><p>Configure o que será exibido e em quais TVs.</p></div><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20}/></button></div>{saved ? <div className="success-state"><span><Check size={28}/></span><h3>Conteúdo adicionado</h3><p>Será carregado automaticamente em: {selectedNames.join(', ')}.</p><div className="modal-actions">{selectedDisplays.map(id => <a key={id} className="button secondary" href={`/tv/${companyId}/${id}`} target="_blank" rel="noreferrer">Exibir em {displays.find(d => d.id === id)?.name}</a>)}<button className="button primary" onClick={onClose}>Concluir</button></div></div> : <form onSubmit={submit}><div className="content-type-picker"><button type="button" className={type === 'message' ? 'active' : ''} onClick={() => setType('message')}><MessageSquareText size={20}/><span>Texto</span></button><button type="button" className={type === 'image' ? 'active' : ''} onClick={() => setType('image')}><FileImage size={20}/><span>Imagem</span></button></div><div className="editor-form"><label>Título<input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome para identificar no painel"/></label>{type === 'message' ? <label>Texto exibido<textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="Digite a mensagem para os clientes" required/></label> : <label className="file-picker"><Upload size={20}/><span>{file ? file.name : 'Selecionar imagem JPG, PNG ou WebP'}</span><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} required/></label>}<label>Duração em segundos<input type="number" min={3} max={300} value={duration} onChange={e => setDuration(Number(e.target.value))} required/></label><fieldset><legend>Exibir nas TVs</legend>{displays.length === 0 ? <p className="form-hint">Cadastre primeiro uma TV na seção Canal.</p> : <div className="check-grid">{displays.map(display => <label key={display.id}><input type="checkbox" checked={selectedDisplays.includes(display.id)} onChange={() => toggleDisplay(display.id)}/><span>{display.name}</span></label>)}</div>}</fieldset>{error ? <div className="form-error" role="alert">{error}</div> : null}</div><div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" disabled={saving || displays.length === 0}>{saving ? <LoaderCircle className="spin" size={17}/> : <Upload size={17}/>} Salvar e exibir</button></div></form>}</section></div>
}
