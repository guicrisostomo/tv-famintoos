alter table public.tv_playlist_items
  add column if not exists watermark_qr_enabled boolean not null default false,
  add column if not exists watermark_qr_value text;

alter table public.tv_playlist_items
  drop constraint if exists tv_playlist_items_watermark_content_check;
alter table public.tv_playlist_items
  add constraint tv_playlist_items_watermark_content_check check (
    char_length(coalesce(watermark_name, '')) <= 80
    and char_length(coalesce(watermark_phone, '')) <= 40
    and char_length(coalesce(watermark_extra_text, '')) <= 160
    and char_length(coalesce(watermark_qr_value, '')) <= 2048
    and (
      not watermark_qr_enabled
      or nullif(btrim(coalesce(watermark_qr_value, '')), '') is not null
    )
    and (
      not watermark_enabled
      or watermark_logo_media_id is not null
      or nullif(btrim(coalesce(watermark_logo_url, '')), '') is not null
      or nullif(btrim(coalesce(watermark_name, '')), '') is not null
      or nullif(btrim(coalesce(watermark_phone, '')), '') is not null
      or nullif(btrim(coalesce(watermark_extra_text, '')), '') is not null
      or (watermark_qr_enabled and nullif(btrim(coalesce(watermark_qr_value, '')), '') is not null)
    )
  );

comment on column public.tv_playlist_items.watermark_qr_enabled is
  'Displays a QR code inside the watermark when a value is configured.';
comment on column public.tv_playlist_items.watermark_qr_value is
  'Text or URL encoded in the watermark QR code.';
