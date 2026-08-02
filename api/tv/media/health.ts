import { ListObjectsV2Command } from '@aws-sdk/client-s3'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { HttpError, requireAuthenticatedCompany } from '../../_lib/auth.js'
import { getR2Config } from '../../_lib/r2.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Método não permitido.' })
  try {
    const company = await requireAuthenticatedCompany(request)
    const { client, bucket } = getR2Config()
    await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: `tv/${company.companyId}/`, MaxKeys: 1 }))
    response.setHeader('Cache-Control', 'private, no-store')
    return response.status(200).json({ ok: true, provider: 'cloudflare_r2' })
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 503
    const message = error instanceof Error ? error.message : 'Cloudflare R2 indisponível.'
    return response.status(status).json({ error: message })
  }
}
