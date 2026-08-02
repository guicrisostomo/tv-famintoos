import { useEffect, useState } from 'react'
import { CloudOff, RefreshCw } from 'lucide-react'
import { supabase } from '../services/supabase'
import { authenticatedFetch } from '../services/authenticatedFetch'

type Status = 'checking' | 'online' | 'error'
export function ConnectionBanner() {
  const [state, setState] = useState<{ supabase: Status; r2: Status; detail?: string }>({ supabase: 'checking', r2: 'checking' })
  const check = async () => {
    setState({ supabase: 'checking', r2: 'checking' })
    const databasePromise = supabase ? supabase.rpc('get_current_user_cnpj') : Promise.resolve({ error: new Error('Supabase não configurado') })
    const r2Promise = authenticatedFetch('/api/tv/media/health').then(async response => {
      if (response.ok) return null
      const body = await response.json().catch(() => null) as { error?: string } | null
      return new Error(body?.error || `HTTP ${response.status}`)
    }).catch(error => error as Error)
    const [database, r2Error] = await Promise.all([databasePromise, r2Promise])
    setState({ supabase: database.error ? 'error' : 'online', r2: r2Error ? 'error' : 'online', detail: database.error?.message ?? r2Error?.message })
  }
  useEffect(() => { const timer = window.setTimeout(() => void check(), 0); return () => window.clearTimeout(timer) }, [])
  if (state.supabase === 'online' && state.r2 === 'online') return null
  const checking = state.supabase === 'checking' || state.r2 === 'checking'
  return <div className={`connection-banner ${checking ? 'checking' : 'error'}`} role="status">{checking ? <RefreshCw className="spin" size={17}/> : <CloudOff size={18}/>}<div><strong>{checking ? 'Verificando serviços...' : 'Há um problema de conexão'}</strong>{!checking ? <span>Supabase: {state.supabase === 'online' ? 'conectado' : 'indisponível'} · Cloudflare R2: {state.r2 === 'online' ? 'conectado' : 'indisponível'}{state.detail ? ` — ${state.detail}` : ''}</span> : null}</div>{!checking ? <button type="button" onClick={() => void check()} aria-label="Verificar conexões novamente"><RefreshCw size={16}/></button> : null}</div>
}
