import { createClient } from '@supabase/supabase-js'
import type { VercelRequest } from '@vercel/node'

export interface AuthenticatedCompany { userId: string; companyId: string }

export async function requireAuthenticatedCompany(request: VercelRequest): Promise<AuthenticatedCompany> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !publishableKey) throw new HttpError(503, 'Supabase não configurado no servidor.')

  const authorization = request.headers.authorization
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
  if (!token) throw new HttpError(401, 'Sessão obrigatória.')

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) throw new HttpError(401, 'Sessão inválida ou expirada.')

  const { data: profile, error: profileError } = await supabase.from('tb_user')
    .select('cnpj,fg_ativo').eq('uid', userData.user.id).eq('fg_ativo', true).single()
  if (profileError || !profile?.cnpj) throw new HttpError(403, 'Usuário sem empresa ativa.')
  return { userId: userData.user.id, companyId: profile.cnpj }
}

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
