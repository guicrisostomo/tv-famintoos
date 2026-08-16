import { useEffect, useMemo, useState } from 'react'
import type { DisplayPresentationSettings } from '../domain/display'

export function DateTimeOverlay({ settings }: { settings: DisplayPresentationSettings }) {
  const [now, setNow] = useState(() => new Date())
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat('pt-BR', {
    timeZone: settings.timeZone,
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }), [settings.timeZone])
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat('pt-BR', {
    timeZone: settings.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: settings.showSeconds ? '2-digit' : undefined,
    hour12: false,
  }), [settings.showSeconds, settings.timeZone])

  useEffect(() => {
    if (!settings.dateTimeEnabled) return
    const interval = window.setInterval(() => setNow(new Date()), settings.showSeconds ? 1_000 : 15_000)
    return () => window.clearInterval(interval)
  }, [settings.dateTimeEnabled, settings.showSeconds])

  if (!settings.dateTimeEnabled) return null
  return (
    <div className={`display-datetime position-${settings.dateTimePosition} theme-${settings.dateTimeTheme}`} aria-label="Data e hora da exibição">
      {settings.showTime ? <time className="display-time" dateTime={now.toISOString()}>{timeFormatter.format(now)}</time> : null}
      {settings.showDate ? <time className="display-date" dateTime={now.toISOString()}>{dateFormatter.format(now)}</time> : null}
    </div>
  )
}
