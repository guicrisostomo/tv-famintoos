export type MediaType = 'image' | 'video' | 'message' | 'qr_code' | 'audio'
export type StorageProvider = 'cloudflare_r2' | 'supabase_storage' | 'external_url'
export type InterruptionKind = 'call' | 'urgent_notice' | 'campaign'
export type TvTransitionType = 'none' | 'fade' | 'slide_left' | 'slide_up' | 'zoom' | 'wipe'

export interface TvMedia {
  id: string
  companyId: string
  type: MediaType
  mediaUrl?: string | null
  publicUrl?: string | null
  storageProvider?: StorageProvider | null
  storageKey?: string | null
  storageBucket?: string | null
  mimeType?: string | null
  title?: string | null
  animation?: 'none' | 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right'
}

export interface ProgramItem {
  id: string
  companyId: string
  displayIds: string[]
  media: TvMedia
  durationSeconds: number
  volume: number
  muted: boolean
  fit: 'contain' | 'cover' | 'fill' | 'blur_background'
  resumeBehavior: 'resume' | 'restart'
  active: boolean
  overlayText?: string | null
  overlayAnimation?: 'none' | 'fade' | 'slide_up' | 'pulse'
  transition?: { type: TvTransitionType; durationMs: number }
  watermark?: {
    enabled: boolean
    name?: string | null
    logoUrl?: string | null
    phone?: string | null
    extraText?: string | null
  }
  soundtrack?: { id: string; title?: string | null; url: string; volume: number; loop: boolean; muteOriginalAudio: boolean } | null
  qrCodeUrl?: string | null
}

export interface Interruption {
  id: string
  companyId: string
  displayId: string
  kind: InterruptionKind
  priority: number
  requestedAt: string
  expiresAt?: string | null
  cancelledAt?: string | null
  durationSeconds: number
  title: string
  subtitle?: string | null
  media?: TvMedia | null
  callValues?: { customer_name?: string | null; order_number?: string | number | null; table_number?: string | number | null; call_text?: string | null; business_name?: string | null }
}

export interface PlaybackSnapshot {
  itemId: string
  itemIndex: number
  elapsedSeconds: number
  remainingSeconds?: number
  savedAt: string
}

export interface PlayerPayload {
  companyId: string
  displayId: string
  items: ProgramItem[]
  interruptions: Interruption[]
  syncedAt: string
}
