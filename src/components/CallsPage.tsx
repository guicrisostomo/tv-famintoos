import { useMemo, useState, type FormEvent } from 'react'
import { BellRing, LoaderCircle, Trash2, Volume2 } from 'lucide-react'
import type { TvDisplayRecord } from '../hooks/useTvData'
import type { TvCallRecord } from '../hooks/useTvCalls'
import { supabase } from '../services/supabase'

const statusLabel: Record<TvCallRecord['status'], string> = { pending: 'Aguardando a TV', showing: 'Sendo chamado', completed: 'Concluída', cancelled: 'Cancelada' }

export function CallsPage({ companyId, displays, calls, loading, onReload }: { companyId: string; displays: TvDisplayRecord[]; calls: TvCallRecord[]; loading: boolean; onReload: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [selectedDisplays, setSelectedDisplays] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const displayNames = useMemo(() => new Map(displays.map(display => [display.id, display.name])), [displays])

  const toggleDisplay = (id: string) => setSelectedDisplays(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || saving) return
    const cleanName = name.trim().replace(/\s+/g, ' ')
    if (!cleanName) { setError('Informe o nome da pessoa.'); return }
    if (selectedDisplays.length === 0) { setError('Selecione pelo menos uma TV.'); return }
    setSaving(true); setError(null)
    const rows = selectedDisplays.map(displayId => ({ company_id: companyId, display_id: displayId, customer_name: cleanName, call_text: `Chamando ${cleanName}`, status: 'pending' }))
    const { error: insertError } = await supabase.from('tv_calls').insert(rows)
    if (insertError) setError(insertError.message)
    else { setName(''); await onReload() }
    setSaving(false)
  }
  const clearHistory = async () => {
    if (!supabase || calls.length === 0 || !window.confirm('Limpar todo o histórico de chamadas? Chamadas ainda pendentes também serão removidas.')) return
    setClearing(true); setError(null)
    const { data: deleted, error: deleteError } = await supabase.from('tv_calls').delete().eq('company_id', companyId).select('id')
    if (deleteError) setError(deleteError.message)
    else if (!deleted?.length) setError('O Supabase não autorizou a limpeza do histórico. Atualize a sessão e tente novamente.')
    else await onReload()
    setClearing(false)
  }

  return <>
    <div className="page-header"><div><h1>Chamadas</h1><p>Digite apenas o nome; a TV exibirá e falará a chamada.</p></div></div>
    <div className="grid-2 calls-layout"><section className="card"><div className="section-title"><h2>Chamar uma pessoa</h2><Volume2 size={19}/></div><form className="editor-form" onSubmit={submit}><label>Nome da pessoa<input value={name} onChange={event => setName(event.target.value)} maxLength={100} placeholder="Ex.: Maria da Silva" autoFocus required/></label><fieldset><legend>Exibir e falar nas TVs</legend>{displays.length === 0 ? <p className="form-hint">Cadastre primeiro uma TV na seção Canal.</p> : <div className="check-grid">{displays.map(display => <label key={display.id}><input type="checkbox" checked={selectedDisplays.includes(display.id)} onChange={() => toggleDisplay(display.id)}/><span>{display.name}</span></label>)}</div>}</fieldset><p className="form-hint">A TV precisa ter sido iniciada pelo botão “Iniciar exibição” para o navegador permitir o áudio.</p>{error ? <div className="form-error" role="alert">{error}</div> : null}<button className="button primary" disabled={saving || displays.length === 0}>{saving ? <LoaderCircle className="spin" size={17}/> : <BellRing size={17}/>} Chamar agora</button></form></section>
      <section className="card call-help"><div className="section-title"><h2>Como será anunciado</h2></div><div className="call-example"><BellRing size={26}/><strong>{name.trim() || 'Nome da pessoa'}</strong><span>“Chamando {name.trim() || 'nome da pessoa'}. Por favor, compareça ao atendimento.”</span></div></section></div>
    {calls.length > 0 ? <section className="card call-history"><div className="section-title"><div><h2>Pessoas chamadas</h2><p>Últimas 100 chamadas desta empresa</p></div><button className="button danger" onClick={() => void clearHistory()} disabled={clearing}>{clearing ? <LoaderCircle className="spin" size={16}/> : <Trash2 size={16}/>} Limpar histórico</button></div><div className="history-list">{calls.map(call => <article key={call.id} className="history-row"><div><strong>{call.customer_name ?? call.call_text}</strong><span>{call.display_id ? displayNames.get(call.display_id) ?? 'TV removida' : 'Todas as TVs'}</span></div><div><time dateTime={call.requested_at}>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(call.requested_at))}</time><span className={`call-status ${call.status}`}>{statusLabel[call.status]}</span></div></article>)}</div></section> : loading ? <div className="loading-inline">Carregando chamadas...</div> : null}
  </>
}
