import { useState } from 'react'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/auth-context'
import { AdminShell } from './components/AdminShell'
import { LoginPage } from './components/LoginPage'
import { TvPlayer } from './components/TvPlayer'
import './App.css'

function getRoute() {
  const parts = window.location.pathname.split('/').filter(Boolean)
  if (parts[0] === 'tv' && parts.length === 2) return { type: 'tv' as const, companyId: '', displayId: parts[1] ?? '' }
  if (parts[0] === 'tv') return { type: 'tv' as const, companyId: parts[1] ?? '', displayId: parts[2] ?? '' }
  return { type: 'admin' as const }
}

export default function App() { return <AuthProvider><AuthenticatedApp /></AuthProvider> }

function AuthenticatedApp() {
  const [route] = useState(getRoute)
  const { user, profile, loading, error } = useAuth()
  if (loading && !user) return <main className="login-page"><div className="loading-screen">Verificando sua sessão...</div></main>
  if (!user || !profile) return <LoginPage />
  if (route.type === 'tv') {
    if (route.companyId && route.companyId !== profile.companyId) return <main className="access-denied" role="alert"><h1>Acesso negado</h1><p>Esta TV não pertence à empresa da sua sessão.</p></main>
    return <TvPlayer companyId={profile.companyId} displayId={route.displayId} />
  }
  return <AdminShell profile={profile} authError={error} />
}
