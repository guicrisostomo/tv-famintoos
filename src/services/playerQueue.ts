import type { Interruption } from '../domain/tv'

const kindWeight = { call: 3, urgent_notice: 2, campaign: 1 } as const

export function selectNextInterruption(queue: Interruption[], now = new Date()): Interruption | null {
  const timestamp = now.getTime()
  const valid = queue.filter((item) => {
    if (item.cancelledAt) return false
    if (item.expiresAt && new Date(item.expiresAt).getTime() <= timestamp) return false
    return new Date(item.requestedAt).getTime() <= timestamp
  })

  valid.sort((a, b) => {
    const kind = kindWeight[b.kind] - kindWeight[a.kind]
    if (kind !== 0) return kind
    const priority = b.priority - a.priority
    if (priority !== 0) return priority
    return new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime()
  })
  return valid[0] ?? null
}
