import { QRCodeSVG } from "qrcode.react";

export function WatermarkOverlay({
  logoUrl,
  name,
  phone,
  extraText,
  qrEnabled = false,
  qrValue,
  className = "",
}: {
  logoUrl?: string | null;
  name?: string | null;
  phone?: string | null;
  extraText?: string | null;
  qrEnabled?: boolean;
  qrValue?: string | null;
  className?: string;
}) {
  const encodedValue = qrValue?.trim() ?? "";
  const classes = `tv-watermark tv-watermark-bottom${className ? ` ${className}` : ""}`;

  return (
    <div className={classes}>
      {logoUrl ? <img src={logoUrl} alt="" referrerPolicy="no-referrer" /> : null}
      <div className="watermark-copy">
        {name ? <strong>{name}</strong> : null}
        {extraText ? <span>{extraText}</span> : null}
      </div>
      {phone ? <b>{phone}</b> : null}
      {qrEnabled && encodedValue ? (
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
