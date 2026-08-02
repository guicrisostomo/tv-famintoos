import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../services/supabase'

export interface TvCallRecord {
  id: string
  company_id: string
  display_id: string | null
  customer_name: string | null
  call_text: string
  status: 'pending' | 'showing' | 'completed' | 'cancelled'
  requested_at: string
  displayed_at: string | null
  completed_at: string | null
}

export function useTvCalls(companyId: string) {
  const [calls, setCalls] = useState<TvCallRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!supabase) { setError('Supabase não configurado.'); setLoading(false); return }
    const { data, error: queryError } = await supabase.from('tv_calls').select('id,company_id,display_id,customer_name,call_text,status,requested_at,displayed_at,completed_at').eq('company_id', companyId).order('requested_at', { ascending: false }).limit(100)
    if (queryError) setError(queryError.message)
    else { setCalls(data as TvCallRecord[]); setError(null) }
    setLoading(false)
  }, [companyId])

  useEffect(() => { const timer = window.setTimeout(() => void reload(), 0); return () => window.clearTimeout(timer) }, [reload])
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    const channel = client.channel(`admin-calls:${companyId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'tv_calls', filter: `company_id=eq.${companyId}` }, () => void reload()).subscribe()
    return () => { void client.removeChannel(channel) }
  }, [companyId, reload])

  return { calls, loading, error, reload }
}
