import type { TvTransitionType } from "../hooks/useTvData";

export const transitionOptions: Array<{
  value: TvTransitionType;
  label: string;
  description: string;
}> = [
  { value: "fade", label: "Dissolver", description: "Entrada suave e elegante" },
  { value: "slide_left", label: "Deslizar", description: "Entra pela lateral direita" },
  { value: "slide_up", label: "Subir", description: "Movimento vertical discreto" },
  { value: "zoom", label: "Zoom", description: "Aproximação cinematográfica" },
  { value: "wipe", label: "Revelar", description: "Abertura lateral dinâmica" },
  { value: "none", label: "Sem efeito", description: "Troca imediata de conteúdo" },
];
