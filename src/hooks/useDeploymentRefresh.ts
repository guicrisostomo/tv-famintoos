import { useEffect, useEffectEvent } from 'react'

const CHECK_INTERVAL_MS = 30_000

function assetSignature(root: ParentNode) {
  return Array.from(root.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src], link[rel="stylesheet"][href]'))
    .map(element => element instanceof HTMLScriptElement ? element.src : element.href)
    .map(value => new URL(value, window.location.origin).pathname)
    .filter(pathname => pathname.includes('/assets/'))
    .sort()
    .join('|')
}

type TimerManager = { interval: (callback: () => void, delay: number) => number; clear: (id?: number) => void }

export function useDeploymentRefresh(onUpdate: () => void, timers?: TimerManager) {
  const handleUpdate = useEffectEvent(onUpdate)

  useEffect(() => {
    const currentSignature = assetSignature(document)
    if (!currentSignature || import.meta.env.DEV) return
    let checking = false

    const check = async () => {
      if (checking || !navigator.onLine) return
      checking = true
      try {
        const response = await fetch(`/index.html?tv-update-check=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
        if (!response.ok) return
        const nextDocument = new DOMParser().parseFromString(await response.text(), 'text/html')
        const nextSignature = assetSignature(nextDocument)
        if (nextSignature && nextSignature !== currentSignature) handleUpdate()
      } catch { /* the next interval retries after transient network failures */ }
      finally { checking = false }
    }

    const interval = timers?.interval(() => void check(), CHECK_INTERVAL_MS) ?? window.setInterval(() => void check(), CHECK_INTERVAL_MS)
    const handleOnline = () => void check()
    window.addEventListener('online', handleOnline)
    return () => { if (timers) timers.clear(interval); else window.clearInterval(interval); window.removeEventListener('online', handleOnline) }
  }, [timers])
}
