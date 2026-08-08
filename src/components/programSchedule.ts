import type { TvPlaylistRecord } from '../hooks/useTvData'

export function isItemScheduledOnDate(item: TvPlaylistRecord, date: Date) {
  const media = item.media
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
  if (media.starts_at && new Date(media.starts_at) > dayEnd) return false
  if (media.ends_at && new Date(media.ends_at) < dayStart) return false
  if (media.weekdays?.length && !media.weekdays.includes(date.getDay())) return false
  return true
}

export function hasItemSchedule(item: TvPlaylistRecord) {
  const media = item.media
  return Boolean(media.starts_at || media.ends_at || media.start_time || media.end_time || media.weekdays?.length)
}
