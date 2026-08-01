import type { PlaybackSnapshot, PlayerPayload } from '../domain/tv'

const CACHE_VERSION = 1
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000

function cacheKey(companyId: string, displayId: string, suffix: string) {
  return `famintoos:tv:v${CACHE_VERSION}:${companyId}:${displayId}:${suffix}`
}

export function savePayload(payload: PlayerPayload) {
  localStorage.setItem(cacheKey(payload.companyId, payload.displayId, 'schedule'), JSON.stringify(payload))
}

export function readPayload(companyId: string, displayId: string): PlayerPayload | null {
  try {
    const raw = localStorage.getItem(cacheKey(companyId, displayId, 'schedule'))
    if (!raw) return null
    const parsed = JSON.parse(raw) as PlayerPayload
    const validScope = parsed.companyId === companyId && parsed.displayId === displayId
    const fresh = Date.now() - new Date(parsed.syncedAt).getTime() < MAX_CACHE_AGE_MS
    return validScope && fresh ? parsed : null
  } catch { return null }
}

export function savePlayback(companyId: string, displayId: string, state: PlaybackSnapshot) {
  localStorage.setItem(cacheKey(companyId, displayId, 'playback'), JSON.stringify(state))
}

export function readPlayback(companyId: string, displayId: string): PlaybackSnapshot | null {
  try {
    const raw = localStorage.getItem(cacheKey(companyId, displayId, 'playback'))
    return raw ? JSON.parse(raw) as PlaybackSnapshot : null
  } catch { return null }
}
