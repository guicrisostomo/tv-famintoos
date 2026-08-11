import type { TvPlaylistRecord } from "../hooks/useTvData";

export interface WatermarkTemplate {
  id: string;
  label: string;
  sourceCount: number;
  watermarkName: string;
  watermarkLogoMediaId: string | null;
  watermarkLogoUrl: string;
  watermarkPhone: string;
  watermarkExtraText: string;
}

export function buildWatermarkTemplates(items: TvPlaylistRecord[]): WatermarkTemplate[] {
  const templates = new Map<
    string,
    { template: Omit<WatermarkTemplate, "id" | "label" | "sourceCount">; sources: Map<string, string> }
  >();
  for (const item of items) {
    if (!item.watermark_enabled) continue;
    const template = {
      watermarkName: item.watermark_name ?? "",
      watermarkLogoMediaId: item.watermark_logo_media_id ?? null,
      watermarkLogoUrl:
        item.watermark_logo?.public_url ??
        item.watermark_logo?.media_url ??
        item.watermark_logo_url ??
        "",
      watermarkPhone: item.watermark_phone ?? "",
      watermarkExtraText: item.watermark_extra_text ?? "",
    };
    const signature = JSON.stringify(template);
    const existing = templates.get(signature);
    if (existing) existing.sources.set(item.media_id, item.media.title);
    else templates.set(signature, { template, sources: new Map([[item.media_id, item.media.title]]) });
  }
  return Array.from(templates, ([id, entry]) => {
    const titles = Array.from(entry.sources.values());
    return {
      id,
      ...entry.template,
      sourceCount: titles.length,
      label: titles.length > 1 ? `${titles[0]} e mais ${titles.length - 1}` : titles[0],
    };
  }).sort((left, right) => right.sourceCount - left.sourceCount || left.label.localeCompare(right.label, "pt-BR"));
}
