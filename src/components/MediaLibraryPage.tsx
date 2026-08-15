import { useMemo, useState } from "react";
import { Cloud, FileImage, LoaderCircle, MessageSquareText, Music2, Trash2, Video } from "lucide-react";
import type { TvDisplayRecord, TvMediaRecord, TvPlaylistRecord } from "../hooks/useTvData";
import { deleteTvMedia } from "../services/storage";

const formatSize = (bytes?: number | null) => bytes
  ? new Intl.NumberFormat("pt-BR", { style: "unit", unit: bytes >= 1024 ** 2 ? "megabyte" : "kilobyte", maximumFractionDigits: 1 }).format(bytes / (bytes >= 1024 ** 2 ? 1024 ** 2 : 1024))
  : "Sem arquivo";

export function MediaLibraryPage({ media, items, displays, onReload }: { media: TvMediaRecord[]; items: TvPlaylistRecord[]; displays: TvDisplayRecord[]; onReload: () => Promise<void> }) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      counts.set(item.media_id, (counts.get(item.media_id) ?? 0) + 1);
      if (item.sound_media_id) counts.set(item.sound_media_id, (counts.get(item.sound_media_id) ?? 0) + 1);
    });
    displays.forEach((display) => {
      if (display.continuous_audio_media_id) counts.set(display.continuous_audio_media_id, (counts.get(display.continuous_audio_media_id) ?? 0) + 1);
    });
    return counts;
  }, [displays, items]);

  const remove = async (item: TvMediaRecord) => {
    const used = usage.get(item.id) ?? 0;
    const warning = used ? `Esta mídia está em ${used} TV(s) e será removida dessas programações. Continuar?` : "Excluir esta mídia permanentemente, inclusive do Cloudflare R2?";
    if (!window.confirm(warning)) return;
    setDeleting(item.id);
    setError(null);
    try { await deleteTvMedia(item.id); await onReload(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível excluir a mídia."); }
    finally { setDeleting(null); }
  };

  return (
    <>
      <div className="page-header"><div><h1>Armazenamento e mídias</h1><p>Gerencie imagens, vídeos, áudios e textos usados pelo canal.</p></div></div>
      <div className="storage-note"><Cloud size={22} /><div><strong>Limpeza automática ativa</strong><p>Mídias sem qualquer uso por mais de 7 dias são removidas diariamente do banco e do Cloudflare R2. Conteúdos presentes em TVs, programas, campanhas, temas ou chamadas são preservados.</p></div></div>
      {error ? <div className="system-alert error" role="alert">{error}</div> : null}
      <section className="card media-library">
        <div className="section-title"><h2>Biblioteca de mídias</h2><span className="badge">{media.length}</span></div>
        {media.length === 0 ? (
          <div className="empty compact"><div><h3>Nenhuma mídia cadastrada</h3><p>Adicione textos, imagens, vídeos ou áudios na Programação.</p></div></div>
        ) : (
          <div className="media-grid">
            {media.map((item) => {
              const url = item.public_url ?? item.media_url;
              const used = usage.get(item.id) ?? 0;
              const Icon = item.media_type === "video" ? Video : item.media_type === "image" ? FileImage : item.media_type === "audio" ? Music2 : MessageSquareText;
              const typeName = item.media_type === "video" ? "Vídeo" : item.media_type === "image" ? "Imagem" : item.media_type === "audio" ? "Áudio" : "Texto";
              return (
                <article className="media-card" key={item.id}>
                  <div className="media-thumb">{item.media_type === "image" && url ? <img src={url} alt="" /> : item.media_type === "video" && url ? <video src={url} preload="metadata" muted playsInline /> : <Icon size={30} />}</div>
                  <div className="media-card-copy"><strong>{item.title}</strong><span>{typeName} · {formatSize(item.file_size)}</span><span>{used > 0 ? `Em uso em ${used} TV(s)` : "Sem uso · elegível após 7 dias"}</span></div>
                  <button className="icon-button danger" onClick={() => void remove(item)} disabled={deleting === item.id} aria-label={`Excluir ${item.title}`}>{deleting === item.id ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}</button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
