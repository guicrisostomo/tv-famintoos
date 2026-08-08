import type { TvMedia } from '../domain/tv'

export function resolveMediaUrl(media: TvMedia): string | null {
  if (media.storageProvider === 'cloudflare_r2') return media.publicUrl ?? null
  if (media.storageProvider === 'supabase_storage') return media.publicUrl ?? media.mediaUrl ?? null
  if (media.storageProvider === 'external_url') return media.mediaUrl ?? media.publicUrl ?? null
  return media.publicUrl ?? media.mediaUrl ?? null
}

export function isPlayableMedia(media: TvMedia): boolean {
  if (media.type === 'message') return Boolean(media.title?.trim())
  if (media.type === 'qr_code') return Boolean(media.mediaUrl?.trim() || media.publicUrl?.trim())
  return Boolean(resolveMediaUrl(media))
}

export async function playVideoElement(video: HTMLVideoElement) {
  const result = video.play()
  if (result && typeof result.then === 'function') await result
}
