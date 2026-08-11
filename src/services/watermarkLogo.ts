import type { TvMediaRecord } from "../hooks/useTvData";
import { importR2Object, requestR2Upload, uploadToR2 } from "./storage";
import { supabase } from "./supabase";

const acceptedLogoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxLogoSize = 10 * 1024 * 1024;
const logoSelect =
  "id,company_id,title,media_type,media_url,message_text,duration_seconds,public_url,storage_provider,storage_key,file_size,r2_asset_id,created_at";

export async function uploadWatermarkLogo(companyId: string, file: File) {
  if (!supabase) throw new Error("Supabase não configurado.");
  validateLogoFile(file);

  const ticket = await requestR2Upload(file, "watermark-logo");
  if (!ticket.publicUrl)
    throw new Error("O Cloudflare R2 não retornou uma URL pública para o logo.");

  await uploadToR2(ticket, file);
  const mediaId = await importR2Object(
    ticket.storageKey,
    file.name.replace(/\.[^.]+$/, "") || "Logo da empresa",
    10,
    "none",
  );
  return loadLogoMedia(companyId, mediaId);
}

export async function importStoredWatermarkLogo(companyId: string, storageKey: string, title: string) {
  const mediaId = await importR2Object(storageKey, title.replace(/\.[^.]+$/, "") || "Logo da empresa", 10, "none");
  return loadLogoMedia(companyId, mediaId);
}

export async function resolveWatermarkLogo(companyId: string, mediaId: string | null, value: string) {
  if (mediaId) return loadLogoMedia(companyId, mediaId);
  const url = value.trim();
  if (!url) return null;
  if (!supabase) throw new Error("Supabase não configurado.");
  for (const field of ["public_url", "media_url"] as const) {
    const { data, error } = await supabase
      .from("tv_media")
      .select(logoSelect)
      .eq("company_id", companyId)
      .eq("media_type", "image")
      .eq("is_active", true)
      .eq(field, url)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as TvMediaRecord;
  }
  return importWatermarkLogoUrl(companyId, url);
}

async function loadLogoMedia(companyId: string, mediaId: string) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from("tv_media")
    .select(logoSelect)
    .eq("id", mediaId)
    .eq("company_id", companyId)
    .eq("media_type", "image")
    .eq("is_active", true)
    .single();
  if (error) throw error;
  return data as TvMediaRecord;
}

export async function importWatermarkLogoUrl(companyId: string, value: string) {
  const url = validHttpsUrl(value);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      mode: "cors",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(`Não foi possível baixar o logo informado (HTTP ${response.status}).`);
    const announcedSize = Number(response.headers.get("content-length"));
    if (Number.isFinite(announcedSize) && announcedSize > maxLogoSize)
      throw new Error("O logo precisa ter no máximo 10 MB.");
    const blob = await response.blob();
    const mimeType = blob.type.split(";")[0].toLowerCase();
    if (!acceptedLogoTypes.has(mimeType))
      throw new Error("A URL precisa apontar diretamente para uma imagem JPG, PNG ou WebP.");
    const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
    const filename = filenameFromUrl(url, extension);
    return await uploadWatermarkLogo(
      companyId,
      new File([blob], filename, { type: mimeType }),
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw new Error("O download do logo demorou demais. Baixe a imagem e use a opção de upload.", { cause: error });
    if (error instanceof TypeError)
      throw new Error("O site da imagem não permite a importação. Baixe a imagem e use a opção de upload.", { cause: error });
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function validateLogoFile(file: File) {
  if (!acceptedLogoTypes.has(file.type))
    throw new Error("Use uma imagem JPG, PNG ou WebP.");
  if (file.size <= 0 || file.size > maxLogoSize)
    throw new Error("O logo precisa ter no máximo 10 MB.");
}

function validHttpsUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    throw new Error("Informe uma URL HTTPS válida para o logo.");
  }
}

function filenameFromUrl(url: string, extension: string) {
  try {
    const candidate = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .slice(-90);
    const withoutExtension = candidate.replace(/\.[^.]+$/, "") || "logo-importado";
    return `${withoutExtension}.${extension}`;
  } catch {
    return `logo-importado.${extension}`;
  }
}
