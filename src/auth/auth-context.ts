import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'

export interface CompanyProfile { uid: string; email: string | null; name: string | null; companyId: string; userType: number }
export interface AuthState { user: User | null; profile: CompanyProfile | null; loading: boolean; error: string | null; signIn: (email: string, password: string) => Promise<void>; signOut: () => Promise<void>; retry: () => Promise<void> }
export const AuthContext = createContext<AuthState | null>(null)
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider'); return value }
