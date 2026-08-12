export type CaptionAnimation = "none" | "fade" | "slide_up" | "pulse";
export type CaptionDisplayStyle = "compact" | "bar" | "ticker";
export type CaptionPosition = "top" | "middle" | "bottom";
export type CaptionFontFamily = "sans" | "display" | "serif" | "mono";
export type CaptionFontSize = "small" | "medium" | "large";

export interface CaptionSettings {
  text: string;
  animation: CaptionAnimation;
  displayStyle: CaptionDisplayStyle;
  position: CaptionPosition;
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  fontFamily: CaptionFontFamily;
  fontSize: CaptionFontSize;
  tickerSpeedSeconds: number;
}

export const defaultCaptionSettings: CaptionSettings = {
  text: "",
  animation: "none",
  displayStyle: "compact",
  position: "bottom",
  textColor: "#ffffff",
  backgroundColor: "#000000",
  backgroundOpacity: 72,
  fontFamily: "display",
  fontSize: "medium",
  tickerSpeedSeconds: 18,
};

export const captionDisplayStyleOptions = [
  { value: "compact", label: "Compacta", description: "Caixa discreta ajustada ao texto." },
  { value: "bar", label: "Faixa completa", description: "Ocupa toda a largura da tela." },
  { value: "ticker", label: "Noticiário", description: "Texto contínuo passando pela tela." },
] as const;

export const captionFontOptions = [
  { value: "sans", label: "Limpa" },
  { value: "display", label: "Destaque" },
  { value: "serif", label: "Clássica" },
  { value: "mono", label: "Digital" },
] as const;

export const captionSizeOptions = [
  { value: "small", label: "Pequena" },
  { value: "medium", label: "Média" },
  { value: "large", label: "Grande" },
] as const;

export interface CaptionRecord {
  caption_text?: string | null;
  caption_animation?: CaptionAnimation;
  caption_display_style?: CaptionDisplayStyle;
  caption_position?: CaptionPosition;
  caption_text_color?: string;
  caption_background_color?: string;
  caption_background_opacity?: number;
  caption_font_family?: CaptionFontFamily;
  caption_font_size?: CaptionFontSize;
  caption_ticker_speed_seconds?: number;
}

export function captionSettingsFromRecord(record: CaptionRecord): CaptionSettings {
  return {
    text: record.caption_text ?? defaultCaptionSettings.text,
    animation: record.caption_animation ?? defaultCaptionSettings.animation,
    displayStyle: record.caption_display_style ?? defaultCaptionSettings.displayStyle,
    position: record.caption_position ?? defaultCaptionSettings.position,
    textColor: record.caption_text_color ?? defaultCaptionSettings.textColor,
    backgroundColor: record.caption_background_color ?? defaultCaptionSettings.backgroundColor,
    backgroundOpacity: record.caption_background_opacity ?? defaultCaptionSettings.backgroundOpacity,
    fontFamily: record.caption_font_family ?? defaultCaptionSettings.fontFamily,
    fontSize: record.caption_font_size ?? defaultCaptionSettings.fontSize,
    tickerSpeedSeconds: record.caption_ticker_speed_seconds ?? defaultCaptionSettings.tickerSpeedSeconds,
  };
}

export function captionDatabaseValues(settings: CaptionSettings, enabled: boolean) {
  return {
    caption_text: enabled ? settings.text.trim() || null : null,
    caption_animation: enabled && settings.displayStyle !== "ticker" ? settings.animation : "none",
    caption_display_style: settings.displayStyle,
    caption_position: settings.position,
    caption_text_color: settings.textColor,
    caption_background_color: settings.backgroundColor,
    caption_background_opacity: settings.backgroundOpacity,
    caption_font_family: settings.fontFamily,
    caption_font_size: settings.fontSize,
    caption_ticker_speed_seconds: settings.tickerSpeedSeconds,
  };
}
