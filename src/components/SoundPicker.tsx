import { useCallback, useEffect, useMemo, useState } from "react";
import { Globe2, LoaderCircle, Music2, Pause, Play, Upload } from "lucide-react";
import type { TvMediaRecord } from "../hooks/useTvData";
import { requestR2Upload, uploadToR2 } from "../services/storage";
import { supabase } from "../services/supabase";

export interface SoundSettings {
  mediaId: string | null;
  media: TvMediaRecord | null;
  volume: number;
  loop: boolean;
  muteOriginalAudio: boolean;
}

export function SoundPicker({ companyId, value, isVideo, onChange }: { companyId: string; value: SoundSettings; isVideo: boolean; onChange: (value: SoundSettings) => void }) {
  const [tracks, setTracks] = useState<TvMediaRecord[]>([]);
  const [search, setSearch] = useState("");
  const [internetUrl, setInternetUrl] = useState("");
  const [internetTitle, setInternetTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!supabase) return;
    const result = await supabase.from("tv_media").select("id,company_id,title,media_type,media_url,message_text,duration_seconds,public_url,storage_provider,storage_key,file_size,r2_asset_id,created_at").eq("company_id", companyId).eq("media_type", "audio").eq("is_active", true).order("created_at", { ascending: false });
    if (result.error) setError(result.error.message); else setTracks(result.data as TvMediaRecord[]);
  }, [companyId]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const filtered = useMemo(() => tracks.filter(track => track.title.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))), [search, tracks]);
  const choose = (track: TvMediaRecord | null) => onChange({ ...value, mediaId: track?.id ?? null, media: track });
  const togglePreview = async (track: TvMediaRecord) => {
    const url = track.public_url ?? track.media_url;
    if (!url) return;
    setPlayingId(current => current === track.id ? null : track.id); setError(null);
  };
  const saveTrack = async (data: { title: string; url: string; provider: "cloudflare_r2" | "external_url"; file?: File; storageKey?: string }) => {
    if (!supabase) return;
    const result = await supabase.from("tv_media").insert({ company_id: companyId, title: data.title, media_type: "audio", media_url: data.url, public_url: data.url, duration_seconds: 10, animation: "none", is_active: true, storage_provider: data.provider, storage_key: data.storageKey ?? null, mime_type: data.file?.type ?? null, file_size: data.file?.size ?? null }).select("id,company_id,title,media_type,media_url,message_text,duration_seconds,public_url,storage_provider,storage_key,file_size,created_at").single();
    if (result.error) throw result.error;
    const track = result.data as TvMediaRecord; setTracks(current => [track, ...current]); choose(track);
  };
  const upload = async (file: File | null) => {
    if (!file) return; setBusy(true); setError(null);
    try { const ticket = await requestR2Upload(file, "audio"); if (!ticket.publicUrl) throw new Error("O R2 não retornou uma URL pública."); await uploadToR2(ticket, file); await saveTrack({ title: file.name.replace(/\.[^.]+$/, ""), url: ticket.publicUrl, provider: "cloudflare_r2", file, storageKey: ticket.storageKey }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Falha no upload do áudio."); } finally { setBusy(false); }
  };
  const addInternet = async () => {
    let url: URL; try { url = new URL(internetUrl); if (url.protocol !== "https:") throw new Error(); } catch { setError("Informe uma URL HTTPS válida e direta para um arquivo de áudio."); return; }
    setBusy(true); setError(null); try { await saveTrack({ title: internetTitle.trim() || url.pathname.split("/").pop() || "Som da internet", url: url.toString(), provider: "external_url" }); setInternetUrl(""); setInternetTitle(""); } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível salvar o link."); } finally { setBusy(false); }
  };
  return <fieldset className="sound-picker"><legend><Music2 size={16}/> Som da mídia (opcional)</legend>
    <p className="form-hint">Escolha na biblioteca da empresa, envie um arquivo ou cadastre um link licenciado da internet.</p>
    <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar sons da biblioteca" />
    <div className="sound-track-list">
      <button type="button" className={!value.mediaId ? "sound-track selected" : "sound-track"} onClick={() => choose(null)}>Sem som</button>
      {filtered.map(track => <div className={value.mediaId === track.id ? "sound-track selected" : "sound-track"} key={track.id}><button type="button" className="sound-track-name" onClick={() => choose(track)}>{track.title}</button><button type="button" className="icon-button" onClick={() => void togglePreview(track)} aria-label={`Ouvir ${track.title}`}>{playingId === track.id ? <Pause size={15}/> : <Play size={15}/>}</button></div>)}
    </div>
    {playingId ? <audio key={playingId} src={tracks.find(track => track.id === playingId)?.public_url ?? tracks.find(track => track.id === playingId)?.media_url ?? undefined} autoPlay controls onEnded={() => setPlayingId(null)} onError={() => setError("Não foi possível reproduzir a prévia deste som.")} style={{ width: "100%" }} /> : null}
    <div className="sound-add-row"><label className="button secondary file-button">{busy ? <LoaderCircle className="spin" size={16}/> : <Upload size={16}/>} Enviar MP3/M4A/WAV<input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/ogg" disabled={busy} onChange={event => void upload(event.target.files?.[0] ?? null)}/></label></div>
    <div className="sound-url-row"><input value={internetTitle} onChange={event => setInternetTitle(event.target.value)} placeholder="Nome do som"/><input type="url" value={internetUrl} onChange={event => setInternetUrl(event.target.value)} placeholder="https://site.com/audio.mp3"/><button type="button" className="button secondary" disabled={busy || !internetUrl} onClick={() => void addInternet()}><Globe2 size={16}/> Adicionar link</button></div>
    {value.mediaId ? <div className="sound-options"><label>Volume do som <input type="range" min="0" max="1" step="0.05" value={value.volume} onChange={event => onChange({ ...value, volume: Number(event.target.value) })}/><span>{Math.round(value.volume * 100)}%</span></label><label><input type="checkbox" checked={value.loop} onChange={event => onChange({ ...value, loop: event.target.checked })}/> Repetir até o fim da mídia</label>{isVideo ? <label><input type="checkbox" checked={value.muteOriginalAudio} onChange={event => onChange({ ...value, muteOriginalAudio: event.target.checked })}/> Substituir o áudio original do vídeo</label> : null}</div> : null}
    {error ? <div className="form-error" role="alert">{error}</div> : null}
  </fieldset>;
}
