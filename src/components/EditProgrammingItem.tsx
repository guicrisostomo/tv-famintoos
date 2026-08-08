import { useState, type FormEvent } from "react";
import { Check, LoaderCircle, X } from "lucide-react";
import type {
  ImageAnimation,
  TvCaptionAnimation,
  TvDisplayRecord,
  TvImageFit,
  TvPlaylistRecord,
} from "../hooks/useTvData";
import { supabase } from "../services/supabase";
import { SoundPicker, type SoundSettings } from "./SoundPicker";
import { ContentScheduleFields } from "./ContentScheduleFields";
import { scheduleDatabaseValues, type ContentSchedule } from "./contentSchedule";

export function EditProgrammingItem({
  companyId,
  displays,
  items,
  item,
  onClose,
  onSaved,
}: {
  companyId: string;
  displays: TvDisplayRecord[];
  items: TvPlaylistRecord[];
  item: TvPlaylistRecord;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const mediaItems = items.filter(
    (candidate) => candidate.media_id === item.media_id,
  );
  const [title, setTitle] = useState(item.media.title);
  const [message, setMessage] = useState(item.media.message_text ?? "");
  const [duration, setDuration] = useState(item.media.duration_seconds ?? 10);
  const [animation, setAnimation] = useState<ImageAnimation>(
    item.media.animation ?? "none",
  );
  const [imageFit, setImageFit] = useState<TvImageFit>(
    item.image_fit ?? "contain",
  );
  const [captionText, setCaptionText] = useState(item.caption_text ?? "");
  const [captionAnimation, setCaptionAnimation] =
    useState<TvCaptionAnimation>(item.caption_animation ?? "none");
  const [displayIds, setDisplayIds] = useState(() =>
    Array.from(new Set(mediaItems.map((candidate) => candidate.display_id))),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"content" | "schedule" | "tvs">("content");
  const [sound, setSound] = useState<SoundSettings>({ mediaId: item.sound_media_id ?? null, media: item.sound_media ?? null, volume: item.sound_volume ?? .7, loop: item.sound_loop ?? true, muteOriginalAudio: item.mute_original_audio ?? false });
  const [schedule, setSchedule] = useState<ContentSchedule>(() => ({
    mode: item.media.starts_at || item.media.ends_at || item.media.start_time || item.media.end_time || item.media.weekdays?.length ? "scheduled" : "always",
    startsAt: item.media.starts_at?.slice(0, 10) ?? "", endsAt: item.media.ends_at?.slice(0, 10) ?? "",
    startTime: item.media.start_time?.slice(0, 5) ?? "", endTime: item.media.end_time?.slice(0, 5) ?? "", weekdays: item.media.weekdays ?? [],
  }));
  const url = item.media.public_url ?? item.media.media_url;
  const allDisplaysSelected = displays.length > 0 && displays.every(display => displayIds.includes(display.id));

  const toggleDisplay = (id: string) =>
    setDisplayIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || displayIds.length === 0) {
      setError("Selecione pelo menos uma TV.");
      return;
    }
    if (!title.trim()) {
      setError("Informe o título do conteúdo.");
      return;
    }
    if (item.media.media_type === "message" && !message.trim()) {
      setError("Informe o texto que será exibido.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data: updatedMedia, error: mediaError } = await supabase
        .from("tv_media")
        .update({
          title: title.trim(),
          message_text:
            item.media.media_type === "message"
              ? message.trim()
              : item.media.message_text,
          duration_seconds: Math.max(3, Math.min(300, duration)),
          animation: item.media.media_type === "image" ? animation : "none",
          ...scheduleDatabaseValues(schedule),
        })
        .eq("id", item.media_id)
        .eq("company_id", companyId)
        .select("id")
        .maybeSingle();
      if (mediaError) throw mediaError;
      if (!updatedMedia)
        throw new Error("Conteúdo não encontrado ou edição não autorizada.");
      if (mediaItems.length) {
        const { error: fitError } = await supabase
          .from("tv_playlist_items")
          .update({
            image_fit:
              item.media.media_type === "image" ? imageFit : "contain",
            caption_text:
              item.media.media_type === "message"
                ? null
                : captionText.trim() || null,
            caption_animation:
              item.media.media_type === "message" || !captionText.trim()
                ? "none"
                : captionAnimation,
            sound_media_id: sound.mediaId,
            sound_volume: sound.volume,
            sound_loop: sound.loop,
            mute_original_audio: item.media.media_type === "video" && sound.mediaId ? sound.muteOriginalAudio : false,
          })
          .eq("company_id", companyId)
          .in(
            "id",
            mediaItems.map((candidate) => candidate.id),
          );
        if (fitError) throw fitError;
      }
      const currentDisplays = new Set(
        mediaItems.map((candidate) => candidate.display_id),
      );
      const selectedDisplays = new Set(displayIds);
      const removeIds = mediaItems
        .filter((candidate) => !selectedDisplays.has(candidate.display_id))
        .map((candidate) => candidate.id);
      if (removeIds.length) {
        const { error } = await supabase
          .from("tv_playlist_items")
          .delete()
          .eq("company_id", companyId)
          .in("id", removeIds);
        if (error) throw error;
      }
      const addedDisplays = displayIds.filter(
        (displayId) => !currentDisplays.has(displayId),
      );
      if (addedDisplays.length) {
        const maxPositions = new Map<string, number>();
        items.forEach((candidate) =>
          maxPositions.set(
            candidate.display_id,
            Math.max(
              maxPositions.get(candidate.display_id) ?? -1,
              candidate.position,
            ),
          ),
        );
        const { error } = await supabase
          .from("tv_playlist_items")
          .insert(
            addedDisplays.map((displayId) => ({
              company_id: companyId,
              display_id: displayId,
              media_id: item.media_id,
              image_fit:
                item.media.media_type === "image" ? imageFit : "contain",
              caption_text:
                item.media.media_type === "message"
                  ? null
                  : captionText.trim() || null,
              caption_animation:
                item.media.media_type === "message" || !captionText.trim()
                  ? "none"
                  : captionAnimation,
              sound_media_id: sound.mediaId,
              sound_volume: sound.volume,
              sound_loop: sound.loop,
              mute_original_audio: item.media.media_type === "video" && sound.mediaId ? sound.muteOriginalAudio : false,
              position: (maxPositions.get(displayId) ?? -1) + 1,
              is_active: true,
            })),
          );
        if (error) throw error;
      }
      await onSaved();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível editar a programação.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="composer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-content-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="edit-content-title">Editar programação</h2>
            <p>Altere o conteúdo e as TVs onde ele será exibido.</p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={save} noValidate>
          <div className="form-tabs" role="tablist" aria-label="Etapas da programação"><button type="button" role="tab" aria-selected={activeTab === "content"} className={activeTab === "content" ? "active" : ""} onClick={() => setActiveTab("content")}>1. Conteúdo</button><button type="button" role="tab" aria-selected={activeTab === "schedule"} className={activeTab === "schedule" ? "active" : ""} onClick={() => setActiveTab("schedule")}>2. Quando exibir</button><button type="button" role="tab" aria-selected={activeTab === "tvs"} className={activeTab === "tvs" ? "active" : ""} onClick={() => setActiveTab("tvs")}>3. TVs</button></div>
          <div className="form-tab-panel editor-form" hidden={activeTab !== "content"}>
            {url && item.media.media_type === "image" ? (
              <div className={`image-motion-preview image-fit-${imageFit}`}>
                {imageFit === "blur_background" ? (
                  <img
                    className="preview-blurred-background"
                    src={url}
                    alt=""
                    aria-hidden="true"
                  />
                ) : null}
                <img
                  key={animation}
                  className={`preview-main-image image-motion image-motion-${animation}`}
                  style={
                    {
                      "--motion-duration": `${duration}s`,
                    } as React.CSSProperties
                  }
                  src={url}
                  alt="Prévia do conteúdo"
                />
                {captionText.trim() ? (
                  <div className={`media-caption preview-caption caption-${captionAnimation}`}>
                    {captionText.trim()}
                  </div>
                ) : null}
                <span>Prévia da animação</span>
              </div>
            ) : null}
            <label>
              Título
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </label>
            {item.media.media_type === "message" ? (
              <label>
                Texto exibido
                <textarea
                  rows={4}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  required
                />
              </label>
            ) : null}
            <label>
              Duração em segundos
              <input
                type="number"
                min={3}
                max={300}
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
                required
              />
            </label>
            {item.media.media_type === "image" ? (
              <label>
                Ajuste para a tela da TV
                <select
                  value={imageFit}
                  onChange={(event) =>
                    setImageFit(event.target.value as TvImageFit)
                  }
                >
                  <option value="contain">
                    Mostrar arte inteira com fundo preto
                  </option>
                  <option value="blur_background">
                    Arte central com fundo desfocado
                  </option>
                  <option value="cover">
                    Preencher a tela cortando as bordas
                  </option>
                  <option value="fill">Esticar para preencher</option>
                </select>
              </label>
            ) : null}
            {item.media.media_type === "image" ? (
              <label>
                Animação
                <select
                  value={animation}
                  onChange={(event) =>
                    setAnimation(event.target.value as ImageAnimation)
                  }
                >
                  <option value="none">Sem animação</option>
                  <option value="zoom_in">Zoom suave aproximando</option>
                  <option value="zoom_out">Zoom suave afastando</option>
                  <option value="pan_left">Movimento para a esquerda</option>
                  <option value="pan_right">Movimento para a direita</option>
                </select>
              </label>
            ) : null}
            {item.media.media_type !== "message" ? (
              <div className="caption-editor">
                <label>
                  Legenda opcional
                  <input
                    value={captionText}
                    onChange={(event) => setCaptionText(event.target.value)}
                    maxLength={160}
                    placeholder="Ex.: Promoção válida até domingo"
                  />
                </label>
                <label>
                  Animação da legenda
                  <select
                    value={captionAnimation}
                    disabled={!captionText.trim()}
                    onChange={(event) =>
                      setCaptionAnimation(event.target.value as TvCaptionAnimation)
                    }
                  >
                    <option value="none">Sem animação</option>
                    <option value="fade">Aparecer suavemente</option>
                    <option value="slide_up">Subir suavemente</option>
                    <option value="pulse">Destaque pulsante</option>
                  </select>
                </label>
              </div>
            ) : null}
            <SoundPicker companyId={companyId} value={sound} isVideo={item.media.media_type === "video"} onChange={setSound} />
          </div>
          <div className="form-tab-panel editor-form" hidden={activeTab !== "schedule"}>
            <ContentScheduleFields value={schedule} onChange={setSchedule}/>
          </div>
          <div className="form-tab-panel editor-form" hidden={activeTab !== "tvs"}>
            <fieldset>
              <legend>Exibir nas TVs</legend>
              <div className="display-selection"><label className="select-all-displays"><input type="checkbox" checked={allDisplaysSelected} onChange={() => setDisplayIds(allDisplaysSelected ? [] : displays.map(display => display.id))}/><span><strong>Todas as TVs</strong><small>Selecionar ou desmarcar todas de uma vez</small></span></label><div className="check-grid">
                {displays.map((display) => (
                  <label key={display.id}>
                    <input
                      type="checkbox"
                      checked={displayIds.includes(display.id)}
                      onChange={() => toggleDisplay(display.id)}
                    />
                    <span>{display.name}</span>
                  </label>
                ))}
              </div></div>
            </fieldset>
          </div>
            {error ? (
              <div className="form-error" role="alert">
                {error}
              </div>
            ) : null}
          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button className="button primary" disabled={saving}>
              {saving ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Check size={16} />
              )}{" "}
              Salvar alterações
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
