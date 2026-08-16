import { useState, type FormEvent } from "react";
import { Clock, ExternalLink, LoaderCircle, Maximize2, Monitor, Music2, Plus, Save, Settings2, Volume2, VolumeX } from "lucide-react";
import { DateTimeOverlay } from "./DateTimeOverlay";
import { normalizeDisplayPresentation, type DisplayPresentationSettings, type TvDisplayMode } from "../domain/display";
import type { TvDisplayRecord } from "../hooks/useTvData";
import { supabase } from "../services/supabase";
import { SoundPicker, type SoundSettings } from "./SoundPicker";

const DISPLAY_PRESETS = [
  { label: "Full HD horizontal", width: 1920, height: 1080 },
  { label: "HD horizontal", width: 1280, height: 720 },
  { label: "Vertical", width: 1080, height: 1920 },
  { label: "LED ultrawide", width: 3840, height: 1080 },
  { label: "Faixa LED", width: 1920, height: 480 },
] as const;

const TIME_ZONES = [
  ["America/Sao_Paulo", "Brasília, São Paulo e Sul"],
  ["America/Manaus", "Manaus"],
  ["America/Cuiaba", "Cuiabá"],
  ["America/Rio_Branco", "Rio Branco"],
  ["America/Noronha", "Fernando de Noronha"],
] as const;

