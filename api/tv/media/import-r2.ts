import { HeadObjectCommand } from '@aws-sdk/client-s3'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { HttpError, requireAuthenticatedCompany } from '../../_lib/auth.js'
import { getR2Config } from '../../_lib/r2.js'

const mimeByExtension: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4' }

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método não permitido.' })
  try {
    const company = await requireAuthenticatedCompany(request)
    const key = typeof request.body?.key === 'string' ? request.body.key : ''
    const title = typeof request.body?.title === 'string' ? request.body.title.trim() : ''
    const duration = Number(request.body?.durationSeconds)
    const animation = ['none', 'zoom_in', 'zoom_out', 'pan_left', 'pan_right'].includes(request.body?.animation) ? request.body.animation : 'none'
    if (!key.startsWith(`tv/${company.companyId}/`) || key.includes('..')) throw new HttpError(403, 'A mídia não pertence à empresa autenticada.')
    const extension = key.split('.').at(-1)?.toLowerCase() ?? ''
    const fallbackMime = mimeByExtension[extension]
    if (!fallbackMime) throw new HttpError(400, 'Formato não suportado. Use JPG, PNG, WebP ou MP4.')
    const { data: existing } = await company.supabase.from('tv_media').select('id').eq('company_id', company.companyId).eq('storage_key', key).maybeSingle()
    if (existing) return response.status(200).json({ mediaId: existing.id, existing: true })

    const { client, bucket, publicBaseUrl } = getR2Config()
    const object = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    const mimeType = object.ContentType && (object.ContentType.startsWith('image/') || object.ContentType === 'video/mp4') ? object.ContentType : fallbackMime
    const mediaType = mimeType.startsWith('video/') ? 'video' : 'image'
    const publicUrl = `${publicBaseUrl}/${key}`
    const filename = decodeURIComponent(key.split('/').at(-1) ?? key)
    const sha = object.ChecksumSHA256 ?? object.ETag?.replaceAll('"', '') ?? `r2-${key}`
    let assetId: number | null = null
    const { data: knownAsset } = await company.supabase.from('r2_media_assets').select('id').eq('business_cnpj', company.companyId).eq('r2_key', key).maybeSingle()
    if (knownAsset) assetId = knownAsset.id
    else {
      const { data: asset, error: assetError } = await company.supabase.from('r2_media_assets').insert({ business_cnpj: company.companyId, uploaded_by_uid: company.userId, original_name: filename, file_ext: extension, mime_type: mimeType, file_size: object.ContentLength ?? 0, sha256: sha, r2_key: key, public_url: publicUrl, bucket_folder: key.split('/').slice(0, -1).join('/'), media_kind: mediaType, metadata: { source: 'r2_import', etag: object.ETag ?? null } }).select('id').single()
      if (assetError) throw assetError
      assetId = asset.id
    }
    const { data: media, error: mediaError } = await company.supabase.from('tv_media').insert({ company_id: company.companyId, title: title || filename, media_type: mediaType, media_url: publicUrl, duration_seconds: Number.isFinite(duration) ? Math.max(3, Math.min(300, duration)) : 10, animation: mediaType === 'image' ? animation : 'none', is_active: true, storage_provider: 'cloudflare_r2', storage_key: key, public_url: publicUrl, mime_type: mimeType, file_size: object.ContentLength ?? 0, r2_asset_id: assetId }).select('id').single()
    if (mediaError) throw mediaError
    return response.status(201).json({ mediaId: media.id, existing: false })
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 503
    return response.status(status).json({ error: error instanceof Error ? error.message : 'Não foi possível importar a mídia do R2.' })
  }
}
