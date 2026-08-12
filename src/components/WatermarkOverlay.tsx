import { QRCodeSVG } from "qrcode.react";
import type { WatermarkStyle } from "../domain/watermark";

export function WatermarkOverlay({
  logoUrl,
  name,
  phone,
  extraText,
  qrEnabled = false,
  qrValue,
  style = "full",
  className = "",
}: {
  logoUrl?: string | null;
  name?: string | null;
  phone?: string | null;
  extraText?: string | null;
  qrEnabled?: boolean;
  qrValue?: string | null;
  style?: WatermarkStyle;
  className?: string;
}) {
  const encodedValue = qrValue?.trim() ?? "";
  const qrOnly = style === "qr_only";
  const classes = `tv-watermark tv-watermark-bottom watermark-style-${style}${className ? ` ${className}` : ""}`;

  return (
    <div className={classes}>
      {!qrOnly && logoUrl ? <img src={logoUrl} alt="" referrerPolicy="no-referrer" /> : null}
      {!qrOnly && (name || extraText) ? (
        <div className="watermark-copy">
          {name ? <strong>{name}</strong> : null}
          {extraText ? <span>{extraText}</span> : null}
        </div>
      ) : null}
      {!qrOnly && phone ? <b>{phone}</b> : null}
      {(qrOnly || qrEnabled) && encodedValue ? (
        <div className="watermark-qr" aria-label="QR Code da marca d'água">
          <QRCodeSVG
            value={encodedValue}
            level="M"
            marginSize={1}
            title="QR Code da marca d'água"
          />
          <small>Aponte a câmera</small>
        </div>
      ) : null}
    </div>
  );
}
