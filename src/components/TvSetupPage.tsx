import { useState, type FormEvent } from "react";
import { ExternalLink, LoaderCircle, Monitor, Music2, Plus, Save, Volume2, VolumeX } from "lucide-react";
import type { TvDisplayRecord } from "../hooks/useTvData";
import { supabase } from "../services/supabase";
import { SoundPicker, type SoundSettings } from "./SoundPicker";

export function TvSetupPage({ companyId, displays, onSaved }: { companyId: string; displays: TvDisplayRecord[]; onSaved: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    const { error: saveError } = await supabase.from("tv_displays").insert({ company_id: companyId, name: name.trim(), description: description.trim() || null });
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
      <div className="page-header"><div><h1>Canal</h1><p>Cadastre as telas da empresa e configure o áudio de cada TV.</p></div></div>
      {error ? <div className="system-alert error" role="alert">{error}</div> : null}
      {message ? <div className="system-alert success" role="status">{message}</div> : null}
      <div className="grid-2 tv-setup-grid">
        <section className="card">
          <div className="section-title"><h2>Adicionar TV</h2></div>
          <form className="editor-form" onSubmit={submit}>
            <label>Nome da TV<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: TV do salão" required /></label>
            <label>Descrição<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Onde esta TV está instalada" /></label>
            <button className="button primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Salvar TV</button>
          </form>
        </section>
        <section className="card tv-list-card">
          <div className="section-title"><h2>TVs da empresa</h2><span className="badge">{displays.length}</span></div>
          {displays.length === 0 ? (
            <div className="empty compact"><div><Monitor size={24} /><h3>Nenhuma TV cadastrada</h3><p>Cadastre uma TV para associar textos, imagens e vídeos.</p></div></div>
          ) : (
            <div className="display-list">
              {displays.map((display) => (
                <article className="display-row tv-audio-row" key={display.id}>
                  <div className="display-summary">
                    <div><strong>{display.name}</strong><span>{display.description ?? "Sem descrição"}</span></div>
                    <div className="display-statuses">
                      <span className={`sound-state ${display.sound_enabled ? "enabled" : ""}`}>{display.sound_enabled ? "Som habilitado" : "Som desabilitado"}</span>
                      {display.continuous_audio_enabled ? <span className="sound-state enabled"><Music2 size={13} /> Trilha contínua</span> : null}
                    </div>
                  </div>
                  <div className="display-actions">
                    <button className="button secondary" onClick={() => void toggleSound(display)}>{display.sound_enabled ? <Volume2 size={15} /> : <VolumeX size={15} />} {display.sound_enabled ? "Desativar som" : "Ativar som"}</button>
                    <button className="button secondary" onClick={() => void testSound(display)} disabled={!display.sound_enabled || testingId === display.id}>{testingId === display.id ? <LoaderCircle className="spin" size={15} /> : <Volume2 size={15} />} Testar som nesta TV</button>
                    <a className="button secondary" href={`/tv/${companyId}/${display.id}`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Exibir na TV</a>
                  </div>
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
