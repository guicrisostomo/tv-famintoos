import { useCallback, useState } from 'react'

type DisplayVisibilityScope = 'planner' | 'tv-settings'

function storageKey(companyId: string, scope: DisplayVisibilityScope) {
  return `famintoos:display-visibility:v1:${companyId}:${scope}`
}

function readHiddenDisplays(companyId: string, scope: DisplayVisibilityScope) {
  if (typeof window === 'undefined') return new Set<string>()
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey(companyId, scope)) ?? '[]')
    return new Set<string>(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])
  } catch {
    return new Set<string>()
  }
}

export function useHiddenDisplays(companyId: string, scope: DisplayVisibilityScope) {
  const [hiddenDisplayIds, setHiddenDisplayIds] = useState<Set<string>>(() => readHiddenDisplays(companyId, scope))

  const update = useCallback((change: (current: Set<string>) => Set<string>) => {
    setHiddenDisplayIds((current) => {
      const next = change(current)
      try { window.localStorage.setItem(storageKey(companyId, scope), JSON.stringify([...next])) } catch { /* Preferência opcional. */ }
      return next
    })
  }, [companyId, scope])

  const toggleDisplay = useCallback((displayId: string) => update((current) => {
    const next = new Set(current)
    if (next.has(displayId)) next.delete(displayId)
    else next.add(displayId)
    return next
  }), [update])

  const hideDisplays = useCallback((displayIds: string[]) => update(() => new Set(displayIds)), [update])
  const showAllDisplays = useCallback(() => update(() => new Set()), [update])

  return { hiddenDisplayIds, toggleDisplay, hideDisplays, showAllDisplays }
}
