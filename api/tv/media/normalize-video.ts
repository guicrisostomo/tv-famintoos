import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { HttpError, requireAuthenticatedCompany } from '../../_lib/auth.js'
import { getR2Config } from '../../_lib/r2.js'

const require = createRequire(import.meta.url)
const ffmpegPath = require('ffmpeg-static') as string | null

function hasAudioStream(input: string) {
  if (!ffmpegPath) throw new HttpError(503, 'Conversor de vídeo indisponível no servidor.')
  return new Promise<boolean>((resolve, reject) => {
    const process = spawn(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-i', input,
      '-map', '0:a:0', '-c', 'copy', '-f', 'null', '-',
    ])
    process.stdout.resume()
    process.stderr.resume()
    process.on('error', reject)
    process.on('close', code => resolve(code === 0))
  })
}

async function runFfmpeg(input: string, output: string) {
  if (!ffmpegPath) throw new HttpError(503, 'Conversor de vídeo indisponível no servidor.')
  const hasAudio = await hasAudioStream(input)
  const inputArgs = hasAudio
    ? ['-i', input]
    : ['-i', input, '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000']
  const audioMap = hasAudio ? '0:a:0' : '1:a:0'
  return new Promise<void>((resolve, reject) => {
    const process = spawn(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y', ...inputArgs,
      '-map', '0:v:0', '-map', audioMap,
      '-c:v', 'libx264', '-profile:v', 'main', '-level:v', '3.1',
      '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '22',
      '-maxrate', '5M', '-bufsize', '10M', '-g', '60', '-keyint_min', '60', '-sc_threshold', '0',
      '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black,fps=30',
      '-fps_mode', 'cfr',
      '-c:a', 'aac', '-profile:a', 'aac_low', '-b:a', '128k', '-ar', '48000', '-ac', '2',
      ...(hasAudio ? [] : ['-shortest']),
      '-movflags', '+faststart', output,
    ])
    let detail = ''
    process.stderr.on('data', chunk => { detail = `${detail}${String(chunk)}`.slice(-4000) })
    process.on('error', reject)
    process.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg encerrou com código ${code}: ${detail}`)))
  })
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Método não permitido.' })
  let workdir: string | null = null
  try {
    const company = await requireAuthenticatedCompany(request)
    const mediaId = typeof request.body?.mediaId === 'string' ? request.body.mediaId : ''
    if (!mediaId) throw new HttpError(400, 'Mídia inválida.')
    const { data: media, error } = await company.supabase.from('tv_media')
      .select('id,company_id,media_type,storage_provider,storage_key,r2_asset_id')
      .eq('id', mediaId).eq('company_id', company.companyId).single()
    if (error || !media) throw new HttpError(404, 'Vídeo não encontrado para esta empresa.')
    if (media.media_type !== 'video' || media.storage_provider !== 'cloudflare_r2' || !media.storage_key)
      throw new HttpError(400, 'Somente vídeos armazenados no Cloudflare R2 podem ser otimizados.')
    if (media.storage_key.includes('/compatible-v2/')) return response.status(200).json({ optimized: false, alreadyCompatible: true })

    const { client, bucket, publicBaseUrl } = getR2Config()
    const source = await client.send(new GetObjectCommand({ Bucket: bucket, Key: media.storage_key }))
    const sourceBytes = await source.Body?.transformToByteArray()
    if (!sourceBytes?.length) throw new HttpError(404, 'Arquivo original não encontrado no R2.')
    workdir = await mkdtemp(join(tmpdir(), 'famintoos-video-'))
    const input = join(workdir, 'input.mp4')
    const output = join(workdir, 'output.mp4')
    await writeFile(input, sourceBytes)
    await runFfmpeg(input, output)
    const outputInfo = await stat(output)
    if (!outputInfo.size) throw new Error('A conversão produziu um arquivo vazio.')
    const outputBytes = await readFile(output)
    const newKey = `tv/${company.companyId}/videos/compatible-v2/${randomUUID()}.mp4`
    const publicUrl = `${publicBaseUrl}/${newKey}`
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: newKey, Body: outputBytes, ContentType: 'video/mp4', CacheControl: 'public, max-age=31536000, immutable' }))

    const { data: updated, error: updateError } = await company.supabase.from('tv_media').update({
      media_url: publicUrl, public_url: publicUrl, storage_key: newKey,
      mime_type: 'video/mp4', file_size: outputInfo.size,
    }).eq('id', media.id).eq('company_id', company.companyId).eq('storage_key', media.storage_key).select('id').maybeSingle()
    if (updateError || !updated) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: newKey })).catch(() => undefined)
      const { data: current } = await company.supabase.from('tv_media').select('storage_key')
        .eq('id', media.id).eq('company_id', company.companyId).maybeSingle()
      if (current?.storage_key?.includes('/compatible-v2/'))
        return response.status(200).json({ optimized: false, alreadyCompatible: true })
      throw updateError ?? new Error('Não foi possível atualizar o vídeo convertido.')
    }
    if (media.r2_asset_id) await company.supabase.from('r2_media_assets').update({ r2_key: newKey, public_url: publicUrl, mime_type: 'video/mp4', file_size: outputInfo.size, media_kind: 'video' }).eq('id', media.r2_asset_id).eq('business_cnpj', company.companyId)
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: media.storage_key })).catch(error => console.error('[normalize-video] falha ao remover original', { mediaId, error: String(error) }))
    console.info('[normalize-video] concluído', { mediaId, companyId: company.companyId, sourceBytes: sourceBytes.length, outputBytes: outputInfo.size })
    return response.status(200).json({ optimized: true, publicUrl })
  } catch (error) {
    console.error('[normalize-video] falhou', { error: error instanceof Error ? error.message : String(error) })
    const status = error instanceof HttpError ? error.status : 500
    return response.status(status).json({ error: error instanceof Error ? error.message : 'Falha ao converter o vídeo.' })
  } finally {
    if (workdir) await rm(workdir, { recursive: true, force: true }).catch(() => undefined)
  }
}
