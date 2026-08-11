alter table public.tv_playlist_items
  add column if not exists watermark_logo_url text;

alter table public.tv_playlist_items
  drop constraint if exists tv_playlist_items_watermark_logo_url_check;
alter table public.tv_playlist_items
  add constraint tv_playlist_items_watermark_logo_url_check check (
    watermark_logo_url is null
    or (char_length(watermark_logo_url) <= 2048 and watermark_logo_url ~ '^https://')
  );

alter table public.tv_playlist_items
  drop constraint if exists tv_playlist_items_watermark_content_check;
alter table public.tv_playlist_items
  add constraint tv_playlist_items_watermark_content_check check (
    char_length(coalesce(watermark_name, '')) <= 80
    and char_length(coalesce(watermark_phone, '')) <= 40
    and char_length(coalesce(watermark_extra_text, '')) <= 160
    and (
      not watermark_enabled
      or watermark_logo_media_id is not null
      or nullif(btrim(coalesce(watermark_logo_url, '')), '') is not null
      or nullif(btrim(coalesce(watermark_name, '')), '') is not null
      or nullif(btrim(coalesce(watermark_phone, '')), '') is not null
      or nullif(btrim(coalesce(watermark_extra_text, '')), '') is not null
    )
  );

comment on column public.tv_playlist_items.watermark_logo_url is
  'Optional HTTPS logo URL copied from the company profile or entered for this playlist item.';
