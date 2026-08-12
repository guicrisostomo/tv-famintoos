import { Check } from "lucide-react";
import {
  captionDisplayStyleOptions,
  captionFontOptions,
  captionSizeOptions,
  type CaptionSettings,
} from "../domain/caption";

export function CaptionSettingsFields({
  value,
  onChange,
}: {
  value: CaptionSettings;
  onChange: (value: CaptionSettings) => void;
}) {
  const update = (partial: Partial<CaptionSettings>) =>
    onChange({ ...value, ...partial });
  const disabled = !value.text.trim();

  return (
    <div className="caption-editor">
      <label className="caption-text-field">
        Legenda opcional
        <textarea
          value={value.text}
          onChange={(event) => update({ text: event.target.value })}
          maxLength={500}
          rows={2}
          placeholder="Ex.: Promoção válida até domingo"
        />
        <small>{value.text.length}/500 caracteres</small>
      </label>

      <fieldset disabled={disabled} className="caption-style-fieldset">
        <legend>Formato da legenda</legend>
        <div className="caption-style-options">
          {captionDisplayStyleOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={value.displayStyle === option.value ? "selected" : ""}
              aria-pressed={value.displayStyle === option.value}
              onClick={() => update({ displayStyle: option.value })}
            >
              <span className={`caption-style-swatch caption-style-swatch-${option.value}`} aria-hidden="true"><i /></span>
              <span><strong>{option.label}</strong><small>{option.description}</small></span>
              {value.displayStyle === option.value ? <Check size={15} /> : null}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="caption-controls-grid">
        <label>
          Posição
          <select
            disabled={disabled}
            value={value.position}
            onChange={(event) => update({ position: event.target.value as CaptionSettings["position"] })}
          >
            <option value="top">Parte superior</option>
            <option value="middle">Centro da tela</option>
            <option value="bottom">Parte inferior</option>
          </select>
        </label>
        <label>
          Fonte
          <select
            disabled={disabled}
            value={value.fontFamily}
            onChange={(event) => update({ fontFamily: event.target.value as CaptionSettings["fontFamily"] })}
          >
            {captionFontOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          Tamanho
          <select
            disabled={disabled}
            value={value.fontSize}
            onChange={(event) => update({ fontSize: event.target.value as CaptionSettings["fontSize"] })}
          >
            {captionSizeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          Animação de entrada
          <select
            disabled={disabled || value.displayStyle === "ticker"}
            value={value.animation}
            onChange={(event) => update({ animation: event.target.value as CaptionSettings["animation"] })}
          >
            <option value="none">Sem animação</option>
            <option value="fade">Aparecer suavemente</option>
            <option value="slide_up">Subir suavemente</option>
            <option value="pulse">Destaque pulsante</option>
          </select>
        </label>
      </div>

      <div className="caption-color-controls">
        <label>Cor do texto<input disabled={disabled} type="color" value={value.textColor} onChange={(event) => update({ textColor: event.target.value })} /></label>
        <label>Cor do fundo<input disabled={disabled} type="color" value={value.backgroundColor} onChange={(event) => update({ backgroundColor: event.target.value })} /></label>
        <label className="caption-opacity-control">
          <span>Transparência do fundo <b>{value.backgroundOpacity}%</b></span>
          <input disabled={disabled} type="range" min={0} max={100} step={5} value={value.backgroundOpacity} onChange={(event) => update({ backgroundOpacity: Number(event.target.value) })} />
        </label>
      </div>

      {value.displayStyle === "ticker" ? (
        <label className="caption-ticker-speed">
          <span>Velocidade do letreiro <b>{value.tickerSpeedSeconds}s por volta</b></span>
          <input disabled={disabled} type="range" min={6} max={60} step={1} value={value.tickerSpeedSeconds} onChange={(event) => update({ tickerSpeedSeconds: Number(event.target.value) })} />
          <small><span>Mais rápido</span><span>Mais lento</span></small>
        </label>
      ) : null}
    </div>
  );
}
