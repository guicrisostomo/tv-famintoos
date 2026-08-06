import { randomUUID } from 'node:crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { HttpError, requireAuthenticatedCompany } from '../../_lib/auth.js'
import { getR2Config } from '../../_lib/r2.js'

const allowedTypes = new Map([
  ['image/jpeg', 'images'], ['image/png', 'images'], ['image/webp', 'images'],
  ['video/mp4', 'videos'], ['audio/mpeg', 'audio'], ['audio/wav', 'audio'],
  ['audio/mp4', 'audio'], ['audio/x-m4a', 'audio'], ['audio/aac', 'audio'], ['audio/ogg', 'audio'],
])
const maxFileSize = 500 * 1024 * 1024

function safeFilename(filename: string) {
  const normalized = filename.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(-120)
  return normalized || 'media'
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método não permitido.' })
  try {
    const company = await requireAuthenticatedCompany(request)
    const { filename, mimeType, fileSize, mediaType } = request.body ?? {}
    const folder = typeof mimeType === 'string' ? allowedTypes.get(mimeType) : null
    if (!folder) throw new HttpError(400, 'Tipo de arquivo não permitido.')
    if (!Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > maxFileSize) throw new HttpError(400, 'Tamanho de arquivo inválido ou acima de 500 MB.')
    if (typeof filename !== 'string' || !filename.trim()) throw new HttpError(400, 'Nome do arquivo inválido.')

    const { client, bucket, publicBaseUrl } = getR2Config()
    const destination = mediaType === 'generated-promotion' && folder === 'images' ? 'generated-promotions' : folder
    const storageKey = `tv/${company.companyId}/${destination}/${randomUUID()}/${safeFilename(filename)}`
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: storageKey, ContentType: mimeType }), { expiresIn: 300 })
    return response.status(200).json({ uploadUrl, storageKey, publicUrl: `${publicBaseUrl}/${storageKey}`, expiresAt: new Date(Date.now() + 300_000).toISOString() })
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 503
    const message = error instanceof Error ? error.message : 'Não foi possível autorizar o upload no R2.'
    return response.status(status).json({ error: message })
  }
}
