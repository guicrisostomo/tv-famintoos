import { useEffect, useState } from "react";
import { Play, Sparkles } from "lucide-react";
import type { TvImageFit, TvMediaRecord, TvTransitionType } from "../hooks/useTvData";
import { supabase } from "../services/supabase";

export interface PresentationSettings {
  transitionType: TvTransitionType;
  transitionDurationMs: number;
  watermarkEnabled: boolean;
  watermarkName: string;
  watermarkLogoMediaId: string | null;
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

  const logo = logos.find((item) => item.id === value.watermarkLogoMediaId);
  const logoUrl = logo?.public_url ?? logo?.media_url;
  const update = (partial: Partial<PresentationSettings>) =>
    onChange({ ...value, ...partial });

  return (
    <fieldset className="presentation-editor">
      <legend><Sparkles size={17} /> Apresentação profissional</legend>
      <div className="presentation-controls">
        <label>
          Transição ao entrar
          <select
            value={value.transitionType}
            onChange={(event) => update({ transitionType: event.target.value as TvTransitionType })}
          >
            <option value="fade">Dissolver suavemente</option>
            <option value="slide_left">Deslizar pela direita</option>
            <option value="slide_up">Subir suavemente</option>
            <option value="zoom">Zoom cinematográfico</option>
            <option value="wipe">Revelação lateral</option>
            <option value="none">Sem transição</option>
          </select>
        </label>
        <label>
          Velocidade · {(value.transitionDurationMs / 1000).toFixed(1)} s
          <input
            type="range"
            min={200}
            max={2500}
            step={100}
            disabled={value.transitionType === "none"}
            value={value.transitionDurationMs}
            onChange={(event) => update({ transitionDurationMs: Number(event.target.value) })}
          />
        </label>
      </div>

      <div className="presentation-preview-shell">
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
        <button type="button" className="button secondary" onClick={() => setPreviewRun((run) => run + 1)}>
          <Play size={15} /> Reproduzir transição
        </button>
      </div>

      <label className="watermark-toggle">
        <input
          type="checkbox"
          checked={value.watermarkEnabled}
          onChange={(event) => update({ watermarkEnabled: event.target.checked })}
        />
        <span><strong>Exibir marca d'água na parte inferior</strong><small>Uma assinatura discreta sobre este conteúdo.</small></span>
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
          <label>
            Logo da biblioteca
            <select value={value.watermarkLogoMediaId ?? ""} onChange={(event) => update({ watermarkLogoMediaId: event.target.value || null })}>
              <option value="">Sem logo</option>
              {logos.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          <label>
            Informação complementar
            <input maxLength={160} value={value.watermarkExtraText} onChange={(event) => update({ watermarkExtraText: event.target.value })} placeholder="Site, endereço, slogan ou rede social" />
          </label>
        </div>
      ) : null}
    </fieldset>
  );
}
