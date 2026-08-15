import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getR2Config } from './r2.js'

interface MediaRecord { id: string; company_id: string; r2_asset_id: number | null; storage_key: string | null }
interface R2AssetRecord { id: number; business_cnpj: string; r2_key: string }

export async function isMediaUsed(supabase: SupabaseClient, mediaId: string) {
  const queries = [
    supabase.from('tv_playlist_items').select('id', { count: 'exact', head: true }).eq('media_id', mediaId),
    supabase.from('tv_playlist_items').select('id', { count: 'exact', head: true }).eq('sound_media_id', mediaId),
    supabase.from('tv_displays').select('id', { count: 'exact', head: true }).eq('continuous_audio_media_id', mediaId),
    supabase.from('tv_program_items').select('id', { count: 'exact', head: true }).eq('media_id', mediaId),
    supabase.from('tv_campaigns').select('id', { count: 'exact', head: true }).eq('media_id', mediaId),
    supabase.from('tv_display_themes').select('id', { count: 'exact', head: true }).or(`logo_media_id.eq.${mediaId},background_media_id.eq.${mediaId},opening_media_id.eq.${mediaId},commercial_intro_media_id.eq.${mediaId},commercial_outro_media_id.eq.${mediaId}`),
    supabase.from('tv_call_templates').select('id', { count: 'exact', head: true }).or(`logo_media_id.eq.${mediaId},sound_media_id.eq.${mediaId}`),
  ]
  const results = await Promise.all(queries)
  const error = results.find(result => result.error)?.error
  if (error) throw error
  return results.some(result => (result.count ?? 0) > 0)
}

export async function deleteMediaRecord(supabase: SupabaseClient, media: MediaRecord) {
  const { data: deleted, error: databaseError } = await supabase.from('tv_media').delete().eq('id', media.id).eq('company_id', media.company_id).select('id').maybeSingle()
  if (databaseError) throw databaseError
  if (!deleted) throw new Error('Mídia não encontrada ou exclusão não autorizada.')

  if (media.storage_key) { const { client, bucket } = getR2Config(); await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: media.storage_key })) }
  if (media.r2_asset_id) {
    const { error: assetError } = await supabase.from('r2_media_assets').delete().eq('id', media.r2_asset_id).eq('business_cnpj', media.company_id)
    if (assetError) throw assetError
  }
}

export async function deleteOrphanR2Asset(supabase: SupabaseClient, asset: R2AssetRecord) {
  const { client, bucket } = getR2Config()
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: asset.r2_key }))
  const { error } = await supabase.from('r2_media_assets').delete().eq('id', asset.id).eq('business_cnpj', asset.business_cnpj)
  if (error) throw error
}

export async function isR2AssetUsed(supabase: SupabaseClient, asset: R2AssetRecord) {
  const results = await Promise.all([
    supabase.from('tv_media').select('id', { count: 'exact', head: true }).eq('r2_asset_id', asset.id),
    supabase.from('tv_generated_promotion_products').select('id', { count: 'exact', head: true }).eq('company_id', asset.business_cnpj).eq('image_key', asset.r2_key),
    supabase.from('tv_generated_promotion_versions').select('id', { count: 'exact', head: true }).eq('company_id', asset.business_cnpj).eq('generated_image_key', asset.r2_key),
  ])
  const error = results.find(result => result.error)?.error
  if (error) throw error
  return results.some(result => (result.count ?? 0) > 0)
}
