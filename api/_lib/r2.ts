import { S3Client } from '@aws-sdk/client-s3'
import { HttpError } from './auth.js'

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new HttpError(503, `Variável ${name} não configurada na Vercel.`)
  return value
}

export function getR2Config() {
  const accountId = required('R2_ACCOUNT_ID')
  return {
    client: new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: required('R2_ACCESS_KEY_ID'), secretAccessKey: required('R2_SECRET_ACCESS_KEY') },
    }),
    bucket: required('R2_BUCKET'),
    publicBaseUrl: required('R2_PUBLIC_BASE_URL').replace(/\/$/, ''),
  }
}
