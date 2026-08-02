-- Inserts through the Data API need access to the sequence behind the bigint ID.
-- Row access remains restricted by the existing RLS policies on the table.
grant usage, select on sequence public.r2_media_assets_id_seq to authenticated;

revoke all on sequence public.r2_media_assets_id_seq from anon;
