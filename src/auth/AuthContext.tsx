import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'
import { AuthContext, type CompanyProfile } from './auth-context'

function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (/invalid login credentials/i.test(message)) return 'E-mail ou senha incorretos.'
  if (/failed to fetch|network/i.test(message)) return 'Não foi possível conectar ao Supabase. Verifique sua internet e tente novamente.'
  return message || 'Não foi possível autenticar.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAuthenticatedUser = useCallback(async () => {
    if (!supabase) { setError('Supabase não configurado. Informe as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.'); setUser(null); setProfile(null); setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!userData.user) { setUser(null); setProfile(null); return }
      const { data, error: profileError } = await supabase.from('tb_user').select('uid,email,name,cnpj,typeUserId,fg_ativo').eq('uid', userData.user.id).eq('fg_ativo', true).single()
      if (profileError) throw profileError
      if (!data.cnpj) throw new Error('Seu usuário não está vinculado a uma empresa ativa.')
      setUser(userData.user)
      setProfile({ uid: data.uid, email: data.email, name: data.name, companyId: data.cnpj, userType: data.typeUserId })
    } catch (caught) { setUser(null); setProfile(null); setError(authErrorMessage(caught)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAuthenticatedUser(), 0)
    if (!supabase) return () => window.clearTimeout(timer)
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') void loadAuthenticatedUser()
      if (event === 'SIGNED_OUT') { setUser(null); setProfile(null); setError(null); setLoading(false) }
    })
    return () => { window.clearTimeout(timer); listener.subscription.unsubscribe() }
  }, [loadAuthenticatedUser])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) { setError('Supabase não configurado.'); return }
    setLoading(true); setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (signInError) { setLoading(false); setError(authErrorMessage(signInError)); throw signInError }
    await loadAuthenticatedUser()
  }, [loadAuthenticatedUser])
  const signOut = useCallback(async () => { if (supabase) await supabase.auth.signOut(); setUser(null); setProfile(null) }, [])
  const value = useMemo(() => ({ user, profile, loading, error, signIn, signOut, retry: loadAuthenticatedUser }), [user, profile, loading, error, signIn, signOut, loadAuthenticatedUser])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
