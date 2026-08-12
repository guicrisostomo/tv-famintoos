alter table public.tv_playlist_items
  add column if not exists watermark_style text not null default 'full';

alter table public.tv_playlist_items
  drop constraint if exists tv_playlist_items_watermark_style_check;

alter table public.tv_playlist_items
  add constraint tv_playlist_items_watermark_style_check
  check (watermark_style in ('full', 'minimal', 'qr_only'));

comment on column public.tv_playlist_items.watermark_style is
  'Visual da marca d agua: faixa completa, assinatura minimalista ou somente QR Code.';
