export interface CallSpeechValues {
  customer_name?: string | null
  order_number?: string | number | null
  table_number?: string | number | null
  call_text?: string | null
  business_name?: string | null
}

export interface CallSpeechSettings {
  template: string
  language: string
  voiceName?: string | null
  rate: number
  pitch: number
  volume: number
  repetitions: number
  repeatIntervalMs: number
  voiceEnabled: boolean
  bellEnabled: boolean
  bellDelayMs: number
  speakCustomerName: boolean
  speakOrderNumber: boolean
  speakComplement: boolean
  durationSeconds: number
}

export const defaultCallSpeechSettings: CallSpeechSettings = {
  template: 'Chamando {{customer_name}}. Por favor, compareça ao balcão.',
  language: 'pt-BR', voiceName: null, rate: .85, pitch: 1, volume: 1,
  repetitions: 1, repeatIntervalMs: 1200, voiceEnabled: true, bellEnabled: true,
  bellDelayMs: 500, speakCustomerName: true, speakOrderNumber: true,
  speakComplement: true, durationSeconds: 12,
}

const variables = /{{\s*(customer_name|order_number|table_number|call_text|business_name)\s*}}/g
export function renderCallSpeech(template: string, values: CallSpeechValues, settings: Pick<CallSpeechSettings, 'speakCustomerName' | 'speakOrderNumber' | 'speakComplement'>) {
  const safe = { ...values }
  if (!settings.speakCustomerName) safe.customer_name = ''
  if (!settings.speakOrderNumber) safe.order_number = ''
  if (!settings.speakComplement) safe.call_text = ''
  return template.replace(variables, (_, key: keyof CallSpeechValues) => String(safe[key] ?? '')).replace(/\s+([.,])/g, '$1').replace(/\s{2,}/g, ' ').trim()
}

class SpeechService {
  private voices: SpeechSynthesisVoice[] = []
  private ready: Promise<SpeechSynthesisVoice[]> | null = null
  private volume = 1
  private rate = 1
  private pitch = 1
  private lastError: string | null = null

  initialize() {
    if (this.ready) return this.ready
    this.ready = new Promise(resolve => {
      if (!('speechSynthesis' in window)) { this.lastError = 'Síntese de voz não disponível neste navegador.'; resolve([]); return }
      const load = () => { this.voices = window.speechSynthesis.getVoices(); if (this.voices.length) resolve(this.voices) }
      load(); window.speechSynthesis.addEventListener('voiceschanged', load, { once: true })
      window.setTimeout(() => { load(); resolve(this.voices) }, 1500)
    })
    return this.ready
  }

  async getAvailableVoices() { return this.initialize() }
  async speakCall(values: CallSpeechValues, settings: CallSpeechSettings) {
    if (!settings.voiceEnabled) return
    const voices = await this.initialize()
    if (!('speechSynthesis' in window)) return
    const text = renderCallSpeech(settings.template, values, settings)
    if (!text) return
    this.cancel(); this.lastError = null
    for (let index = 0; index < Math.max(1, settings.repetitions); index += 1) {
      await this.speak(text, settings, voices)
      if (index + 1 < settings.repetitions) await new Promise(resolve => window.setTimeout(resolve, settings.repeatIntervalMs))
    }
  }

  cancel() { if ('speechSynthesis' in window) window.speechSynthesis.cancel() }
  pause() { if ('speechSynthesis' in window) window.speechSynthesis.pause() }
  resume() { if ('speechSynthesis' in window) window.speechSynthesis.resume() }
  setVolume(value: number) { this.volume = Math.max(0, Math.min(1, value)) }
  setRate(value: number) { this.rate = Math.max(.1, Math.min(10, value)) }
  setPitch(value: number) { this.pitch = Math.max(0, Math.min(2, value)) }
  diagnostics() { return { supported: 'speechSynthesis' in window, voiceCount: this.voices.length, lastError: this.lastError } }

  private speak(text: string, settings: CallSpeechSettings, voices: SpeechSynthesisVoice[]) {
    return new Promise<void>(resolve => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = settings.language || 'pt-BR'
      utterance.voice = voices.find(voice => voice.name === settings.voiceName) ?? voices.find(voice => voice.lang.toLowerCase() === utterance.lang.toLowerCase()) ?? voices.find(voice => voice.lang.toLowerCase().startsWith('pt')) ?? null
      utterance.rate = settings.rate * this.rate; utterance.pitch = settings.pitch * this.pitch; utterance.volume = settings.volume * this.volume
      utterance.onend = () => resolve()
      utterance.onerror = event => { this.lastError = event.error || 'Falha ao reproduzir a voz.'; resolve() }
      window.speechSynthesis.speak(utterance)
      window.setTimeout(() => window.speechSynthesis.resume(), 250)
    })
  }
}

export const speechService = new SpeechService()
