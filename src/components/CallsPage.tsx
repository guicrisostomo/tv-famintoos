import { BellRing, LoaderCircle, Save, Trash2, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { TvCallRecord } from '../hooks/useTvCalls';
import type { TvDisplayRecord } from '../hooks/useTvData';
import {
  defaultCallSpeechSettings,
  renderCallSpeech,
  speechService,
  type CallSpeechSettings,
} from '../services/speechService';
import { supabase } from '../services/supabase';
import { tvAudioService } from '../services/tvAudioService';

const statusLabel: Record<TvCallRecord['status'], string> = {
  pending: 'Aguardando a TV',
  showing: 'Sendo chamado',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};
export function CallsPage({
  companyId,
  displays,
  calls,
  loading,
  onReload,
}: {
  companyId: string;
  displays: TvDisplayRecord[];
  calls: TvCallRecord[];
  loading: boolean;
  onReload: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [selectedDisplays, setSelectedDisplays] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [settings, setSettings] = useState(defaultCallSpeechSettings);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const displayNames = useMemo(
    () => new Map(displays.map((display) => [display.id, display.name])),
    [displays],
  );
  useEffect(() => {
    void speechService.getAvailableVoices().then(setVoices);
    if (!supabase) return;
    void supabase
      .from('tv_call_templates')
      .select('id,primary_text,volume,duration_seconds,repetitions,layout')
      .eq('company_id', companyId)
      .eq('active', true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setTemplateId(data.id);
        setSettings({
          ...defaultCallSpeechSettings,
          ...(data.layout as Partial<CallSpeechSettings>),
          template: data.primary_text || defaultCallSpeechSettings.template,
          volume: Number(data.volume),
          durationSeconds: data.duration_seconds,
          repetitions: data.repetitions,
        });
      });
  }, [companyId]);
  const phrase = renderCallSpeech(
    settings.template,
    {
      customer_name: name || 'Maria',
      order_number: orderNumber || '42',
      table_number: tableNumber || '8',
      call_text: complement || 'Seu pedido está pronto',
      business_name: 'Nossa empresa',
    },
    settings,
  );
  const toggleDisplay = (id: string) =>
    setSelectedDisplays((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || saving) return;
    const cleanName = name.trim().replace(/\s+/g, ' ');
    if (!cleanName && !orderNumber && !complement.trim()) {
      setError('Informe o nome, número do pedido ou texto da chamada.');
      return;
    }
    if (!selectedDisplays.length) {
      setError('Selecione pelo menos uma TV.');
      return;
    }
    setSaving(true);
    setError(null);
    const values = {
      customer_name: cleanName || null,
      order_number: orderNumber || null,
      table_number: tableNumber || null,
      call_text: complement.trim() || null,
    };
    const rows = selectedDisplays.map((displayId) => ({
      company_id: companyId,
      display_id: displayId,
      customer_name: cleanName || null,
      order_id: /^\d+$/.test(orderNumber) ? Number(orderNumber) : null,
      call_text: complement.trim() || cleanName || `Pedido ${orderNumber}`,
      call_payload: values,
      status: 'pending',
    }));
    const { error: insertError } = await supabase.from('tv_calls').insert(rows);
    if (insertError) setError(insertError.message);
    else {
      setName('');
      setOrderNumber('');
      setTableNumber('');
      setComplement('');
      await onReload();
    }
    setSaving(false);
  };
  const saveSettings = async () => {
    if (!supabase) return;
    setSavingSettings(true);
    setError(null);
    const row = {
      company_id: companyId,
      name: 'Configuração principal',
      primary_text: settings.template,
      volume: settings.volume,
      duration_seconds: settings.durationSeconds,
      repetitions: settings.repetitions,
      layout: settings,
      active: true,
      updated_at: new Date().toISOString(),
    };
    const result = templateId
      ? await supabase
          .from('tv_call_templates')
          .update(row)
          .eq('id', templateId)
          .eq('company_id', companyId)
          .select('id')
          .single()
      : await supabase.from('tv_call_templates').insert(row).select('id').single();
    if (result.error) setError(result.error.message);
    else setTemplateId(result.data.id);
    setSavingSettings(false);
  };
  const test = async () => {
    setError(null);
    try {
      tvAudioService.initializeAudio();
      tvAudioService.setVolume(settings.volume);
      if (settings.bellEnabled) {
        try {
          await tvAudioService.unlockAudio();
        } catch {
          /* the following play reports diagnostics */
        }
        await tvAudioService.playCallSound();
        await new Promise((resolve) => window.setTimeout(resolve, settings.bellDelayMs));
      }
      await speechService.speakCall(
        {
          customer_name: name || 'Maria',
          order_number: orderNumber || '42',
          table_number: tableNumber || '8',
          call_text: complement || 'Seu pedido está pronto',
          business_name: 'Nossa empresa',
        },
        settings,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível testar a chamada.');
    }
  };
  const clearHistory = async () => {
    if (!supabase || !calls.length || !window.confirm('Limpar todo o histórico de chamadas?'))
      return;
    setClearing(true);
    const { data, error: deleteError } = await supabase
      .from('tv_calls')
      .delete()
      .eq('company_id', companyId)
      .select('id');
    if (deleteError || !data?.length)
      setError(deleteError?.message ?? 'A limpeza não foi autorizada.');
    else await onReload();
    setClearing(false);
  };
  const update = <K extends keyof CallSpeechSettings>(key: K, value: CallSpeechSettings[K]) =>
    setSettings((current) => ({ ...current, [key]: value }));
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Chamadas</h1>
          <p>Faça chamadas por nome, pedido, mesa ou mensagem personalizada.</p>
        </div>
      </div>
      <div className="grid-2 calls-layout">
        <section className="card">
          <div className="section-title">
            <h2>Chamar cliente</h2>
            <Volume2 size={19} />
          </div>
          <form className="editor-form" onSubmit={submit}>
            <label>
              Nome da pessoa
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                placeholder="Ex.: Maria da Silva"
                autoFocus
              />
            </label>
            <div className="form-row">
              <label>
                Número do pedido
                <input
                  value={orderNumber}
                  onChange={(event) => setOrderNumber(event.target.value)}
                  placeholder="42"
                />
              </label>
              <label>
                Número da mesa
                <input
                  value={tableNumber}
                  onChange={(event) => setTableNumber(event.target.value)}
                  placeholder="8"
                />
              </label>
            </div>
            <label>
              Mensagem complementar
              <input
                value={complement}
                onChange={(event) => setComplement(event.target.value)}
                placeholder="Seu pedido está pronto"
              />
            </label>
            <fieldset>
              <legend>Exibir nas TVs</legend>
              <div className="check-grid">
                {displays.map((display) => (
                  <label key={display.id}>
                    <input
                      type="checkbox"
                      checked={selectedDisplays.includes(display.id)}
                      onChange={() => toggleDisplay(display.id)}
                    />
                    {display.name}
                  </label>
                ))}
              </div>
            </fieldset>
            {error ? (
              <div className="form-error" role="alert">
                {error}
              </div>
            ) : null}
            <button className="button primary" disabled={saving || !displays.length}>
              {saving ? <LoaderCircle className="spin" size={17} /> : <BellRing size={17} />} Chamar
              agora
            </button>
          </form>
        </section>
        <section className="card call-help">
          <div className="section-title">
            <h2>Pré-visualização</h2>
          </div>
          <div className="call-example">
            <BellRing size={26} />
            <strong>{name || orderNumber || 'Chamada de teste'}</strong>
            <span>“{phrase}”</span>
            <button className="button secondary" type="button" onClick={() => void test()}>
              Testar chamada
            </button>
          </div>
        </section>
      </div>
      <section className="card call-settings">
        <div className="section-title">
          <div>
            <h2>Configuração das chamadas</h2>
            <p>
              Use variáveis como {'{{customer_name}}'}, {'{{order_number}}'}, {'{{table_number}}'},{' '}
              {'{{call_text}}'} e {'{{business_name}}'}.
            </p>
          </div>
          <button
            className="button primary"
            onClick={() => void saveSettings()}
            disabled={savingSettings}
          >
            {savingSettings ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}{' '}
            Salvar
          </button>
        </div>
        <div className="settings-grid">
          <label className="wide">
            Modelo da frase
            <textarea
              rows={3}
              value={settings.template}
              onChange={(event) => update('template', event.target.value)}
            />
          </label>
          <label>
            Voz
            <select
              value={settings.voiceName ?? ''}
              onChange={(event) => update('voiceName', event.target.value || null)}
            >
              <option value="">Português automática</option>
              {voices.map((voice) => (
                <option key={`${voice.name}-${voice.lang}`} value={voice.name}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </label>
          <label>
            Idioma
            <input
              value={settings.language}
              onChange={(event) => update('language', event.target.value)}
            />
          </label>
          <label>
            Velocidade
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={settings.rate}
              onChange={(event) => update('rate', Number(event.target.value))}
            />
            <span>{settings.rate.toFixed(2)}</span>
          </label>
          <label>
            Tom
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.pitch}
              onChange={(event) => update('pitch', Number(event.target.value))}
            />
            <span>{settings.pitch.toFixed(1)}</span>
          </label>
          <label>
            Volume
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.volume}
              onChange={(event) => update('volume', Number(event.target.value))}
            />
          </label>
          <label>
            Repetições
            <input
              type="number"
              min="1"
              max="5"
              value={settings.repetitions}
              onChange={(event) => update('repetitions', Number(event.target.value))}
            />
          </label>
          <label>
            Intervalo entre repetições (ms)
            <input
              type="number"
              min="0"
              max="10000"
              step="100"
              value={settings.repeatIntervalMs}
              onChange={(event) => update('repeatIntervalMs', Number(event.target.value))}
            />
          </label>
          <label>
            Duração total (s)
            <input
              type="number"
              min="3"
              max="60"
              value={settings.durationSeconds}
              onChange={(event) => update('durationSeconds', Number(event.target.value))}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.bellEnabled}
              onChange={(event) => update('bellEnabled', event.target.checked)}
            />{' '}
            Campainha habilitada
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.voiceEnabled}
              onChange={(event) => update('voiceEnabled', event.target.checked)}
            />{' '}
            Voz habilitada
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.speakCustomerName}
              onChange={(event) => update('speakCustomerName', event.target.checked)}
            />{' '}
            Falar nome
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.speakOrderNumber}
              onChange={(event) => update('speakOrderNumber', event.target.checked)}
            />{' '}
            Falar pedido
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.speakComplement}
              onChange={(event) => update('speakComplement', event.target.checked)}
            />{' '}
            Falar mensagem
          </label>
        </div>
      </section>
      {calls.length ? (
        <section className="card call-history">
          <div className="section-title">
            <div>
              <h2>Pessoas chamadas</h2>
              <p>Últimas 100 chamadas desta empresa</p>
            </div>
            <button
              className="button danger"
              onClick={() => void clearHistory()}
              disabled={clearing}
            >
              {clearing ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />} Limpar
              histórico
            </button>
          </div>
          <div className="history-list">
            {calls.map((call) => (
              <article key={call.id} className="history-row">
                <div>
                  <strong>{call.customer_name ?? call.call_text}</strong>
                  <span>
                    {call.display_id
                      ? (displayNames.get(call.display_id) ?? 'TV removida')
                      : 'Todas as TVs'}
                  </span>
                </div>
                <div>
                  <time dateTime={call.requested_at}>
                    {new Intl.DateTimeFormat('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(new Date(call.requested_at))}
                  </time>
                  <span className={`call-status ${call.status}`}>{statusLabel[call.status]}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : loading ? (
        <div className="loading-inline">Carregando chamadas...</div>
      ) : null}
    </>
  );
}
