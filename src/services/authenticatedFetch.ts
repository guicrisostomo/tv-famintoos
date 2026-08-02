import { supabase } from './supabase'

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  if (!supabase) throw new Error('Supabase não configurado.')
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) throw new Error('Sessão ausente ou expirada.')
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${data.session.access_token}`)
  return fetch(input, { ...init, headers })
}
