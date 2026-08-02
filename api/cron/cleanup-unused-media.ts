import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { deleteMediaRecord, deleteOrphanR2Asset, isMediaUsed } from '../_lib/mediaCleanup.js'

export const config = { maxDuration: 60 }

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Método não permitido.' })
  if (!process.env.CRON_SECRET || request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return response.status(401).json({ error: 'Não autorizado.' })
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return response.status(503).json({ error: 'Supabase administrativo não configurado.' })

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: candidates, error } = await supabase.from('tv_media').select('id,company_id,r2_asset_id,storage_key').lt('created_at', cutoff).order('created_at').limit(100)
  if (error) return response.status(500).json({ error: error.message })

  let deleted = 0; let skipped = 0; let orphanObjectsDeleted = 0; const failures: string[] = []
  for (const media of candidates ?? []) {
    try {
      if (await isMediaUsed(supabase, media.id)) { skipped += 1; continue }
      await deleteMediaRecord(supabase, media); deleted += 1
    } catch (cleanupError) { failures.push(`${media.id}: ${cleanupError instanceof Error ? cleanupError.message : 'erro desconhecido'}`) }
  }
  const { data: assets, error: assetQueryError } = await supabase.from('r2_media_assets').select('id,business_cnpj,r2_key').lt('created_at', cutoff).order('created_at').limit(100)
  if (assetQueryError) failures.push(`r2_assets: ${assetQueryError.message}`)
  for (const asset of assets ?? []) {
    try {
      const { count, error: referenceError } = await supabase.from('tv_media').select('id', { count: 'exact', head: true }).eq('r2_asset_id', asset.id)
      if (referenceError) throw referenceError
      if ((count ?? 0) > 0) continue
      await deleteOrphanR2Asset(supabase, asset); orphanObjectsDeleted += 1
    } catch (cleanupError) { failures.push(`r2:${asset.id}: ${cleanupError instanceof Error ? cleanupError.message : 'erro desconhecido'}`) }
  }
  return response.status(failures.length ? 207 : 200).json({ ok: failures.length === 0, cutoff, scanned: candidates?.length ?? 0, deleted, skipped, orphanObjectsDeleted, failures })
}
