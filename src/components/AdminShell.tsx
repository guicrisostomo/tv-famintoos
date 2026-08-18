import {
  BellRing,
  Calendar,
  Clapperboard,
  Home,
  Megaphone,
  MonitorPlay,
  Palette,
  Plus,
  Settings2,
  Tv,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth, type CompanyProfile } from '../auth/auth-context';
import type { PromotionRecord } from '../domain/promotion';
import { usePromotions } from '../hooks/usePromotions';
import { useTvCalls } from '../hooks/useTvCalls';
import { useTvData } from '../hooks/useTvData';
import { CallsPage } from './CallsPage';
import { ConnectionBanner } from './ConnectionBanner';
import { MediaLibraryPage } from './MediaLibraryPage';
import { PlannerPage } from './PlannerPage';
import { ProgrammingPage } from './ProgrammingPage';
import { PromotionEditorPage } from './PromotionEditorPage';
import { PromotionsPage } from './PromotionsPage';
import { TvSetupPage } from './TvSetupPage';

const navigation = [
  ['Início', Home],
  ['Criar promoção', Palette],
  ['Promoções', Megaphone],
  ['Programação', Clapperboard],
  ['Planejamento', Calendar],
  ['Chamadas', BellRing],
  ['TVs', MonitorPlay],
  ['Configurações', Settings2],
] as const;
type Page = (typeof navigation)[number][0];
export function AdminShell({
  profile,
  authError,
}: {
  profile: CompanyProfile;
  authError: string | null;
}) {
  const [page, setPage] = useState<Page>('Início');
  const [selectedDisplay, setSelectedDisplay] = useState('');
  const [editing, setEditing] = useState<PromotionRecord | null>(null);
  const { signOut } = useAuth();
  const tvData = useTvData(profile.companyId);
  const callData = useTvCalls(profile.companyId);
  const promotionData = usePromotions(profile.companyId);
  const navigate = (next: Page) => {
    if (next === 'Criar promoção') setEditing(null);
    setPage(next);
  };
  const reloadAll = async () => {
    await Promise.all([tvData.reload(), promotionData.reload()]);
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Tv size={20} />
          </span>
          <span>Famintoos TV</span>
        </div>
        <nav aria-label="Navegação principal">
          {navigation.map(([label, Icon]) => (
            <button
              key={label}
              className={`nav-button ${page === label ? 'active' : ''}`}
              onClick={() => navigate(label)}
              type="button"
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">Promoções e chamadas na sua TV</div>
      </aside>
      <main className="main">
        <ConnectionBanner />
        {authError ? (
          <div className="connection-banner error" role="alert">
            {authError}
          </div>
        ) : null}
        {tvData.error ? (
          <div className="connection-banner error" role="alert">
            Supabase: {tvData.error}
          </div>
        ) : null}
        {promotionData.error ? (
          <div className="connection-banner error" role="alert">
            Promoções: {promotionData.error}
          </div>
        ) : null}
        <header className="topbar">
          <div className="tv-switcher">
            <select
              className="channel-picker"
              aria-label="TV selecionada"
              value={selectedDisplay}
              onChange={(event) => setSelectedDisplay(event.target.value)}
            >
              <option value="">Todas as TVs</option>
              {tvData.displays.map((display) => (
                <option key={display.id} value={display.id}>
                  {display.name}
                </option>
              ))}
            </select>
            {selectedDisplay ? (
              <a
                className="button secondary"
                href={`/tv/${profile.companyId}/${selectedDisplay}`}
                target="_blank"
                rel="noreferrer"
              >
                Abrir TV
              </a>
            ) : null}
          </div>
          <div className="account-menu">
            <div>
              <strong>{profile.name ?? profile.email ?? 'Usuário'}</strong>
              <span>Empresa {profile.companyId}</span>
            </div>
            <div className="avatar">
              {(profile.name ?? profile.email ?? 'U').slice(0, 2).toUpperCase()}
            </div>
            <button className="button secondary" onClick={() => void signOut()}>
              Sair
            </button>
          </div>
        </header>
        <div className="content">
          {page === 'Início' ? (
            <Dashboard
              displays={tvData.displays}
              items={tvData.items.length}
              promotions={promotionData.promotions}
              calls={callData.calls.slice(0, 5)}
              onNavigate={navigate}
            />
          ) : null}
          {page === 'Criar promoção' ? (
            <PromotionEditorPage
              key={editing?.id ?? 'new'}
              companyId={profile.companyId}
              displays={tvData.displays}
              media={tvData.media}
              items={tvData.items}
              editing={editing}
              onSaved={reloadAll}
            />
          ) : null}
          {page === 'Promoções' ? (
            <PromotionsPage
              companyId={profile.companyId}
              promotions={promotionData.promotions}
              displays={tvData.displays}
              onEdit={(promotion) => {
                setEditing(promotion);
                setPage('Criar promoção');
              }}
              onCreate={() => navigate('Criar promoção')}
              onReload={reloadAll}
            />
          ) : null}
          {page === 'Programação' ? (
            <ProgrammingPage
              companyId={profile.companyId}
              displays={tvData.displays}
              items={tvData.items}
              onReload={tvData.reload}
            />
          ) : null}
          {page === 'Planejamento' ? (
            <PlannerPage companyId={profile.companyId} displays={tvData.displays} items={tvData.items} />
          ) : null}
          {page === 'Chamadas' ? (
            <CallsPage
              companyId={profile.companyId}
              displays={tvData.displays}
              calls={callData.calls}
              loading={callData.loading}
              onReload={callData.reload}
            />
          ) : null}
          {page === 'TVs' ? (
            <TvSetupPage
              companyId={profile.companyId}
              displays={tvData.displays}
              onSaved={tvData.reload}
            />
          ) : null}
          {page === 'Configurações' ? (
            <SettingsPage
              mediaProps={{ media: tvData.media, items: tvData.items, displays: tvData.displays, onReload: tvData.reload }}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

function Dashboard({
  displays,
  items,
  promotions,
  calls,
  onNavigate,
}: {
  displays: import('../hooks/useTvData').TvDisplayRecord[];
  items: number;
  promotions: PromotionRecord[];
  calls: import('../hooks/useTvCalls').TvCallRecord[];
  onNavigate: (page: Page) => void;
}) {
  const active = promotions.find((promotion) => promotion.status === 'active');
  const next = promotions.find((promotion) => promotion.status === 'scheduled');
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Início</h1>
          <p>O essencial para manter suas televisões atualizadas.</p>
        </div>
        <button className="button primary" onClick={() => onNavigate('Criar promoção')}>
          <Plus size={17} /> Criar promoção
        </button>
      </div>
      <div className="cards">
        <Stat
          label="TVs ativas"
          value={String(displays.filter((display) => display.is_active).length)}
          detail={`${displays.length} cadastrada(s)`}
        />
        <Stat
          label="Conteúdos na programação"
          value={String(items)}
          detail={
            items ? 'Distribuídos nas TVs escolhidas' : 'Esta TV ainda não possui programação.'
          }
        />
        <Stat
          label="Em exibição"
          value={active?.title ?? 'Nenhuma'}
          detail={active ? 'Promoção ativa' : 'Sem promoção ativa'}
        />
        <Stat
          label="Próxima promoção"
          value={next?.title ?? 'Nenhuma'}
          detail={next ? 'Agendada' : 'Sem agendamento'}
        />
      </div>
      <div className="quick-actions">
        <button className="card" onClick={() => onNavigate('Criar promoção')}>
          <Palette />
          Criar promoção
        </button>
        <button className="card" onClick={() => onNavigate('Chamadas')}>
          <BellRing />
          Chamar cliente
        </button>
        <button className="card" onClick={() => onNavigate('Programação')}>
          <Clapperboard />
          Ver programação
        </button>
        <button className="card" onClick={() => onNavigate('Planejamento')}>
          <Calendar />
          Ver planejamento
        </button>
        <button className="card" onClick={() => onNavigate('TVs')}>
          <MonitorPlay />
          Abrir TV
        </button>
      </div>
      {calls.length ? (
        <section className="card">
          <div className="section-title">
            <h2>Últimas chamadas</h2>
          </div>
          <div className="history-list">
            {calls.map((call) => (
              <div className="history-row" key={call.id}>
                <strong>{call.customer_name ?? call.call_text}</strong>
                <time>
                  {new Date(call.requested_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="card">
      <div className="stat-label">{label}</div>
      <div className="stat-value compact-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </article>
  );
}
function SettingsPage({
  mediaProps,
}: {
  mediaProps: React.ComponentProps<typeof MediaLibraryPage>;
}) {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Configurações</h1>
          <p>Identidade, integrações e opções menos usadas.</p>
        </div>
      </div>
      <section className="card">
        <h2>Configurações gerais</h2>
        <p>
          As configurações de chamadas ficam na página Chamadas e as opções de cada televisão ficam
          em TVs.
        </p>
      </section>
      <details className="card advanced-settings">
        <summary>Configurações avançadas</summary>
        <div className="storage-note">
          <Settings2 />
          <div>
            <strong>Integrações e diagnóstico</strong>
            <p>
              O estado do Supabase e do armazenamento aparece no aviso de conexão no topo. O
              diagnóstico de áudio está disponível adicionando <code>?diagnostic=audio</code> à URL
              da TV, e o diagnóstico do player em <code>?diagnostic=player</code>.
            </p>
          </div>
        </div>
        <MediaLibraryPage {...mediaProps} />
      </details>
    </>
  );
}