export function TvSetupPage({ companyId, displays, onSaved }: { companyId: string; displays: TvDisplayRecord[]; onSaved: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [newDisplayMode, setNewDisplayMode] = useState<TvDisplayMode>("tv");
  const [newWidth, setNewWidth] = useState(1920);
  const [newHeight, setNewHeight] = useState(1080);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    if (newWidth < 64 || newHeight < 64) { setError("Informe uma resolução válida para a tela."); return; }
    setSaving(true);
    setError(null);
    const { error: saveError } = await supabase.from("tv_displays").insert({
      company_id: companyId,
      name: name.trim(),
      description: description.trim() || null,
      display_mode: newDisplayMode,
      display_width: newWidth,
      display_height: newHeight,
    });
    if (saveError) setError(saveError.message);
    else { setName(""); setDescription(""); await onSaved(); }
    setSaving(false);
  };

  const toggleSound = async (display: TvDisplayRecord) => {
    if (!supabase) return;
    setError(null);
    const { error: updateError } = await supabase.from("tv_displays").update({ sound_enabled: !display.sound_enabled }).eq("id", display.id).eq("company_id", companyId);
    if (updateError) setError(updateError.message);
    else await onSaved();
  };

  const testSound = async (display: TvDisplayRecord) => {
    if (!supabase || !display.sound_enabled) return;
    setTestingId(display.id); setError(null); setMessage(null);
    const { error: callError } = await supabase.from("tv_calls").insert({ company_id: companyId, display_id: display.id, customer_name: "Teste de som", call_text: "Teste de som", status: "pending" });
    if (callError) setError(callError.message);
    else setMessage(`Teste enviado para ${display.name}.`);
    setTestingId(null);
  };

  return (
    <>
      <div className="page-header"><div><h1>Canal</h1><p>Configure TVs, painéis de LED, data, hora e áudio de cada tela.</p></div></div>
      {error ? <div className="system-alert error" role="alert">{error}</div> : null}
      {message ? <div className="system-alert success" role="status">{message}</div> : null}
      <div className="grid-2 tv-setup-grid">
        <section className="card">
          <div className="section-title"><h2>Adicionar tela</h2></div>
          <form className="editor-form" onSubmit={submit}>
            <label>Nome da tela<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Painel da fachada" required /></label>
            <label>Descrição<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Onde esta tela está instalada" /></label>
            <label>Tipo de exibição<select value={newDisplayMode} onChange={(event) => setNewDisplayMode(event.target.value as TvDisplayMode)}><option value="tv">TV ou monitor</option><option value="led">Painel de LED</option></select></label>
            <ResolutionFields width={newWidth} height={newHeight} onChange={(width, height) => { setNewWidth(width); setNewHeight(height); }} />
            <p className="form-hint">No painel de LED, use exatamente a matriz de pixels configurada no controlador. O conteúdo será enquadrado nessa proporção.</p>
            <button className="button primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Salvar tela</button>
          </form>
        </section>
        <section className="card tv-list-card">
          <div className="section-title"><h2>Telas da empresa</h2><span className="badge">{displays.length}</span></div>
          {displays.length === 0 ? (
            <div className="empty compact"><div><Monitor size={24} /><h3>Nenhuma tela cadastrada</h3><p>Cadastre uma TV ou painel de LED para associar conteúdos.</p></div></div>
          ) : (
            <div className="display-list">
              {displays.map((display) => (
                <article className="display-row tv-audio-row" key={display.id}>
                  <div className="display-summary">
                    <div><strong>{display.name}</strong><span>{display.description ?? "Sem descrição"}</span></div>
                    <div className="display-statuses">
                      <span className={`sound-state ${display.display_mode === "led" ? "enabled" : ""}`}><Maximize2 size={13} /> {display.display_mode === "led" ? `LED ${display.display_width}×${display.display_height}` : "TV 16:9"}</span>
                      {display.datetime_enabled ? <span className="sound-state enabled"><Clock size={13} /> Data e hora</span> : null}
                      <span className={`sound-state ${display.sound_enabled ? "enabled" : ""}`}>{display.sound_enabled ? "Som habilitado" : "Som desabilitado"}</span>
                      {display.continuous_audio_enabled ? <span className="sound-state enabled"><Music2 size={13} /> Trilha contínua</span> : null}
                    </div>
                  </div>
                  <div className="display-actions">
                    <button className="button secondary" onClick={() => void toggleSound(display)}>{display.sound_enabled ? <Volume2 size={15} /> : <VolumeX size={15} />} {display.sound_enabled ? "Desativar som" : "Ativar som"}</button>
                    <button className="button secondary" onClick={() => void testSound(display)} disabled={!display.sound_enabled || testingId === display.id}>{testingId === display.id ? <LoaderCircle className="spin" size={15} /> : <Volume2 size={15} />} Testar som</button>
                    <a className="button secondary" href={`/tv/${companyId}/${display.id}`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Exibir</a>
                  </div>
                  <DisplaySettingsEditor key={displaySettingsKey(display)} companyId={companyId} display={display} onSaved={onSaved} onError={setError} />
                  <ContinuousAudioEditor key={`${display.id}:${display.continuous_audio_media_id ?? "none"}:${display.continuous_audio_enabled}:${display.continuous_audio_volume}`} companyId={companyId} display={display} onSaved={onSaved} onError={setError} />
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function ResolutionFields({ width, height, onChange }: { width: number; height: number; onChange: (width: number, height: number) => void }) {
  return (
    <fieldset className="resolution-fields">
      <legend>Resolução da saída</legend>
      <div className="resolution-presets">
        {DISPLAY_PRESETS.map((preset) => <button type="button" className={width === preset.width && height === preset.height ? "selected" : ""} key={preset.label} onClick={() => onChange(preset.width, preset.height)}>{preset.label}<small>{preset.width} × {preset.height}</small></button>)}
      </div>
      <div className="resolution-custom"><label>Largura (px)<input type="number" min="64" max="16384" value={width} onChange={(event) => onChange(Number(event.target.value), height)} /></label><span>×</span><label>Altura (px)<input type="number" min="64" max="16384" value={height} onChange={(event) => onChange(width, Number(event.target.value))} /></label></div>
    </fieldset>
  );
}

function DisplaySettingsEditor({ companyId, display, onSaved, onError }: { companyId: string; display: TvDisplayRecord; onSaved: () => Promise<void>; onError: (message: string | null) => void }) {
  const [expanded, setExpanded] = useState(display.display_mode === "led" || display.datetime_enabled);
  const [settings, setSettings] = useState<DisplayPresentationSettings>(() => normalizeDisplayPresentation({
    mode: display.display_mode,
    width: display.display_width,
    height: display.display_height,
    dateTimeEnabled: display.datetime_enabled,
    showDate: display.datetime_show_date,
    showTime: display.datetime_show_time,
    showSeconds: display.datetime_show_seconds,
    dateTimePosition: display.datetime_position,
    dateTimeTheme: display.datetime_theme,
    timeZone: display.datetime_time_zone,
  }));
  const [saving, setSaving] = useState(false);
  const update = (values: Partial<DisplayPresentationSettings>) => setSettings((current) => ({ ...current, ...values }));

  const save = async () => {
    if (!supabase) return;
    if (settings.dateTimeEnabled && !settings.showDate && !settings.showTime) { onError("Escolha exibir a data, a hora ou ambas."); return; }
    const normalized = normalizeDisplayPresentation(settings);
    setSaving(true); onError(null);
    const { error } = await supabase.from("tv_displays").update({
      display_mode: normalized.mode,
      display_width: normalized.width,
      display_height: normalized.height,
      datetime_enabled: normalized.dateTimeEnabled,
      datetime_show_date: normalized.showDate,
      datetime_show_time: normalized.showTime,
      datetime_show_seconds: normalized.showSeconds,
      datetime_position: normalized.dateTimePosition,
      datetime_theme: normalized.dateTimeTheme,
      datetime_time_zone: normalized.timeZone,
    }).eq("id", display.id).eq("company_id", companyId);
    if (error) onError(error.message);
    else await onSaved();
    setSaving(false);
  };

  return (
    <details className="display-settings-editor" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary><Settings2 size={17} /><span><strong>Tela, painel LED, data e hora</strong><small>Proporção, resolução e informações sobrepostas</small></span></summary>
      {expanded ? (
        <div className="display-settings-body">
          <div className="display-mode-options" role="group" aria-label="Tipo de exibição">
            <button type="button" className={settings.mode === "tv" ? "selected" : ""} aria-pressed={settings.mode === "tv"} onClick={() => update({ mode: "tv", width: 1920, height: 1080 })}><Monitor size={20} /><span><strong>TV ou monitor</strong><small>Formato tradicional 16:9</small></span></button>
            <button type="button" className={settings.mode === "led" ? "selected" : ""} aria-pressed={settings.mode === "led"} onClick={() => update({ mode: "led" })}><Maximize2 size={20} /><span><strong>Painel de LED</strong><small>Matriz horizontal, vertical ou personalizada</small></span></button>
          </div>
          <ResolutionFields width={settings.width} height={settings.height} onChange={(width, height) => update({ width, height })} />
          <fieldset className="datetime-settings">
            <legend><Clock size={16} /> Data e hora</legend>
            <label className="continuous-audio-toggle"><input type="checkbox" checked={settings.dateTimeEnabled} onChange={(event) => update({ dateTimeEnabled: event.target.checked })} /><span><strong>Exibir data e hora nesta tela</strong><small>O relógio é atualizado automaticamente sem recarregar a programação.</small></span></label>
            {settings.dateTimeEnabled ? (
              <div className="datetime-controls">
                <div className="datetime-checks"><label><input type="checkbox" checked={settings.showDate} onChange={(event) => update({ showDate: event.target.checked })} /> Exibir data</label><label><input type="checkbox" checked={settings.showTime} onChange={(event) => update({ showTime: event.target.checked })} /> Exibir hora</label><label><input type="checkbox" checked={settings.showSeconds} disabled={!settings.showTime} onChange={(event) => update({ showSeconds: event.target.checked })} /> Exibir segundos</label></div>
                <div className="datetime-selects">
                  <label>Posição<select value={settings.dateTimePosition} onChange={(event) => update({ dateTimePosition: event.target.value as DisplayPresentationSettings["dateTimePosition"] })}><option value="top_left">Superior esquerda</option><option value="top_center">Superior central</option><option value="top_right">Superior direita</option><option value="bottom_left">Inferior esquerda</option><option value="bottom_center">Inferior central</option><option value="bottom_right">Inferior direita</option></select></label>
                  <label>Estilo<select value={settings.dateTimeTheme} onChange={(event) => update({ dateTimeTheme: event.target.value as DisplayPresentationSettings["dateTimeTheme"] })}><option value="dark">Escuro translúcido</option><option value="light">Claro translúcido</option><option value="brand">Verde Famintoos</option><option value="minimal">Minimalista</option></select></label>
                  <label>Fuso horário<select value={settings.timeZone} onChange={(event) => update({ timeZone: event.target.value })}>{TIME_ZONES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                </div>
              </div>
            ) : null}
          </fieldset>
          <div className="display-settings-preview" style={{ aspectRatio: `${settings.width} / ${settings.height}` }}><span className="preview-led-label">{settings.mode === "led" ? "Prévia do painel LED" : "Prévia da TV"}<small>{settings.width} × {settings.height}</small></span><DateTimeOverlay settings={settings} /></div>
          <button type="button" className="button primary" onClick={() => void save()} disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} Salvar tela e relógio</button>
        </div>
      ) : null}
    </details>
  );
}

function ContinuousAudioEditor({ companyId, display, onSaved, onError }: { companyId: string; display: TvDisplayRecord; onSaved: () => Promise<void>; onError: (message: string | null) => void }) {
  const [enabled, setEnabled] = useState(display.continuous_audio_enabled);
  const [sound, setSound] = useState<SoundSettings>({ mediaId: display.continuous_audio_media_id, media: display.continuous_audio_media ?? null, volume: Number(display.continuous_audio_volume ?? 0.7), loop: true, muteOriginalAudio: false, videoAudioMode: "original" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!supabase) return;
    if (enabled && !sound.mediaId) { onError("Escolha ou envie uma faixa antes de ativar a trilha contínua."); return; }
    setSaving(true); onError(null);
    const { error } = await supabase.from("tv_displays").update({ continuous_audio_enabled: enabled, continuous_audio_media_id: sound.mediaId, continuous_audio_volume: sound.volume, ...(enabled ? { sound_enabled: true } : {}) }).eq("id", display.id).eq("company_id", companyId);
    if (error) onError(error.message);
    else await onSaved();
    setSaving(false);
  };

  return (
    <details className="continuous-audio-editor" open={display.continuous_audio_enabled}>
      <summary><Music2 size={17} /><span><strong>Áudio contínuo</strong><small>Uma trilha durante toda a programação</small></span></summary>
      <div className="continuous-audio-body">
        <label className="continuous-audio-toggle"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /><span><strong>Usar trilha contínua nesta TV</strong><small>Ao ativar, o som original dos vídeos e os sons individuais dos conteúdos ficam silenciados.</small></span></label>
        <SoundPicker companyId={companyId} value={sound} isVideo={false} onChange={setSound} legend="Faixa contínua" hint="Escolha uma faixa da biblioteca, envie um arquivo ou use um link HTTPS direto." showLoop={false} />
        <button type="button" className="button primary" onClick={() => void save()} disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} Salvar áudio desta TV</button>
      </div>
    </details>
  );
}

function displaySettingsKey(display: TvDisplayRecord) {
  return [display.id, display.display_mode, display.display_width, display.display_height, display.datetime_enabled, display.datetime_show_date, display.datetime_show_time, display.datetime_show_seconds, display.datetime_position, display.datetime_theme, display.datetime_time_zone].join(":");
}
