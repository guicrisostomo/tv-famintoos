export interface UploadTicket {
  uploadUrl: string
  storageKey: string
  publicUrl?: string
  expiresAt: string
}

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'audio/mpeg', 'audio/wav'])

export async function requestR2Upload(file: File, mediaType: string): Promise<UploadTicket> {
  if (!allowedTypes.has(file.type)) throw new Error('Tipo de arquivo não permitido')
  const response = await authenticatedFetch('/api/tv/media/upload-ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, mimeType: file.type, fileSize: file.size, mediaType }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Cloudflare R2 indisponível: ${detail || `HTTP ${response.status}`}`)
  }
  return response.json() as Promise<UploadTicket>
}

export async function uploadToR2(ticket: UploadTicket, file: File) {
  const response = await fetch(ticket.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
  if (!response.ok) throw new Error(`Falha na conexão com o Cloudflare R2 (HTTP ${response.status}).`)
}
import { authenticatedFetch } from './authenticatedFetch'
