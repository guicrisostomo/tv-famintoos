import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Image,
  MessageSquareText,
  Video,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { TvDisplayRecord, TvPlaylistRecord } from '../hooks/useTvData';
import { isItemScheduledOnDate } from './programSchedule';

export function PlannerPage({
  displays,
  items,
}: {
  displays: TvDisplayRecord[];
  items: TvPlaylistRecord[];
}) {
  const [offset, setOffset] = useState(0);
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setHours(12, 0, 0, 0);
        date.setDate(date.getDate() + offset + index);
        return date;
      }),
    [offset],
  );
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Planner</h1>
          <p>Veja o que cada TV exibirá hoje e nos próximos dias.</p>
        </div>
        <div className="planner-navigation">
          <button
            className="icon-button"
            onClick={() => setOffset((current) => current - 7)}
            aria-label="Semana anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button className="button secondary" onClick={() => setOffset(0)}>
            Hoje
          </button>
          <button
            className="icon-button"
            onClick={() => setOffset((current) => current + 7)}
            aria-label="Próxima semana"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <section className="card planner-card">
        <div
          className="planner-grid"
          style={{ '--planner-days': days.length } as React.CSSProperties}
        >
          <div className="planner-corner">
            <CalendarDays size={18} />
            <strong>Televisões</strong>
          </div>
          {days.map((day, index) => (
            <header
              key={day.toISOString()}
              className={`planner-day ${offset + index === 0 ? 'today' : ''}`}
            >
              <span>
                {offset + index === 0
                  ? 'Hoje'
                  : day.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
              </span>
              <strong>
                {day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </strong>
            </header>
          ))}
          {displays.map((display) => (
            <PlannerRow
              key={display.id}
              display={display}
              days={days}
              items={items.filter((item) => item.display_id === display.id)}
            />
          ))}
        </div>
        {!displays.length ? (
          <div className="empty compact">
            <div>
              <h3>Nenhuma TV cadastrada</h3>
              <p>Cadastre uma televisão para montar o planner.</p>
            </div>
          </div>
        ) : null}
      </section>
      <div className="planner-legend">
        <span>
          <i className="always" /> Exibido sempre
        </span>
        <span>
          <i className="scheduled" /> Programado para dias ou horários
        </span>
      </div>
    </>
  );
}

function PlannerRow({
  display,
  days,
  items,
}: {
  display: TvDisplayRecord;
  days: Date[];
  items: TvPlaylistRecord[];
}) {
  return (
    <>
      <aside className="planner-tv">
        <strong>{display.name}</strong>
        <span>{display.description ?? 'Sem descrição'}</span>
      </aside>
      {days.map((day) => {
        const dayItems = items
          .filter((item) => isItemScheduledOnDate(item, day))
          .sort((a, b) => a.position - b.position);
        return (
          <div className="planner-cell" key={`${display.id}-${day.toISOString()}`}>
            {dayItems.length ? (
              dayItems.map((item) => <PlannerItem key={item.id} item={item} />)
            ) : (
              <span className="planner-empty">Sem conteúdo</span>
            )}
          </div>
        );
      })}
    </>
  );
}

function PlannerItem({ item }: { item: TvPlaylistRecord }) {
  const media = item.media;
  const scheduled = Boolean(
    media.starts_at ||
    media.ends_at ||
    media.start_time ||
    media.end_time ||
    media.weekdays?.length,
  );
  const Icon =
    media.media_type === 'video'
      ? Video
      : media.media_type === 'message'
        ? MessageSquareText
        : Image;
  const time =
    media.start_time || media.end_time
      ? `${media.start_time?.slice(0, 5) ?? '00:00'}–${media.end_time?.slice(0, 5) ?? '23:59'}`
      : 'Dia inteiro';
  return (
    <article
      className={`planner-item ${scheduled ? 'scheduled' : 'always'}`}
      title={`${media.title} · ${time}`}
    >
      <Icon size={13} />
      <div>
        <strong>{media.title}</strong>
        <span>
          <Clock3 size={10} />
          {time}
        </span>
      </div>
    </article>
  );
}
