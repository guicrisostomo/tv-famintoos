import { useEffect, useState } from "react";
import { Check, Copy, LoaderCircle, Play, QrCode, Sparkles, Upload } from "lucide-react";
import type { TvImageFit, TvMediaRecord, TvTransitionType } from "../hooks/useTvData";
import { supabase } from "../services/supabase";
import { uploadWatermarkLogo } from "../services/watermarkLogo";
import { R2LogoPicker } from "./R2LogoPicker";
import { transitionOptions } from "./presentationOptions";
import { WatermarkOverlay } from "./WatermarkOverlay";
import type { WatermarkTemplate } from "./watermarkTemplates";

export interface PresentationSettings {
  transitionType: TvTransitionType;
  transitionDurationMs: number;
  watermarkEnabled: boolean;
  watermarkName: string;
  watermarkLogoMediaId: string | null;
  watermarkLogoUrl: string;
  watermarkPhone: string;
  watermarkExtraText: string;
  watermarkQrEnabled: boolean;
  watermarkQrValue: string;
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
  watermarkTemplates = [],
}: {
  companyId: string;
  value: PresentationSettings;
  onChange: (value: PresentationSettings) => void;
  preview: PresentationPreview;
  watermarkTemplates?: WatermarkTemplate[];
}) {
  const [logos, setLogos] = useState<TvMediaRecord[]>([]);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [previewRun, setPreviewRun] = useState(0);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase
      .from("tv_media")
      .select("id,title,media_type,media_url,message_text,duration_seconds,public_url,storage_provider,storage_key,file_size,r2_asset_id,created_at")
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
  const uploadLogo = async (file: File | null) => {
    if (!file) return;
    setUploadingLogo(true);
    setLogoError(null);
    try {
      const logo = await uploadWatermarkLogo(companyId, file);
      setLogos((current) => [logo, ...current.filter((item) => item.id !== logo.id)]);
      update({ watermarkLogoMediaId: logo.id, watermarkLogoUrl: "" });
    } catch (caught) {
      setLogoError(caught instanceof Error ? caught.message : "Não foi possível enviar o logo.");
    } finally {
      setUploadingLogo(false);
    }
  };
  const reuseWatermark = (templateId: string) => {
    const template = watermarkTemplates.find((item) => item.id === templateId);
    if (!template) return;
    const matchingLogo = logos.find((logo) =>
      logo.id === template.watermarkLogoMediaId ||
      Boolean(template.watermarkLogoUrl && (logo.public_url === template.watermarkLogoUrl || logo.media_url === template.watermarkLogoUrl)),
    );
    update({
      watermarkEnabled: true,
      watermarkName: template.watermarkName,
      watermarkLogoMediaId: matchingLogo?.id ?? template.watermarkLogoMediaId,
      watermarkLogoUrl: matchingLogo ? matchingLogo.public_url ?? matchingLogo.media_url ?? template.watermarkLogoUrl : template.watermarkLogoUrl,
      watermarkPhone: template.watermarkPhone,
      watermarkExtraText: template.watermarkExtraText,
      watermarkQrEnabled: template.watermarkQrEnabled,
      watermarkQrValue: template.watermarkQrValue,
    });
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
              <h3 id="watermark-heading">Marca d'água superior</h3>
              <p>Identifique sua empresa sem esconder o conteúdo principal.</p>
            </div>
          </div>
          {watermarkTemplates.length ? (
            <div className="watermark-reuse-card">
              <span className="watermark-reuse-icon"><Copy size={17} /></span>
              <label>
                Copiar marca d'água de outro conteúdo
                <select value="" onChange={(event) => reuseWatermark(event.target.value)}>
                  <option value="">Selecione uma configuração existente</option>
                  {watermarkTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.label}{template.sourceCount > 1 ? ` · usada em ${template.sourceCount} conteúdos` : ""}
                    </option>
                  ))}
                </select>
                <small>Ao selecionar, a marca será ativada e você ainda poderá editar os dados.</small>
              </label>
            </div>
          ) : null}
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
              <div className="watermark-qr-settings">
                <label className="watermark-toggle watermark-qr-toggle">
                  <input
                    type="checkbox"
                    checked={value.watermarkQrEnabled}
                    onChange={(event) => update({ watermarkQrEnabled: event.target.checked })}
                  />
                  <span><QrCode size={18} /><strong>Adicionar QR Code</strong><small>O código será exibido dentro da marca d'água.</small></span>
                </label>
                {value.watermarkQrEnabled ? (
                  <label>
                    Conteúdo do QR Code
                    <input
                      type="text"
                      maxLength={2048}
                      value={value.watermarkQrValue}
                      onChange={(event) => update({ watermarkQrValue: event.target.value })}
                      placeholder="https://seusite.com/cardapio"
                    />
                    <small>Informe um site, cardápio, WhatsApp, PIX ou outro texto. A prévia é gerada automaticamente.</small>
                  </label>
                ) : null}
              </div>
              <fieldset className="logo-picker">
                <legend>Logo</legend>
                <div className="logo-upload-row">
                  <label className="button secondary file-button">
                    {uploadingLogo ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}
                    {uploadingLogo ? "Enviando logo..." : "Enviar uma nova imagem"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={uploadingLogo}
                      onChange={(event) => {
                        const input = event.currentTarget;
                        void uploadLogo(input.files?.[0] ?? null).finally(() => { input.value = ""; });
                      }}
                    />
                  </label>
                  <small>JPG, PNG ou WebP, até 10 MB. A imagem será salva no R2 da empresa.</small>
                </div>
                <R2LogoPicker
                  companyId={companyId}
                  onSelected={(logo) => {
                    setLogos((current) => [logo, ...current.filter((item) => item.id !== logo.id)]);
                    update({ watermarkLogoMediaId: logo.id, watermarkLogoUrl: logo.public_url ?? logo.media_url ?? "" });
                  }}
                />
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
                  <small>A imagem da URL será copiada para o R2 ao salvar, evitando bloqueios na TV.</small>
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
          className={`presentation-preview transition-preview-${value.transitionType}${value.watermarkEnabled ? " has-watermark" : ""}${value.watermarkEnabled && value.watermarkQrEnabled && value.watermarkQrValue.trim() ? " has-watermark-qr" : ""}`}
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
            <WatermarkOverlay
              className="preview-watermark"
              logoUrl={logoUrl}
              name={value.watermarkName}
              extraText={value.watermarkExtraText}
              phone={value.watermarkPhone}
              qrEnabled={value.watermarkQrEnabled}
              qrValue={value.watermarkQrValue}
            />
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
