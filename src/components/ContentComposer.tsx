import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Check,
  Cloud,
  FileImage,
  LoaderCircle,
  MessageSquareText,
  RefreshCw,
  Upload,
  Video,
  X,
} from "lucide-react";
import type {
  ImageAnimation,
  TvDisplayRecord,
  TvImageFit,
  TvPlaylistRecord,
} from "../hooks/useTvData";
import { captionDatabaseValues, defaultCaptionSettings } from "../domain/caption";
import {
  importR2Object,
  listUnregisteredR2Objects,
  requestR2Upload,
  uploadToR2,
  type R2ExistingObject,
} from "../services/storage";
import { supabase } from "../services/supabase";
import { resolveWatermarkLogo } from "../services/watermarkLogo";
import { SoundPicker, type SoundSettings } from "./SoundPicker";
import { PresentationSettingsFields, type PresentationSettings } from "./PresentationSettingsFields";
import { buildWatermarkTemplates } from "./watermarkTemplates";
import { ContentScheduleFields } from "./ContentScheduleFields";
import { alwaysSchedule, scheduleDatabaseValues, type ContentSchedule } from "./contentSchedule";
import { CaptionOverlay } from "./CaptionOverlay";
import { CaptionSettingsFields } from "./CaptionSettingsFields";

type ContentType = "message" | "image" | "video";
interface FileInfo {
  width: number;
  height: number;
  duration?: number;
  videoCodec?: string;
  videoLevel?: number;
  hasAudio?: boolean;
}
type AvailableMedia = R2ExistingObject & {
  mediaId?: string;
  source: "library" | "r2";
  animation?: ImageAnimation;
};
const MEDIA_PAGE_SIZE = 12;

