import { useState, type FormEvent } from 'react'
import { AlertTriangle, LoaderCircle, LockKeyhole, Tv } from 'lucide-react'
import { useAuth } from '../auth/auth-context'

export function LoginPage() {
  const { signIn, loading, error, retry } = useAuth()
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const submit = async (event: FormEvent) => { event.preventDefault(); try { await signIn(email, password) } catch { /* Context displays the error. */ } }
  return <main className="login-page"><section className="login-card" aria-labelledby="login-title">
    <div className="login-brand"><span className="brand-mark"><Tv size={22}/></span><span>Famintoos TV</span></div><div className="login-icon"><LockKeyhole size={25}/></div>
    <h1 id="login-title">Acesse sua conta</h1><p>Entre para gerenciar somente as TVs e conteúdos da sua empresa.</p>
    {error ? <div className="system-alert error" role="alert"><AlertTriangle size={18}/><div><strong>Falha na conexão ou autenticação</strong><span>{error}</span><button type="button" className="link-button" onClick={() => void retry()}>Tentar conexão novamente</button></div></div> : null}
    <form onSubmit={submit} className="login-form"><label>E-mail<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required/></label><label>Senha<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required/></label><button className="button primary login-submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18}/> Conectando...</> : 'Entrar'}</button></form>
  </section></main>
}
