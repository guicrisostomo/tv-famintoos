import type { TvPlaylistRecord } from '../hooks/useTvData'

export function isItemScheduledOnDate(item: TvPlaylistRecord, date: Date) {
  const media = item.media
  const dateKey = localDateKey(date)
  if (media.starts_at && dateKey < media.starts_at.slice(0, 10)) return false
  if (media.ends_at && dateKey > media.ends_at.slice(0, 10)) return false
  if (media.weekdays?.length && !media.weekdays.includes(date.getDay())) return false
  return true
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function hasItemSchedule(item: TvPlaylistRecord) {
  const media = item.media
  return Boolean(media.starts_at || media.ends_at || media.start_time || media.end_time || media.weekdays?.length)
}
