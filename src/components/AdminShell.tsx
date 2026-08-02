import { useState } from 'react'
import { BarChart3, Blocks, CalendarClock, Clapperboard, Cloud, LayoutDashboard, Megaphone, MonitorPlay, Palette, Plus, Radio, Settings2, Tv, Users } from 'lucide-react'
import { ProgrammingPage } from './ProgrammingPage'
import { useAuth, type CompanyProfile } from '../auth/auth-context'
import { ConnectionBanner } from './ConnectionBanner'
import { useTvData } from '../hooks/useTvData'
import { ContentComposer } from './ContentComposer'
import { TvSetupPage } from './TvSetupPage'
import { CallsPage } from './CallsPage'
import { useTvCalls } from '../hooks/useTvCalls'

const navigation = [
  ['Visão geral', LayoutDashboard], ['Canal', Radio], ['Programação', Clapperboard],
  ['Blocos', Blocks], ['Campanhas', Megaphone], ['Intervalos', CalendarClock],
  ['Grade horária', CalendarClock], ['Personalização', Palette], ['Chamadas', Users],
  ['Relatórios', BarChart3], ['Armazenamento', Cloud], ['Configurações', Settings2],
] as const

export function AdminShell({ profile, authError }: { profile: CompanyProfile, authError: string | null }) {
  const [page, setPage] = useState('Visão geral')
  const [selectedDisplay, setSelectedDisplay] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const { signOut } = useAuth()
  const tvData = useTvData(profile.companyId)
  const callData = useTvCalls(profile.companyId)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Tv size={20} /></span><span>Famintoos TV</span></div>
        <nav aria-label="Navegação principal">
          {navigation.map(([label, Icon]) => (
            <button key={label} className={`nav-button ${page === label ? 'active' : ''}`} onClick={() => setPage(label)} type="button">
              <Icon size={17} aria-hidden="true" /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">Canal de TV · conteúdo próprio ou licenciado</div>
      </aside>
      <main className="main">
        <ConnectionBanner />
        {authError ? <div className="connection-banner error" role="alert">{authError}</div> : null}
        {tvData.error ? <div className="connection-banner error" role="alert">Supabase: {tvData.error}</div> : null}
        {callData.error ? <div className="connection-banner error" role="alert">Chamadas: {callData.error}</div> : null}
        <header className="topbar">
          <div className="tv-switcher"><select className="channel-picker" aria-label="TV selecionada" value={selectedDisplay} onChange={e => setSelectedDisplay(e.target.value)}><option value="">Todas as TVs</option>{tvData.displays.map(display => <option key={display.id} value={display.id}>{display.name}</option>)}</select>{selectedDisplay ? <a className="button secondary" href={`/tv/${profile.companyId}/${selectedDisplay}`} target="_blank" rel="noreferrer">Exibir na TV</a> : null}</div>
          <div className="account-menu"><div><strong>{profile.name ?? profile.email ?? 'Usuário'}</strong><span>Empresa {profile.companyId}</span></div><div className="avatar" aria-label="Conta da empresa">{(profile.name ?? profile.email ?? 'U').slice(0, 2).toUpperCase()}</div><button className="button secondary" onClick={() => void signOut()}>Sair</button></div>
        </header>
        <div className="content">
          {page === 'Visão geral' ? <Dashboard displays={tvData.displays} itemCount={tvData.items.length} onCreate={() => setComposerOpen(true)} /> : null}
          {page === 'Canal' ? <TvSetupPage companyId={profile.companyId} displays={tvData.displays} onSaved={tvData.reload}/> : null}
          {page === 'Programação' ? <ProgrammingPage companyId={profile.companyId} displays={tvData.displays} items={tvData.items} onReload={tvData.reload}/> : null}
          {page === 'Chamadas' ? <CallsPage companyId={profile.companyId} displays={tvData.displays} calls={callData.calls} loading={callData.loading} onReload={callData.reload}/> : null}
          {page === 'Personalização' || page === 'Blocos' || page === 'Campanhas' || page === 'Intervalos' || page === 'Grade horária' ? <ConfigurationPage title={page} onAdd={() => setComposerOpen(true)} /> : null}
          {page === 'Relatórios' ? <EmptyPage title="Relatório de exibições" description="As impressões reais aparecerão aqui após a primeira reprodução concluída." /> : null}
          {page === 'Armazenamento' ? <StoragePage /> : null}
          {page === 'Configurações' ? <ConfigurationPage title="Configurações" /> : null}
        </div>
      </main>
      {composerOpen ? <ContentComposer companyId={profile.companyId} displays={tvData.displays} items={tvData.items} onClose={() => setComposerOpen(false)} onSaved={tvData.reload}/> : null}
    </div>
  )
}

function Dashboard({ displays, itemCount, onCreate }: { displays: import('../hooks/useTvData').TvDisplayRecord[]; itemCount: number; onCreate: () => void }) {
  const displayCount = displays.length
  return <>
    <div className="page-header"><div><h1>Canal de TV</h1><p>Organize a programação contínua das televisões da sua empresa.</p></div><button className="button primary" onClick={onCreate}><Plus size={17} /> Criar programação</button></div>
    <div className="cards">
      <Stat label="TVs configuradas" value={String(displayCount)} detail={displayCount ? 'Telas vinculadas à empresa' : 'Nenhuma TV vinculada'} />
      <Stat label="Itens em programação" value={String(itemCount)} detail={itemCount ? 'Conteúdos distribuídos nas TVs' : 'Configure o primeiro conteúdo'} />
      <Stat label="Campanhas válidas" value="0" detail="Sem campanhas cadastradas" />
      <Stat label="Exibições hoje" value="0" detail="Nenhuma impressão registrada" />
    </div>
    <div className="grid-2">
      <section className="card"><div className="section-title"><h2>Programação atual</h2></div>{itemCount > 0 ? <div className="dashboard-summary"><MonitorPlay size={28}/><strong>{itemCount} {itemCount === 1 ? 'conteúdo configurado' : 'conteúdos configurados'}</strong><p>Use a seção Programação para visualizar, reordenar ou remover itens.</p></div> : <EmptyState onCreate={onCreate} />}</section>
      <section className="card"><div className="section-title"><h2>Status das TVs</h2></div><div className="status-list">{displays.length > 0 ? displays.map(display => <div className="status-row" key={display.id}><span className={`status-dot ${display.is_active ? 'online' : ''}`} /><div className="status-copy"><strong>{display.name}</strong><span>{display.is_active ? 'TV ativa e disponível para exibição' : 'TV desativada'}</span></div></div>) : <div className="status-row"><span className="status-dot" /><div className="status-copy"><strong>Nenhuma TV configurada</strong><span>Cadastre uma TV para acompanhar o status.</span></div></div>}</div></section>
    </div>
  </>
}

function Stat({ label, value, detail }: { label: string, value: string, detail: string }) {
  return <article className="card"><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></article>
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return <div className="empty"><div><div className="empty-icon"><MonitorPlay size={23} /></div><h3>Sua TV ainda não tem programação</h3><p>Adicione somente conteúdos da sua empresa ou devidamente licenciados. Até lá, a tela pública permanecerá preta.</p><button className="button primary" onClick={onCreate}><Plus size={16} /> Montar programação</button></div></div>
}

function EmptyPage({ title, description, onAdd }: { title: string; description: string; onAdd?: () => void }) {
  return <><div className="page-header"><div><h1>{title}</h1><p>{description}</p></div></div><section className="card"><div className="empty"><div><div className="empty-icon"><Settings2 size={22} /></div><h3>Nenhuma configuração salva</h3><p>As configurações serão aplicadas à empresa autenticada e poderão ser sobrescritas por TV.</p>{onAdd ? <button className="button primary" onClick={onAdd}><Plus size={16} /> Adicionar texto ou imagem</button> : null}</div></div></section></>
}

function ConfigurationPage({ title, onAdd }: { title: string; onAdd?: () => void }) {
  return <EmptyPage title={title} description="Personalize este recurso para a empresa e para cada TV selecionada." onAdd={onAdd} />
}

function StoragePage() {
  return <><div className="page-header"><div><h1>Armazenamento</h1><p>Provedores usados pelas mídias do canal.</p></div></div><section className="card"><div className="storage-note"><Cloud size={22} /><div><strong>Cloudflare R2 preferencial</strong><p>Uploads exigem um endpoint autenticado que forneça URL pré-assinada. Supabase Storage e URLs externas continuam compatíveis. Nenhuma credencial de escrita é aceita no navegador.</p></div></div></section></>
}
