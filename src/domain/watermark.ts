export type WatermarkStyle = "full" | "minimal" | "qr_only";

export const watermarkStyleOptions: Array<{
  value: WatermarkStyle;
  label: string;
  description: string;
}> = [
  {
    value: "full",
    label: "Completa",
    description: "Faixa com logo e informações da empresa.",
  },
  {
    value: "minimal",
    label: "Minimalista",
    description: "Assinatura compacta e discreta no canto.",
  },
  {
    value: "qr_only",
    label: "Somente QR Code",
    description: "Mostra apenas o QR Code, sem outros dados.",
  },
];
