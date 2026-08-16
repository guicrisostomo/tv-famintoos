import { useEffect, useMemo, useState } from 'react'
import type { CaptionPosition } from '../domain/caption'
import type { DisplayPresentationSettings } from '../domain/display'

export function DateTimeOverlay({
  settings,
  captionPosition = null,
  watermarkVisible = false,
}: {
  settings: DisplayPresentationSettings
  captionPosition?: CaptionPosition | null
  watermarkVisible?: boolean
}) {
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
  const position = resolvePosition(settings.dateTimePosition, captionPosition)
  const avoidWatermark = watermarkVisible && position.startsWith('bottom_')
  return (
    <div className={`display-datetime position-${position} theme-${settings.dateTimeTheme}${avoidWatermark ? ' avoid-watermark' : ''}`} aria-label="Data e hora da exibição">
      {settings.showTime ? <time className="display-time" dateTime={now.toISOString()}>{timeFormatter.format(now)}</time> : null}
      {settings.showDate ? <time className="display-date" dateTime={now.toISOString()}>{dateFormatter.format(now)}</time> : null}
    </div>
  )
}

function resolvePosition(
  position: DisplayPresentationSettings['dateTimePosition'],
  captionPosition: CaptionPosition | null,
) {
  if (captionPosition === 'top' && position.startsWith('top_')) {
    return position.replace('top_', 'bottom_') as DisplayPresentationSettings['dateTimePosition']
  }
  if (captionPosition === 'bottom' && position.startsWith('bottom_')) {
    return position.replace('bottom_', 'top_') as DisplayPresentationSettings['dateTimePosition']
  }
  return position
}
