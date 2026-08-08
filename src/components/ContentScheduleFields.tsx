import type { ContentSchedule } from "./contentSchedule";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function ContentScheduleFields({ value, onChange }: { value: ContentSchedule; onChange: (value: ContentSchedule) => void }) {
  const set = (changes: Partial<ContentSchedule>) => onChange({ ...value, ...changes });
  return <fieldset className="schedule-fields">
    <legend>Quando exibir</legend>
    <label><input type="radio" name="schedule-mode" checked={value.mode === "always"} onChange={() => set({ mode: "always" })}/> Exibir sempre (padrão)</label>
    <label><input type="radio" name="schedule-mode" checked={value.mode === "scheduled"} onChange={() => set({ mode: "scheduled" })}/> Exibir somente em dias e horários específicos</label>
    {value.mode === "scheduled" ? <div className="editor-form">
      <div className="form-row"><label>Data inicial (opcional)<input type="date" value={value.startsAt} onChange={event => set({ startsAt: event.target.value })}/></label><label>Data final (opcional)<input type="date" value={value.endsAt} min={value.startsAt || undefined} onChange={event => set({ endsAt: event.target.value })}/></label></div>
      <div><span className="field-label">Dias da semana</span><div className="weekday-picker">{DAYS.map((day, index) => <button type="button" key={day} className={value.weekdays.includes(index) ? "active" : ""} aria-pressed={value.weekdays.includes(index)} onClick={() => set({ weekdays: value.weekdays.includes(index) ? value.weekdays.filter(current => current !== index) : [...value.weekdays, index].sort() })}>{day}</button>)}</div><small>Nenhum dia selecionado significa todos os dias.</small></div>
      <div className="form-row"><label>Horário inicial (opcional)<input type="time" value={value.startTime} onChange={event => set({ startTime: event.target.value })}/></label><label>Horário final (opcional)<input type="time" value={value.endTime} onChange={event => set({ endTime: event.target.value })}/></label></div>
    </div> : null}
  </fieldset>;
}
