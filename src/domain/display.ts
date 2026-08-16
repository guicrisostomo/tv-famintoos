export type TvDisplayMode = 'tv' | 'led'
export type TvDateTimePosition = 'top_left' | 'top_center' | 'top_right' | 'bottom_left' | 'bottom_center' | 'bottom_right'
export type TvDateTimeTheme = 'dark' | 'light' | 'brand' | 'minimal'

export interface DisplayPresentationSettings {
  mode: TvDisplayMode
  width: number
  height: number
  dateTimeEnabled: boolean
  showDate: boolean
  showTime: boolean
  showSeconds: boolean
  dateTimePosition: TvDateTimePosition
  dateTimeTheme: TvDateTimeTheme
  timeZone: string
}

export const defaultDisplayPresentation: DisplayPresentationSettings = {
  mode: 'tv',
  width: 1920,
  height: 1080,
  dateTimeEnabled: false,
  showDate: true,
  showTime: true,
  showSeconds: false,
  dateTimePosition: 'top_right',
  dateTimeTheme: 'dark',
  timeZone: 'America/Sao_Paulo',
}

const displayCacheKey = (displayId: string) => `famintoos-tv:display-settings:v1:${displayId}`

export function normalizeDisplayPresentation(value: Partial<DisplayPresentationSettings>): DisplayPresentationSettings {
  const width = Math.round(Number(value.width))
  const height = Math.round(Number(value.height))
  return {
    mode: value.mode === 'led' ? 'led' : 'tv',
    width: Number.isFinite(width) ? Math.max(64, Math.min(16384, width)) : 1920,
    height: Number.isFinite(height) ? Math.max(64, Math.min(16384, height)) : 1080,
    dateTimeEnabled: Boolean(value.dateTimeEnabled),
    showDate: value.showDate !== false,
    showTime: value.showTime !== false,
    showSeconds: Boolean(value.showSeconds),
    dateTimePosition: isDateTimePosition(value.dateTimePosition) ? value.dateTimePosition : 'top_right',
    dateTimeTheme: isDateTimeTheme(value.dateTimeTheme) ? value.dateTimeTheme : 'dark',
    timeZone: validTimeZone(value.timeZone),
  }
}

export function readDisplayPresentation(displayId: string) {
  try {
    const cached = window.localStorage.getItem(displayCacheKey(displayId))
    return cached ? normalizeDisplayPresentation(JSON.parse(cached) as Partial<DisplayPresentationSettings>) : defaultDisplayPresentation
  } catch {
    return defaultDisplayPresentation
  }
}

export function saveDisplayPresentation(displayId: string, settings: DisplayPresentationSettings) {
  try { window.localStorage.setItem(displayCacheKey(displayId), JSON.stringify(settings)) } catch { /* cache opcional */ }
}

export function displayPresentationEqual(left: DisplayPresentationSettings, right: DisplayPresentationSettings) {
  return left.mode === right.mode && left.width === right.width && left.height === right.height &&
    left.dateTimeEnabled === right.dateTimeEnabled && left.showDate === right.showDate &&
    left.showTime === right.showTime && left.showSeconds === right.showSeconds &&
    left.dateTimePosition === right.dateTimePosition && left.dateTimeTheme === right.dateTimeTheme &&
    left.timeZone === right.timeZone
}

function isDateTimePosition(value: unknown): value is TvDateTimePosition {
  return ['top_left', 'top_center', 'top_right', 'bottom_left', 'bottom_center', 'bottom_right'].includes(String(value))
}

function isDateTimeTheme(value: unknown): value is TvDateTimeTheme {
  return ['dark', 'light', 'brand', 'minimal'].includes(String(value))
}

function validTimeZone(value: unknown) {
  const timeZone = typeof value === 'string' && value ? value : 'America/Sao_Paulo'
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone }).format()
    return timeZone
  } catch {
    return 'America/Sao_Paulo'
  }
}
