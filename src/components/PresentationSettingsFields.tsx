import { useEffect, useState } from "react";
import { Check, Play, Sparkles } from "lucide-react";
import type { TvImageFit, TvMediaRecord, TvTransitionType } from "../hooks/useTvData";
import { supabase } from "../services/supabase";
import { transitionOptions } from "./presentationOptions";

export interface PresentationSettings {
  transitionType: TvTransitionType;
  transitionDurationMs: number;
  watermarkEnabled: boolean;
  watermarkName: string;
  watermarkLogoMediaId: string | null;
  watermarkLogoUrl: string;
  watermarkPhone: string;
  watermarkExtraText: string;
}

interface PresentationPreview {
  type: "message" | "image" | "video";
  url?: string | null;
  message?: string;
  fit?: TvImageFit;
}

export function PresentationSettingsFields({
  companyId,
  value,
  onChange,
  preview,
}: {
  companyId: string;
  value: PresentationSettings;
  onChange: (value: PresentationSettings) => void;
  preview: PresentationPreview;
}) {
  const [logos, setLogos] = useState<TvMediaRecord[]>([]);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [previewRun, setPreviewRun] = useState(0);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase
      .from("tv_media")
      .select("id,title,media_type,media_url,message_text,duration_seconds,public_url,storage_provider")
      .eq("company_id", companyId)
      .eq("media_type", "image")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setLogoError(`Não foi possível carregar os logos: ${error.message}`);
          return;
        }
        setLogoError(null);
        setLogos((data ?? []) as TvMediaRecord[]);
      });
    return () => {
      active = false;
    };
  }, [companyId]);

  const selectedLogo = logos.find((item) => item.id === value.watermarkLogoMediaId);
  const logoUrl = selectedLogo?.public_url ?? selectedLogo?.media_url ?? value.watermarkLogoUrl;
  const update = (partial: Partial<PresentationSettings>) =>
    onChange({ ...value, ...partial });
  const selectTransition = (transitionType: TvTransitionType) => {
    update({ transitionType });
    setPreviewRun((run) => run + 1);
  };

  return (
    <div className="presentation-workspace">
      <div className="presentation-settings-column">
        <section className="presentation-panel" aria-labelledby="transition-heading">
          <div className="presentation-section-heading">
            <span><Sparkles size={18} /></span>
            <div>
              <h3 id="transition-heading">Animação entre conteúdos</h3>
              <p>Escolha como este conteúdo aparece depois do item anterior.</p>
            </div>
          </div>
          <div className="transition-option-grid">
            {transitionOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={value.transitionType === option.value}
                className={value.transitionType === option.value ? "selected" : ""}
                onClick={() => selectTransition(option.value)}
              >
                <span className={`transition-swatch transition-swatch-${option.value}`} aria-hidden="true"><i /></span>
                <span><strong>{option.label}</strong><small>{option.description}</small></span>
                {value.transitionType === option.value ? <Check className="transition-selected-icon" size={17} /> : null}
              </button>
            ))}
          </div>
          <label className="transition-speed-control">
            <span><strong>Duração da transição</strong><b>{(value.transitionDurationMs / 1000).toFixed(1)} s</b></span>
            <input
              type="range"
              min={200}
              max={2500}
              step={100}
              disabled={value.transitionType === "none"}
              value={value.transitionDurationMs}
              onChange={(event) => update({ transitionDurationMs: Number(event.target.value) })}
            />
            <small><span>Mais rápida</span><span>Mais suave</span></small>
          </label>
        </section>

        <section className="presentation-panel" aria-labelledby="watermark-heading">
          <div className="presentation-section-heading">
            <span className="watermark-heading-icon">Aa</span>
            <div>
              <h3 id="watermark-heading">Marca d'água inferior</h3>
              <p>Identifique sua empresa sem esconder o conteúdo principal.</p>
            </div>
          </div>
          <label className="watermark-toggle">
            <input
              type="checkbox"
              checked={value.watermarkEnabled}
              onChange={(event) => update({ watermarkEnabled: event.target.checked })}
            />
            <span><strong>Exibir marca d'água neste conteúdo</strong><small>Você pode usar apenas os dados que desejar.</small></span>
          </label>
          {value.watermarkEnabled ? (
            <div className="watermark-fields">
              {logoError ? <div className="form-error watermark-error" role="alert">{logoError}</div> : null}
              <label>
                Nome ou marca
                <input maxLength={80} value={value.watermarkName} onChange={(event) => update({ watermarkName: event.target.value })} placeholder="Ex.: Famintoos" />
              </label>
              <label>
                Telefone / WhatsApp
                <input maxLength={40} value={value.watermarkPhone} onChange={(event) => update({ watermarkPhone: event.target.value })} placeholder="Ex.: (11) 99999-9999" />
              </label>
              <label className="watermark-extra-field">
                Informação complementar
                <input maxLength={160} value={value.watermarkExtraText} onChange={(event) => update({ watermarkExtraText: event.target.value })} placeholder="Site, endereço, slogan ou rede social" />
              </label>
              <fieldset className="logo-picker">
                <legend>Logo da biblioteca</legend>
                <div className="logo-picker-grid">
                  <button
                    type="button"
                    className={!value.watermarkLogoMediaId && !value.watermarkLogoUrl ? "selected" : ""}
                    onClick={() => update({ watermarkLogoMediaId: null, watermarkLogoUrl: "" })}
                  >
                    <span className="logo-empty">Sem logo</span>
                    {!value.watermarkLogoMediaId && !value.watermarkLogoUrl ? <Check size={15} /> : null}
                  </button>
                  {logos.map((item) => {
                    const imageUrl = item.public_url ?? item.media_url;
                    const selected = value.watermarkLogoMediaId === item.id;
                    return (
                      <button key={item.id} type="button" className={selected ? "selected" : ""} onClick={() => update({ watermarkLogoMediaId: item.id, watermarkLogoUrl: "" })}>
                        {imageUrl ? <img src={imageUrl} alt="" /> : <span className="logo-empty">Sem prévia</span>}
                        <small>{item.title}</small>
                        {selected ? <Check size={15} /> : null}
                      </button>
                    );
                  })}
                </div>
                <label className="logo-url-field">
                  Ou use uma URL HTTPS
                  <input
                    type="url"
                    maxLength={2048}
                    value={value.watermarkLogoUrl}
                    onChange={(event) => update({ watermarkLogoMediaId: null, watermarkLogoUrl: event.target.value })}
                    placeholder="https://site.com/logo.png"
                  />
                </label>
                {!logos.length && !logoError ? <p className="form-hint">Envie uma imagem para a biblioteca caso queira utilizar um logo.</p> : null}
              </fieldset>
            </div>
          ) : null}
        </section>
      </div>

      <aside className="presentation-preview-column" aria-label="Prévia da aparência">
        <div className="presentation-preview-heading"><strong>Prévia na TV</strong><span>Formato 16:9</span></div>
        <div
          key={`${value.transitionType}-${value.transitionDurationMs}-${previewRun}`}
          className={`presentation-preview transition-preview-${value.transitionType}`}
          style={{ "--transition-duration": `${value.transitionDurationMs}ms` } as React.CSSProperties}
        >
          {preview.type === "image" && preview.url ? (
            <img className={`image-fit-${preview.fit ?? "contain"}`} src={preview.url} alt="Prévia do conteúdo" />
          ) : preview.type === "video" && preview.url ? (
            <video src={preview.url} preload="metadata" muted playsInline />
          ) : (
            <div className="presentation-preview-message">{preview.message || "Seu conteúdo"}</div>
          )}
          {value.watermarkEnabled ? (
            <div className="tv-watermark preview-watermark">
              {logoUrl ? <img src={logoUrl} alt="" /> : null}
              <div>
                {value.watermarkName ? <strong>{value.watermarkName}</strong> : null}
                {value.watermarkExtraText ? <span>{value.watermarkExtraText}</span> : null}
              </div>
              {value.watermarkPhone ? <b>{value.watermarkPhone}</b> : null}
            </div>
          ) : null}
        </div>
        <button type="button" className="button secondary presentation-replay" onClick={() => setPreviewRun((run) => run + 1)}>
          <Play size={15} /> Reproduzir novamente
        </button>
        <p className="presentation-preview-help">A prévia mostra a entrada do conteúdo e a posição final da marca d'água.</p>
      </aside>
    </div>
  );
}