async function sha256(file: File) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function inspectFile(
  file: File,
  type: ContentType,
): Promise<FileInfo | null> {
  if (type === "image") {
    const bitmap = await createImageBitmap(file);
    const info = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return info;
  }
  if (type === "video") {
    const url = URL.createObjectURL(file);
    try {
      const metadata = await inspectMp4(file);
      if (metadata.videoCodec === "H.265/HEVC")
        throw new Error("Vídeo incompatível com a TV. Converta para MP4 com vídeo H.264 e áudio AAC.");
      if ((metadata.videoLevel ?? 0) > 4.1)
        throw new Error(`Vídeo H.264 nível ${metadata.videoLevel?.toFixed(1)} incompatível com o Fully Kiosk. Converta para H.264 nível 4.1 ou inferior, com áudio AAC.`);
      return await new Promise((resolve, reject) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () =>
          resolve({
            width: video.videoWidth,
            height: video.videoHeight,
            duration: video.duration,
            ...metadata,
          });
        video.onerror = () =>
          reject(new Error("Vídeo inválido ou incompatível."));
        video.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return null;
}

async function inspectMp4(file: File) {
  const sampleSize = Math.min(file.size, 4 * 1024 * 1024);
  const first = new Uint8Array(await file.slice(0, sampleSize).arrayBuffer());
  const last = file.size > sampleSize
    ? new Uint8Array(await file.slice(Math.max(sampleSize, file.size - sampleSize)).arrayBuffer())
    : new Uint8Array();
  const find = (bytes: Uint8Array, value: string) => {
    const target = new TextEncoder().encode(value);
    outer: for (let index = 0; index <= bytes.length - target.length; index += 1) {
      for (let offset = 0; offset < target.length; offset += 1)
        if (bytes[index + offset] !== target[offset]) continue outer;
      return index;
    }
    return -1;
  };
  const locate = (value: string) => {
    const firstIndex = find(first, value);
    return firstIndex >= 0 ? { bytes: first, index: firstIndex } : { bytes: last, index: find(last, value) };
  };
  const avc = locate("avcC");
  const hevc = locate("hvc1");
  const hev1 = locate("hev1");
  const hasAudio = locate("mp4a").index >= 0;
  return {
    videoCodec: avc.index >= 0 ? "H.264" : hevc.index >= 0 || hev1.index >= 0 ? "H.265/HEVC" : "desconhecido",
    videoLevel: avc.index >= 0 && avc.index + 7 < avc.bytes.length ? avc.bytes[avc.index + 7] / 10 : undefined,
    hasAudio,
  };
}

export function ContentComposer({
  companyId,
  displays,
  items,
  onClose,
  onSaved,
}: {
  companyId: string;
  displays: TvDisplayRecord[];
  items: TvPlaylistRecord[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [type, setType] = useState<ContentType>("message");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [duration, setDuration] = useState(10);
  const [file, setFile] = useState<File | null>(null);
  const [selectedDisplays, setSelectedDisplays] = useState<string[]>(() =>
    displays.map((display) => display.id),
  );
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [mediaSource, setMediaSource] = useState<"upload" | "r2">("upload");
  const [r2Objects, setR2Objects] = useState<AvailableMedia[]>([]);
  const [selectedR2Key, setSelectedR2Key] = useState("");
  const [loadingR2, setLoadingR2] = useState(false);
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaPage, setMediaPage] = useState(0);
  const [animation, setAnimation] = useState<ImageAnimation>("none");
  const [imageFit, setImageFit] = useState<TvImageFit>("contain");
  const [caption, setCaption] = useState(() => ({ ...defaultCaptionSettings }));
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const previewObjectUrl = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"content" | "appearance" | "schedule" | "tvs">("content");
  const [sound, setSound] = useState<SoundSettings>({ mediaId: null, media: null, volume: .7, loop: true, muteOriginalAudio: false, videoAudioMode: "original" });
  const [presentation, setPresentation] = useState<PresentationSettings>({
    transitionType: "fade",
    transitionDurationMs: 700,
    watermarkEnabled: false,
    watermarkStyle: "full",
    watermarkName: "",
    watermarkLogoMediaId: null,
    watermarkLogoUrl: "",
    watermarkPhone: "",
    watermarkExtraText: "",
    watermarkQrEnabled: false,
    watermarkQrValue: "",
  });
  const watermarkTemplates = useMemo(() => buildWatermarkTemplates(items), [items]);
  const [schedule, setSchedule] = useState<ContentSchedule>(alwaysSchedule);
  const selectedNames = useMemo(
    () =>
      displays
        .filter((display) => selectedDisplays.includes(display.id))
        .map((display) => display.name),
    [displays, selectedDisplays],
  );
  const allDisplaysSelected = displays.length > 0 && displays.every(display => selectedDisplays.includes(display.id));
  const previewUrl =
    mediaSource === "upload"
      ? localPreviewUrl
      : (r2Objects.find((item) => item.key === selectedR2Key)?.publicUrl ??
        null);
  const filteredObjects = useMemo(() => {
    const term = mediaSearch.trim().toLocaleLowerCase("pt-BR");
    return r2Objects.filter(
      (item) =>
        item.type === type &&
        (!term || item.filename.toLocaleLowerCase("pt-BR").includes(term)),
    );
  }, [mediaSearch, r2Objects, type]);
  const mediaPageCount = Math.max(
    1,
    Math.ceil(filteredObjects.length / MEDIA_PAGE_SIZE),
  );
  const visibleObjects = filteredObjects.slice(
    mediaPage * MEDIA_PAGE_SIZE,
    (mediaPage + 1) * MEDIA_PAGE_SIZE,
  );
  useEffect(
    () => () => {
      if (previewObjectUrl.current)
        URL.revokeObjectURL(previewObjectUrl.current);
    },
    [],
  );
  const toggleDisplay = (id: string) =>
    setSelectedDisplays((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  const changeType = (nextType: ContentType) => {
    if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current);
    previewObjectUrl.current = null;
    setLocalPreviewUrl(null);
    setType(nextType);
    setFile(null);
    setFileInfo(null);
    setMediaSource("upload");
    setR2Objects([]);
    setSelectedR2Key("");
    setMediaSearch("");
    setMediaPage(0);
    setAnimation("none");
    setImageFit("contain");
    setCaption({ ...defaultCaptionSettings });
    setSound({ mediaId: null, media: null, volume: .7, loop: true, muteOriginalAudio: false, videoAudioMode: "original" });
    setError(null);
  };
  const selectFile = async (nextFile: File | null) => {
    if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current);
    previewObjectUrl.current = nextFile ? URL.createObjectURL(nextFile) : null;
    setLocalPreviewUrl(previewObjectUrl.current);
    setFile(nextFile);
    setFileInfo(null);
    if (!nextFile) return;
    try {
      const info = await inspectFile(nextFile, type);
      setFileInfo(info);
      if (type === "video" && info?.duration)
        setDuration(Math.max(3, Math.min(300, Math.round(info.duration))));
    } catch (inspectionError) {
      setFile(null);
      setError(
        inspectionError instanceof Error
          ? inspectionError.message
          : "Arquivo inválido.",
      );
    }
  };
  const loadR2 = async () => {
    setLoadingR2(true);
    setError(null);
    try {
      const [objects, registered] = await Promise.all([
        listUnregisteredR2Objects(),
        supabase!
          .from("tv_media")
          .select(
            "id,title,media_type,public_url,media_url,storage_key,file_size,created_at,animation",
          )
          .eq("company_id", companyId)
          .eq("media_type", type)
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
      ]);
      if (registered.error) throw registered.error;
      const library: AvailableMedia[] = (registered.data ?? []).flatMap(
        (item) => {
          const publicUrl = item.public_url ?? item.media_url;
          if (
            !publicUrl ||
            (item.media_type !== "image" && item.media_type !== "video")
          )
            return [];
          return [
            {
              key: `library:${item.id}`,
              filename: item.title,
              publicUrl,
              size: item.file_size ?? 0,
              lastModified: item.created_at ?? null,
              type: item.media_type,
              mediaId: item.id,
              source: "library",
              animation: item.animation as ImageAnimation | undefined,
            },
          ];
        },
      );
      const raw: AvailableMedia[] = objects.map((item) => ({
        ...item,
        source: "r2",
      }));
      setR2Objects([...library, ...raw]);
      setSelectedR2Key("");
      setMediaSearch("");
      setMediaPage(0);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível consultar o R2.",
      );
    } finally {
      setLoadingR2(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    if (selectedDisplays.length === 0) {
      setError("Selecione pelo menos uma TV.");
      return;
    }
    if (type !== "message" && mediaSource === "upload" && !file) {
      setError(`Selecione ${type === "video" ? "um vídeo" : "uma imagem"}.`);
      return;
    }
    if (type !== "message" && mediaSource === "r2" && !selectedR2Key) {
      setError("Escolha uma mídia existente no R2.");
      return;
    }
    if (type === "message" && !message.trim()) {
      setError("Digite o texto que será exibido.");
      return;
    }
    if (type === "video" && sound.videoAudioMode === "replace" && !sound.mediaId) {
      setError("Escolha ou envie o áudio que substituirá o som original do vídeo.");
      return;
    }
    if (presentation.watermarkEnabled && presentation.watermarkLogoUrl.trim() && !presentation.watermarkLogoUrl.trim().startsWith("https://")) {
      setError("A URL do logo precisa começar com https://.");
      return;
    }
    if (presentation.watermarkEnabled && (presentation.watermarkStyle === "qr_only" || presentation.watermarkQrEnabled) && !presentation.watermarkQrValue.trim()) {
      setError("Informe o conteúdo que será transformado em QR Code.");
      return;
    }
    if (
      presentation.watermarkEnabled &&
      !presentation.watermarkLogoMediaId &&
      !presentation.watermarkLogoUrl.trim() &&
      !presentation.watermarkName.trim() &&
      !presentation.watermarkPhone.trim() &&
      !presentation.watermarkExtraText.trim() &&
      !(presentation.watermarkQrEnabled && presentation.watermarkQrValue.trim())
    ) {
      setError("Informe ao menos um dado para a marca d'água.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let resolvedWatermarkLogoMediaId = presentation.watermarkLogoMediaId;
      let resolvedWatermarkLogoUrl = presentation.watermarkLogoUrl.trim();
      if (presentation.watermarkEnabled && !resolvedWatermarkLogoMediaId && resolvedWatermarkLogoUrl) {
        const importedLogo = await resolveWatermarkLogo(companyId, null, resolvedWatermarkLogoUrl);
        if (!importedLogo) throw new Error("Não foi possível localizar o logo selecionado.");
        resolvedWatermarkLogoMediaId = importedLogo.id;
        resolvedWatermarkLogoUrl = importedLogo.public_url ?? importedLogo.media_url ?? resolvedWatermarkLogoUrl;
      }
      let mediaUrl: string | null = null;
      let storageKey: string | null = null;
      let r2AssetId: number | null = null;
      let mediaId: string | null = null;
      if (type !== "message" && mediaSource === "r2") {
        const selected = r2Objects.find((item) => item.key === selectedR2Key);
        if (!selected)
          throw new Error("A mídia selecionada não está mais disponível.");
        if (selected.mediaId) {
          mediaId = selected.mediaId;
          const { error: updateError } = await supabase
            .from("tv_media")
            .update({ animation: type === "image" ? animation : "none", ...scheduleDatabaseValues(schedule) })
            .eq("id", mediaId)
            .eq("company_id", companyId);
          if (updateError) throw updateError;
        } else
          mediaId = await importR2Object(
            selected.key,
            title,
            duration,
            type === "image" ? animation : "none",
          );
      }
      if (type !== "message" && mediaSource === "upload" && file) {
        const ticket = await requestR2Upload(file, type);
        if (!ticket.publicUrl)
          throw new Error(
            "O Cloudflare R2 não retornou uma URL pública. Confira R2_PUBLIC_BASE_URL na Vercel.",
          );
        await uploadToR2(ticket, file);
        mediaUrl = ticket.publicUrl;
        storageKey = ticket.storageKey;
        const extension = file.name.includes(".")
          ? (file.name.split(".").pop()?.toLowerCase() ?? null)
          : null;
        const { data: asset, error: assetError } = await supabase
          .from("r2_media_assets")
          .insert({
            business_cnpj: companyId,
            original_name: file.name,
            file_ext: extension,
            mime_type: file.type,
            file_size: file.size,
            sha256: await sha256(file),
            r2_key: ticket.storageKey,
            public_url: ticket.publicUrl,
            bucket_folder: "tv",
            media_kind: type,
            width: fileInfo?.width,
            height: fileInfo?.height,
            metadata: {
              source: "famintoos_tv",
              duration_seconds: fileInfo?.duration,
              recommended_resolution: "1920x1080",
            },
          })
          .select("id")
          .single();
        if (assetError) throw assetError;
        r2AssetId = asset.id;
      }
      if (!mediaId) {
        const fallbackTitle =
          type === "message"
            ? "Mensagem"
            : (file?.name ?? (type === "video" ? "Vídeo" : "Imagem"));
        const { data: media, error: mediaError } = await supabase
          .from("tv_media")
          .insert({
            company_id: companyId,
            title: title.trim() || fallbackTitle,
            media_type: type,
            media_url: mediaUrl,
            message_text: type === "message" ? message.trim() : null,
            duration_seconds: duration,
            animation: type === "image" ? animation : "none",
            is_active: true,
            storage_provider: type === "message" ? null : "cloudflare_r2",
            storage_key: storageKey,
            public_url: mediaUrl,
            mime_type: file?.type ?? null,
            file_size: file?.size ?? null,
            r2_asset_id: r2AssetId,
            ...scheduleDatabaseValues(schedule),
          })
          .select("id")
          .single();
        if (mediaError) throw mediaError;
        mediaId = media.id;
      }
      const { error: scheduleError } = await supabase
        .from("tv_media")
        .update(scheduleDatabaseValues(schedule))
        .eq("id", mediaId)
        .eq("company_id", companyId);
      if (scheduleError) throw scheduleError;
      const maxPosition = new Map<string, number>();
      for (const item of items)
        maxPosition.set(
          item.display_id,
          Math.max(maxPosition.get(item.display_id) ?? -1, item.position),
        );
      const rows = selectedDisplays.map((displayId) => ({
        company_id: companyId,
        display_id: displayId,
        media_id: mediaId,
        position: (maxPosition.get(displayId) ?? -1) + 1,
        is_active: true,
        image_fit: type === "image" ? imageFit : "contain",
        ...captionDatabaseValues(caption, type !== "message"),
        sound_media_id: type === "video" ? (sound.videoAudioMode === "replace" ? sound.mediaId : null) : sound.mediaId,
        sound_volume: sound.volume,
        sound_loop: sound.loop,
        mute_original_audio: type === "video" ? sound.videoAudioMode !== "original" : false,
        transition_type: presentation.transitionType,
        transition_duration_ms: presentation.transitionDurationMs,
        watermark_enabled: presentation.watermarkEnabled,
        watermark_name: presentation.watermarkEnabled ? presentation.watermarkName.trim() || null : null,
        watermark_logo_media_id: presentation.watermarkEnabled ? resolvedWatermarkLogoMediaId : null,
        watermark_logo_url: presentation.watermarkEnabled ? resolvedWatermarkLogoUrl || null : null,
        watermark_phone: presentation.watermarkEnabled ? presentation.watermarkPhone.trim() || null : null,
        watermark_extra_text: presentation.watermarkEnabled ? presentation.watermarkExtraText.trim() || null : null,
        watermark_style: presentation.watermarkStyle,
        watermark_qr_enabled: presentation.watermarkEnabled && (presentation.watermarkStyle === "qr_only" || presentation.watermarkQrEnabled),
        watermark_qr_value: presentation.watermarkEnabled && (presentation.watermarkStyle === "qr_only" || presentation.watermarkQrEnabled) ? presentation.watermarkQrValue.trim() || null : null,
      }));
      const { error: playlistError } = await supabase
        .from("tv_playlist_items")
        .insert(rows);
      if (playlistError) throw playlistError;
      await onSaved();
      setSaved(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível salvar o conteúdo.",
      );
    } finally {
      setSaving(false);
    }
  };

  const fileWarning =
    fileInfo &&
    (fileInfo.width < 1920 ||
      fileInfo.height < 1080 ||
      Math.abs(fileInfo.width / fileInfo.height - 16 / 9) > 0.03);
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className={`composer-modal${activeTab === "appearance" ? " presentation-modal" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="composer-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="composer-title">Adicionar conteúdo</h2>
            <p>Configure o que será exibido e em quais TVs.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        {saved ? (
          <div className="success-state">
            <span>
              <Check size={28} />
            </span>
            <h3>Conteúdo adicionado</h3>
            <p>
              Será carregado automaticamente em: {selectedNames.join(", ")}.
            </p>
            <div className="modal-actions">
              {selectedDisplays.map((id) => (
                <a
                  key={id}
                  className="button secondary"
                  href={`/tv/${companyId}/${id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Exibir em{" "}
                  {displays.find((display) => display.id === id)?.name}
                </a>
              ))}
              <button className="button primary" onClick={onClose}>
                Concluir
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="form-tabs four" role="tablist" aria-label="Etapas do conteúdo">
              <button type="button" role="tab" aria-selected={activeTab === "content"} className={activeTab === "content" ? "active" : ""} onClick={() => setActiveTab("content")}>1. Conteúdo</button>
              <button type="button" role="tab" aria-selected={activeTab === "appearance"} className={activeTab === "appearance" ? "active" : ""} onClick={() => setActiveTab("appearance")}>2. Aparência</button>
              <button type="button" role="tab" aria-selected={activeTab === "schedule"} className={activeTab === "schedule" ? "active" : ""} onClick={() => setActiveTab("schedule")}>3. Quando exibir</button>
              <button type="button" role="tab" aria-selected={activeTab === "tvs"} className={activeTab === "tvs" ? "active" : ""} onClick={() => setActiveTab("tvs")}>4. TVs</button>
            </div>
            <div className="form-tab-panel" hidden={activeTab !== "content"}>
            <div className="content-type-picker three">
              <button
                type="button"
                className={type === "message" ? "active" : ""}
                onClick={() => changeType("message")}
              >
                <MessageSquareText size={20} />
                <span>Texto</span>
              </button>
              <button
                type="button"
                className={type === "image" ? "active" : ""}
                onClick={() => changeType("image")}
              >
                <FileImage size={20} />
                <span>Imagem</span>
              </button>
              <button
                type="button"
                className={type === "video" ? "active" : ""}
                onClick={() => changeType("video")}
              >
                <Video size={20} />
                <span>Vídeo</span>
              </button>
            </div>
            <div className="editor-form">
              <SoundPicker companyId={companyId} value={sound} isVideo={type === "video"} onChange={setSound} />
              <label>
                Título
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Nome para identificar no painel"
                />
              </label>
              {type === "message" ? (
                <label>
                  Texto exibido
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={4}
                    placeholder="Digite a mensagem para os clientes"
                    required
                  />
                </label>
              ) : (
                <>
                  <div className="media-source-picker">
                    <button
                      type="button"
                      className={mediaSource === "upload" ? "active" : ""}
                      onClick={() => setMediaSource("upload")}
                    >
                      <Upload size={17} />
                      Enviar arquivo
                    </button>
                    <button
                      type="button"
                      className={mediaSource === "r2" ? "active" : ""}
                      onClick={() => {
                        setMediaSource("r2");
                        void loadR2();
                      }}
                    >
                      <Cloud size={17} />
                      Escolher da biblioteca
                    </button>
                  </div>
                  {mediaSource === "upload" ? (
                    <label className="file-picker">
                      <Upload size={20} />
                      <span>
                        {file
                          ? file.name
                          : type === "video"
                            ? "Selecionar vídeo MP4"
                            : "Selecionar imagem JPG, PNG ou WebP"}
                      </span>
                      <input
                        className="sr-only"
                        type="file"
                        accept={
                          type === "video"
                            ? "video/mp4"
                            : "image/jpeg,image/png,image/webp"
                        }
                        onChange={(event) =>
                          void selectFile(event.target.files?.[0] ?? null)
                        }
                        required
                      />
                    </label>
                  ) : (
                    <div className="r2-picker">
                      <div className="r2-picker-header">
                        <span>
                          Biblioteca disponível · {filteredObjects.length}{" "}
                          item(ns)
                        </span>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => void loadR2()}
                          aria-label="Atualizar biblioteca de mídias"
                        >
                          <RefreshCw
                            className={loadingR2 ? "spin" : ""}
                            size={16}
                          />
                        </button>
                      </div>
                      <input
                        className="media-library-search"
                        type="search"
                        value={mediaSearch}
                        onChange={(event) => {
                          setMediaSearch(event.target.value);
                          setMediaPage(0);
                        }}
                        placeholder={`Buscar ${type === "video" ? "vídeos" : "imagens"} pelo nome`}
                        aria-label="Buscar na biblioteca de mídias"
                      />
                      {loadingR2 ? (
                        <p>Consultando biblioteca e R2...</p>
                      ) : visibleObjects.length ? (
                        <>
                          <div className="r2-object-grid">
                            {visibleObjects.map((object) => (
                              <button
                                type="button"
                                key={object.key}
                                className={
                                  selectedR2Key === object.key ? "selected" : ""
                                }
                                onClick={() => {
                                  setSelectedR2Key(object.key);
                                  setAnimation(object.animation ?? "none");
                                  setTitle(
                                    (current) => current || object.filename,
                                  );
                                }}
                              >
                                {object.type === "image" ? (
                                  <img src={object.publicUrl} alt="" />
                                ) : (
                                  <video
                                    src={object.publicUrl}
                                    preload="metadata"
                                    muted
                                    playsInline
                                  />
                                )}
                                <span>{object.filename}</span>
                                <small>
                                  {object.source === "library"
                                    ? "Biblioteca"
                                    : "R2 · ainda não cadastrada"}
                                </small>
                              </button>
                            ))}
                          </div>
                          <div className="media-pagination">
                            <button
                              type="button"
                              className="button secondary"
                              disabled={mediaPage === 0}
                              onClick={() =>
                                setMediaPage((page) => Math.max(0, page - 1))
                              }
                            >
                              Anterior
                            </button>
                            <span>
                              Página {mediaPage + 1} de {mediaPageCount}
                            </span>
                            <button
                              type="button"
                              className="button secondary"
                              disabled={mediaPage + 1 >= mediaPageCount}
                              onClick={() =>
                                setMediaPage((page) =>
                                  Math.min(mediaPageCount - 1, page + 1),
                                )
                              }
                            >
                              Próxima
                            </button>
                          </div>
                        </>
                      ) : (
                        <p>
                          Nenhuma{" "}
                          {type === "video" ? "mídia de vídeo" : "imagem"}{" "}
                          disponível para esta empresa
                          {mediaSearch ? " com essa busca" : ""}.
                        </p>
                      )}
                    </div>
                  )}
                  {type === "image" ? (
                    <div className="animation-editor">
                      <label>
                        Ajuste para a tela da TV
                        <select
                          value={imageFit}
                          onChange={(event) => setImageFit(event.target.value as TvImageFit)}
                        >
                          <option value="contain">Mostrar arte inteira com fundo preto</option>
                          <option value="blur_background">Arte central com fundo desfocado</option>
                          <option value="cover">Preencher a tela cortando as bordas</option>
                          <option value="fill">Esticar para preencher</option>
                        </select>
                      </label>
                      <label>
                        Animação da imagem
                        <select
                          value={animation}
                          onChange={(event) =>
                            setAnimation(event.target.value as ImageAnimation)
                          }
                        >
                          <option value="none">Sem animação</option>
                          <option value="zoom_in">
                            Zoom suave aproximando
                          </option>
                          <option value="zoom_out">Zoom suave afastando</option>
                          <option value="pan_left">
                            Movimento para a esquerda
                          </option>
                          <option value="pan_right">
                            Movimento para a direita
                          </option>
                        </select>
                      </label>
                      {previewUrl ? (
                        <div className={`image-motion-preview image-fit-${imageFit}`}>
                          {imageFit === "blur_background" ? (
                            <img className="preview-blurred-background" src={previewUrl} alt="" aria-hidden="true" />
                          ) : null}
                          <img
                            key={`${previewUrl}-${animation}`}
                            className={`preview-main-image image-motion image-motion-${animation}`}
                            style={
                              {
                                "--motion-duration": `${duration}s`,
                              } as React.CSSProperties
                            }
                            src={previewUrl}
                            alt="Prévia da animação selecionada"
                          />
                          <CaptionOverlay settings={caption} className="preview-caption" />
                          <span>
                            Prévia ·{" "}
                            {animation === "none"
                              ? "sem animação"
                              : "movimento contínuo durante a exibição"}
                          </span>
                        </div>
                      ) : (
                        <p className="form-hint">
                          Selecione uma imagem para visualizar a animação.
                        </p>
                      )}
                    </div>
                  ) : null}
                  {type === "video" && previewUrl ? (
                    <div className="image-motion-preview">
                      <video
                        className="preview-main-image"
                        src={previewUrl}
                        preload="metadata"
                        muted
                        playsInline
                        controls
                      />
                      <CaptionOverlay settings={caption} className="preview-caption" />
                    </div>
                  ) : null}
                  <CaptionSettingsFields value={caption} onChange={setCaption} />
                  <div
                    className={`resolution-note ${fileWarning ? "warning" : ""}`}
                  >
                    <strong>
                      {type === "video"
                        ? "Vídeo recomendado: MP4, H.264/AAC, 1920 × 1080 px"
                        : "Arte recomendada: 1920 × 1080 px (16:9)"}
                    </strong>
                    <span>
                      {fileInfo && mediaSource === "upload"
                        ? `Arquivo selecionado: ${fileInfo.width} × ${fileInfo.height} px${fileInfo.duration ? ` · ${Math.round(fileInfo.duration)} s` : ""}. `
                        : ""}
                      O conteúdo será encaixado sem deformação.
                    </span>
                  </div>
                  {type === "video" && fileInfo && !fileInfo.hasAudio ? (
                    <div className="resolution-note warning" role="status">
                      <strong>Este vídeo não contém faixa de áudio</strong>
                      <span>Ele será exibido sem som. Escolha outro arquivo ou adicione uma trilha em “Som da mídia”.</span>
                    </div>
                  ) : null}
                </>
              )}
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
            </div></div>
            <div className="form-tab-panel" hidden={activeTab !== "appearance"}>
              <PresentationSettingsFields
                companyId={companyId}
                value={presentation}
                onChange={setPresentation}
                watermarkTemplates={watermarkTemplates}
                preview={{
                  type,
                  url: previewUrl,
                  message: message.trim() || title.trim(),
                  fit: imageFit,
                }}
              />
            </div>
            <div className="form-tab-panel editor-form" hidden={activeTab !== "schedule"}>
              <ContentScheduleFields value={schedule} onChange={setSchedule}/>
            </div>
            <div className="form-tab-panel editor-form" hidden={activeTab !== "tvs"}>
              <fieldset>
                <legend>Exibir nas TVs</legend>
                {displays.length === 0 ? (
                  <p className="form-hint">
                    Cadastre primeiro uma TV na seção Canal.
                  </p>
                ) : (
                  <div className="display-selection"><label className="select-all-displays"><input type="checkbox" checked={allDisplaysSelected} onChange={() => setSelectedDisplays(allDisplaysSelected ? [] : displays.map(display => display.id))}/><span><strong>Todas as TVs</strong><small>Selecionar ou desmarcar todas de uma vez</small></span></label><div className="check-grid">
                    {displays.map((display) => (
                      <label key={display.id}>
                        <input
                          type="checkbox"
                          checked={selectedDisplays.includes(display.id)}
                          onChange={() => toggleDisplay(display.id)}
                        />
                        <span>{display.name}</span>
                      </label>
                    ))}
                  </div></div>
                )}
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
              <button
                className="button primary"
                disabled={saving || displays.length === 0}
              >
                {saving ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Upload size={17} />
                )}{" "}
                Salvar e exibir
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
