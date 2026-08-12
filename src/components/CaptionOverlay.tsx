import type { CSSProperties } from "react";
import type { CaptionSettings } from "../domain/caption";

const FONT_STACKS = {
  sans: "'DM Sans', Arial, sans-serif",
  display: "Manrope, 'DM Sans', Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Courier New', Consolas, monospace",
} as const;

export function CaptionOverlay({
  settings,
  className = "",
}: {
  settings: CaptionSettings;
  className?: string;
}) {
  const caption = settings.text.trim();
  if (!caption) return null;

  const style = {
    "--caption-text-color": normalizeHex(settings.textColor, "#ffffff"),
    "--caption-background": hexToRgba(
      settings.backgroundColor,
      settings.backgroundOpacity,
    ),
    "--caption-font-family": FONT_STACKS[settings.fontFamily],
    "--caption-ticker-duration": `${settings.tickerSpeedSeconds}s`,
  } as CSSProperties;
  const classes = [
    "media-caption",
    `caption-layout-${settings.displayStyle}`,
    `caption-position-${settings.position}`,
    `caption-size-${settings.fontSize}`,
    className,
  ].filter(Boolean).join(" ");

  if (settings.displayStyle === "ticker") {
    return (
      <div className={classes} style={style} aria-label={caption}>
        <div className="caption-ticker-track">
          <span>{caption}</span>
          <span aria-hidden="true">{caption}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={classes} style={style}>
      <span className={`caption-content caption-${settings.animation}`}>
        {caption}
      </span>
    </div>
  );
}

function normalizeHex(value: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function hexToRgba(value: string, opacity: number) {
  const normalized = normalizeHex(value, "#000000").slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(100, opacity)) / 100})`;
}
