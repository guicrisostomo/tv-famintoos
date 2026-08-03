export interface TvPlayerDiagnostics {
  approximateResources: string; subscriptionCount: number; timerCount: number; lastError: string | null; lastReconnectAt: string | null; lastMedia: string | null; lastReloadReason: string | null; lastLifecycleEvent: string | null; cachedItems: number; preloadCount: number
}
type Listener = (value: TvPlayerDiagnostics) => void
type MemoryPerformance = Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }

export class TvPlayerRuntime {
  private timers = new Map<number, 'timeout' | 'interval'>(); private listeners = new Set<Listener>(); private state: TvPlayerDiagnostics; private reloadKey: string
  constructor(companyId: string, displayId: string) { this.reloadKey = `famintoos:tv:reload:${companyId}:${displayId}`; this.state = { approximateResources: this.resourceSummary(), subscriptionCount: 0, timerCount: 0, lastError: null, lastReconnectAt: null, lastMedia: null, lastReloadReason: localStorage.getItem(`${this.reloadKey}:reason`), lastLifecycleEvent: null, cachedItems: 0, preloadCount: 0 } }
  timeout(callback: () => void, delay: number) { const id = window.setTimeout(() => { this.timers.delete(id); this.emit(); callback() }, delay); this.timers.set(id, 'timeout'); this.emit(); return id }
  interval(callback: () => void, delay: number) { const id = window.setInterval(callback, delay); this.timers.set(id, 'interval'); this.emit(); return id }
  clear(id?: number) { if (id === undefined) return; const type = this.timers.get(id); if (type === 'interval') window.clearInterval(id); else window.clearTimeout(id); this.timers.delete(id); this.emit() }
  setSubscriptions(count: number) { this.patch({ subscriptionCount: count }) }; setCachedItems(count: number) { this.patch({ cachedItems: count }) }; setPreloadCount(count: number) { this.patch({ preloadCount: count }) }
  error(error: unknown) { this.patch({ lastError: error instanceof Error ? error.message : String(error) }) }; reconnected() { this.patch({ lastReconnectAt: new Date().toISOString(), lastError: null }) }; media(title?: string | null) { this.patch({ lastMedia: title || 'Mídia sem título' }) }; lifecycle(event: string) { this.patch({ lastLifecycleEvent: `${event} · ${new Date().toISOString()}` }) }
  snapshot() { return { ...this.state, approximateResources: this.resourceSummary(), timerCount: this.timers.size } }; subscribe(listener: Listener) { this.listeners.add(listener); listener(this.snapshot()); return () => this.listeners.delete(listener) }
  controlledReload(reason: string) { const now = Date.now(); let history: number[] = []; try { history = JSON.parse(localStorage.getItem(this.reloadKey) ?? '[]') as number[] } catch { /* invalid reload history is discarded */ }; history = history.filter(timestamp => now - timestamp < 3600000); if (history.length >= 2 || (history.at(-1) && now - history.at(-1)! < 600000)) { this.error(`Reload suprimido para evitar loop: ${reason}`); return false }; history.push(now); localStorage.setItem(this.reloadKey, JSON.stringify(history)); localStorage.setItem(`${this.reloadKey}:reason`, reason); this.patch({ lastReloadReason: reason }); window.location.reload(); return true }
  dispose() { for (const [id, type] of this.timers) { if (type === 'interval') window.clearInterval(id); else window.clearTimeout(id) }; this.timers.clear(); this.listeners.clear() }
  private patch(value: Partial<TvPlayerDiagnostics>) { this.state = { ...this.state, ...value }; this.emit() }; private emit() { const value = this.snapshot(); this.listeners.forEach(listener => listener(value)) }
  private resourceSummary() { const memory = (performance as MemoryPerformance).memory; const heap = memory ? `${Math.round(memory.usedJSHeapSize / 1048576)} MB / ${Math.round(memory.jsHeapSizeLimit / 1048576)} MB heap` : 'heap indisponível'; return `${heap} · ${document.querySelectorAll('video,audio,img').length} mídias DOM` }
}
