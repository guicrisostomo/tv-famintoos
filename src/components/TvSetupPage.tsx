import { useState, type FormEvent } from 'react'
import { ExternalLink, LoaderCircle, Monitor, Plus } from 'lucide-react'
import { supabase } from '../services/supabase'
import type { TvDisplayRecord } from '../hooks/useTvData'

export function TvSetupPage({ companyId, displays, onSaved }: { companyId: string; displays: TvDisplayRecord[]; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!supabase) return
    setSaving(true); setError(null)
    const { error: saveError } = await supabase.from('tv_displays').insert({ company_id: companyId, name: name.trim(), description: description.trim() || null })
    if (saveError) setError(saveError.message); else { setName(''); setDescription(''); await onSaved() }
    setSaving(false)
  }
  return <><div className="page-header"><div><h1>Canal</h1><p>Cadastre as telas da empresa e abra a exibição pública.</p></div></div><div className="grid-2"><section className="card"><div className="section-title"><h2>Adicionar TV</h2></div><form className="editor-form" onSubmit={submit}><label>Nome da TV<input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: TV do salão" required/></label><label>Descrição<textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Onde esta TV está instalada"/></label>{error ? <div className="form-error" role="alert">{error}</div> : null}<button className="button primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16}/> : <Plus size={16}/>} Salvar TV</button></form></section><section className="card"><div className="section-title"><h2>TVs da empresa</h2><span className="badge">{displays.length}</span></div>{displays.length === 0 ? <div className="empty compact"><div><Monitor size={24}/><h3>Nenhuma TV cadastrada</h3><p>Cadastre uma TV para associar textos e imagens.</p></div></div> : <div className="display-list">{displays.map(display => <div className="display-row" key={display.id}><div><strong>{display.name}</strong><span>{display.description ?? 'Sem descrição'}</span></div><a className="button secondary" href={`/tv/${companyId}/${display.id}`} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Exibir na TV</a></div>)}</div>}</section></div></>
}
