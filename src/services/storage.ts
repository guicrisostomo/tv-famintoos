import { authenticatedFetch } from "./authenticatedFetch";

export interface UploadTicket {
  uploadUrl: string;
  storageKey: string;
  publicUrl?: string;
  expiresAt: string;
}
export interface R2ExistingObject {
  key: string;
  filename: string;
  publicUrl: string;
  size: number;
  lastModified: string | null;
  type: "image" | "video" | "audio";
}

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
]);

export async function requestR2Upload(
  file: File,
  mediaType: string,
): Promise<UploadTicket> {
  if (!allowedTypes.has(file.type))
    throw new Error("Tipo de arquivo não permitido");
  const response = await authenticatedFetch("/api/tv/media/upload-ticket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type,
      fileSize: file.size,
      mediaType,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Cloudflare R2 indisponível: ${detail || `HTTP ${response.status}`}`,
    );
  }
  return response.json() as Promise<UploadTicket>;
}

export async function uploadToR2(ticket: UploadTicket, file: File) {
  const response = await fetch(ticket.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!response.ok)
    throw new Error(
      `Falha na conexão com o Cloudflare R2 (HTTP ${response.status}).`,
    );
}

export async function deleteTvMedia(mediaId: string) {
  const response = await authenticatedFetch("/api/tv/media/delete", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mediaId }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok)
    throw new Error(
      result.error ?? `Falha ao excluir mídia (HTTP ${response.status}).`,
    );
}

export async function normalizeTvVideo(mediaId: string) {
  const response = await authenticatedFetch('/api/tv/media/normalize-video', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mediaId }),
  })
  const result = await response.json().catch(() => ({})) as { error?: string; optimized?: boolean }
  if (!response.ok) throw new Error(result.error ?? `Falha ao otimizar vídeo (HTTP ${response.status}).`)
  return result
}

export async function listUnregisteredR2Objects() {
  const response = await authenticatedFetch("/api/tv/media/r2-objects");
  const result = (await response.json().catch(() => ({}))) as {
    objects?: R2ExistingObject[];
    total?: number;
    error?: string;
  };
  if (!response.ok)
    throw new Error(
      result.error ?? `Falha ao listar mídias do R2 (HTTP ${response.status}).`,
    );
  return result.objects ?? [];
}

export async function importR2Object(
  key: string,
  title: string,
  durationSeconds: number,
  animation: string,
) {
  const response = await authenticatedFetch("/api/tv/media/import-r2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, title, durationSeconds, animation }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    mediaId?: string;
    error?: string;
  };
  if (!response.ok || !result.mediaId)
    throw new Error(
      result.error ??
        `Falha ao importar mídia do R2 (HTTP ${response.status}).`,
    );
  return result.mediaId;
}
