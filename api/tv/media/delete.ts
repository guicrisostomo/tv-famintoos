import type { VercelRequest, VercelResponse } from '@vercel/node'
import { HttpError, requireAuthenticatedCompany } from '../../_lib/auth.js'
import { deleteMediaRecord } from '../../_lib/mediaCleanup.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'DELETE') return response.status(405).json({ error: 'Método não permitido.' })
  try {
    const company = await requireAuthenticatedCompany(request)
    const mediaId = request.body?.mediaId
    if (typeof mediaId !== 'string' || !mediaId) throw new HttpError(400, 'Mídia inválida.')
    const { data: media, error } = await company.supabase.from('tv_media').select('id,company_id,r2_asset_id,storage_key').eq('id', mediaId).eq('company_id', company.companyId).single()
    if (error || !media) throw new HttpError(404, 'Mídia não encontrada nesta empresa.')
    await deleteMediaRecord(company.supabase, media)
    return response.status(200).json({ ok: true })
  } catch (error) {
    const postgresCode = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
    const status = error instanceof HttpError ? error.status : postgresCode === '23503' ? 409 : 500
    const message = postgresCode === '23503' ? 'Esta mídia está em uso por uma campanha, tema ou programa e não pode ser excluída.' : error instanceof Error ? error.message : 'Não foi possível excluir a mídia.'
    return response.status(status).json({ error: message })
  }
}
