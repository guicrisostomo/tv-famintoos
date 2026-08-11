import { useEffect, useState } from "react";
import { Download, Pause, Play, SkipForward } from "lucide-react";
import type { TvPlaylistRecord } from "../hooks/useTvData";

export function PreviewPanel({ items }: { items: TvPlaylistRecord[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const currentItem = items[index % Math.max(items.length, 1)];
  const current = currentItem?.media;
  const imageUrl = current?.public_url ?? current?.media_url;
  const next = () =>
    setIndex((value) => (value + 1) % Math.max(items.length, 1));

  useEffect(() => {
    if (!playing || !current || items.length === 0) return;
    const timer = window.setTimeout(
      () => setIndex((value) => (value + 1) % Math.max(items.length, 1)),
      (current.duration_seconds ?? 10) * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [current, items.length, playing]);

  return (
    <section className="card">
      <div className="section-title">
        <h2>Pré-visualização 16:9</h2>
        <span className="badge">
          {items.length > 0
            ? `${(index % items.length) + 1}/${items.length}`
            : "Sem itens"}
        </span>
      </div>
      <div
        key={`${currentItem?.id ?? "empty"}-${index}`}
        className={`preview transition-preview-${currentItem?.transition_type ?? "none"}`}
        style={{ "--transition-duration": `${currentItem?.transition_duration_ms ?? 700}ms` } as React.CSSProperties}
      >
        {!current ? (
          <div className="preview-placeholder">
            Tela preta
            <br />
            Nenhuma mídia válida configurada
          </div>
        ) : current.media_type === "image" && imageUrl ? (
          <>
            {currentItem.image_fit === "blur_background" ? (
              <img className="preview-blurred-background" src={imageUrl} alt="" aria-hidden="true" />
            ) : null}
            <img
              key={`${current.id}-${index}`}
              className={`preview-main-image image-fit-${currentItem.image_fit ?? "contain"} image-motion image-motion-${playing ? current.animation ?? "none" : "none"}`}
              style={{ "--motion-duration": `${current.duration_seconds ?? 10}s` } as React.CSSProperties}
              src={imageUrl}
              alt={current.title}
            />
          </>
        ) : current.media_type === "video" && imageUrl ? (
          <video src={imageUrl} autoPlay={playing} muted playsInline controls />
        ) : current.media_type === "message" ? (
          <div className="preview-message">{current.message_text}</div>
        ) : (
          <div className="preview-placeholder">{current.title}</div>
        )}
        {current && current.media_type !== "message" && currentItem.caption_text ? (
          <div className={`media-caption preview-caption caption-${currentItem.caption_animation ?? "none"}`}>
            {currentItem.caption_text}
          </div>
        ) : null}
        {currentItem?.watermark_enabled ? (
          <div className="tv-watermark preview-watermark">
            {(currentItem.watermark_logo?.public_url || currentItem.watermark_logo?.media_url || currentItem.watermark_logo_url) ? (
              <img src={currentItem.watermark_logo?.public_url ?? currentItem.watermark_logo?.media_url ?? currentItem.watermark_logo_url ?? undefined} alt="" />
            ) : null}
            <div>
              {currentItem.watermark_name ? <strong>{currentItem.watermark_name}</strong> : null}
              {currentItem.watermark_extra_text ? <span>{currentItem.watermark_extra_text}</span> : null}
            </div>
            {currentItem.watermark_phone ? <b>{currentItem.watermark_phone}</b> : null}
          </div>
        ) : null}
      </div>
      <div className="preview-actions">
        <button
          className="button primary"
          disabled={items.length === 0}
          onClick={() => setPlaying((value) => !value)}
        >
          {playing ? <Pause size={15} /> : <Play size={15} />}{" "}
          {playing ? "Pausar prévia" : "Reproduzir prévia"}
        </button>
        <button
          className="button secondary"
          disabled={items.length < 2}
          onClick={next}
        >
          <SkipForward size={15} /> Próximo item
        </button>
        {current?.media_type === "image" && imageUrl ? (
          <button
            className="button secondary"
            onClick={() =>
              void exportTvImage(
                imageUrl,
                current.title,
                currentItem.image_fit ?? "contain",
              )
            }
          >
            <Download size={15} /> Salvar imagem 16:9
          </button>
        ) : null}
      </div>
      {currentItem?.sound_media && (currentItem.sound_media.public_url || currentItem.sound_media.media_url) ? (
        <audio key={`${currentItem.id}-${index}`} src={currentItem.sound_media.public_url ?? currentItem.sound_media.media_url ?? undefined} autoPlay={playing} loop={currentItem.sound_loop ?? true} controls style={{ width: "100%" }} />
      ) : null}
    </section>
  );
}

async function exportTvImage(
  url: string,
  title: string,
  fit: NonNullable<TvPlaylistRecord["image_fit"]>,
) {
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) throw new Error(`Imagem indisponível (${response.status}).`);
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem.");
    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (fit === "blur_background") {
      context.save();
      context.filter = "blur(28px) brightness(42%) saturate(82%)";
      drawFitted(context, bitmap, canvas.width, canvas.height, "cover", 1.08);
      context.restore();
      context.fillStyle = "rgba(0,0,0,.22)";
      context.fillRect(0, 0, canvas.width, canvas.height);
      drawFitted(context, bitmap, canvas.width, canvas.height, "contain");
    } else {
      drawFitted(context, bitmap, canvas.width, canvas.height, fit);
    }
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error("Falha ao gerar a imagem.")),
        "image/webp",
        .92,
      ),
    );
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${safeFilename(title)}-tv-1920x1080.webp`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
  } finally {
    bitmap.close();
  }
}

function drawFitted(
  context: CanvasRenderingContext2D,
  image: ImageBitmap,
  width: number,
  height: number,
  fit: "contain" | "cover" | "fill",
  scale = 1,
) {
  if (fit === "fill") {
    context.drawImage(image, 0, 0, width, height);
    return;
  }
  const ratio = fit === "cover"
    ? Math.max(width / image.width, height / image.height)
    : Math.min(width / image.width, height / image.height);
  const targetWidth = image.width * ratio * scale;
  const targetHeight = image.height * ratio * scale;
  context.drawImage(image, (width - targetWidth) / 2, (height - targetHeight) / 2, targetWidth, targetHeight);
}

function safeFilename(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ") || "imagem";
}
