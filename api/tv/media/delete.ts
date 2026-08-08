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
    const blockingQueries = await Promise.all([
      company.supabase.from('tv_program_items').select('id', { count: 'exact', head: true }).eq('company_id', company.companyId).eq('media_id', mediaId),
      company.supabase.from('tv_campaigns').select('id', { count: 'exact', head: true }).eq('company_id', company.companyId).eq('media_id', mediaId),
      company.supabase.from('tv_display_themes').select('id', { count: 'exact', head: true }).eq('company_id', company.companyId).or(`logo_media_id.eq.${mediaId},background_media_id.eq.${mediaId},opening_media_id.eq.${mediaId},commercial_intro_media_id.eq.${mediaId},commercial_outro_media_id.eq.${mediaId}`),
      company.supabase.from('tv_call_templates').select('id', { count: 'exact', head: true }).eq('company_id', company.companyId).or(`logo_media_id.eq.${mediaId},sound_media_id.eq.${mediaId}`),
    ])
    const blockingError = blockingQueries.find(result => result.error)?.error
    if (blockingError) throw blockingError
    if (blockingQueries.some(result => (result.count ?? 0) > 0)) throw new HttpError(409, 'Esta mídia está em uso por uma campanha, tema, programa ou chamada e não pode ser excluída.')
    const { error: soundtrackError } = await company.supabase.from('tv_playlist_items').update({ sound_media_id: null }).eq('company_id', company.companyId).eq('sound_media_id', mediaId)
    if (soundtrackError) throw soundtrackError
    const { error: playlistError } = await company.supabase.from('tv_playlist_items').delete().eq('company_id', company.companyId).eq('media_id', mediaId)
    if (playlistError) throw playlistError
    await deleteMediaRecord(company.supabase, media)
    return response.status(200).json({ ok: true })
  } catch (error) {
    const postgresCode = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
    const status = error instanceof HttpError ? error.status : postgresCode === '23503' ? 409 : 500
    const message = postgresCode === '23503' ? 'Esta mídia está em uso por uma campanha, tema ou programa e não pode ser excluída.' : error instanceof Error ? error.message : 'Não foi possível excluir a mídia.'
    return response.status(status).json({ error: message })
  }
}
