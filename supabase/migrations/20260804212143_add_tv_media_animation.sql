alter table public.tv_media add column if not exists animation text not null default 'none';
alter table public.tv_media drop constraint if exists tv_media_animation_check;
alter table public.tv_media add constraint tv_media_animation_check check (animation in ('none', 'zoom_in', 'zoom_out', 'pan_left', 'pan_right'));
comment on column public.tv_media.animation is 'Optional image motion shown by TV players. Videos and messages use none.';

create or replace function public.get_tv_player_payload(p_company_id text, p_display_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'companyId', p_company_id, 'displayId', p_display_id::text, 'syncedAt', now(),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'companyId', i.company_id, 'displayIds', i.display_ids,
        'durationSeconds', i.duration_seconds, 'volume', i.volume, 'muted', i.muted,
        'fit', i.image_fit, 'resumeBehavior', i.resume_behavior, 'active', i.active,
        'overlayText', i.overlay ->> 'text', 'qrCodeUrl', i.qr_code ->> 'url',
        'media', jsonb_build_object(
          'id', coalesce(m.id, i.id), 'companyId', i.company_id, 'type', i.content_type,
          'mediaUrl', m.media_url, 'publicUrl', coalesce(m.public_url, r.public_url),
          'storageProvider', m.storage_provider, 'storageKey', coalesce(m.storage_key, r.r2_key),
          'storageBucket', m.storage_bucket, 'mimeType', coalesce(m.mime_type, r.mime_type),
          'animation', coalesce(m.animation, 'none'), 'title', coalesce(i.title, i.message_text, m.title, m.message_text)
        )
      ) order by b.position, i.position)
      from public.tv_program_items i
      join public.tv_programs p on p.id = i.program_id
      left join public.tv_program_blocks b on b.id = i.block_id
      left join public.tv_media m on m.id = i.media_id and m.company_id = i.company_id
      left join public.r2_media_assets r on r.id = m.r2_asset_id and r.business_cnpj = i.company_id
      where i.company_id = p_company_id and p.company_id = p_company_id and p.active and i.active
        and p_display_id = any(i.display_ids)
        and (p.starts_at is null or p.starts_at <= now()) and (p.ends_at is null or p.ends_at > now())
    ), '[]'::jsonb),
    'interruptions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'companyId', q.company_id, 'displayId', q.display_id,
        'kind', q.interruption_type, 'priority', q.priority, 'requestedAt', q.requested_at,
        'expiresAt', q.expires_at, 'cancelledAt', q.cancelled_at,
        'durationSeconds', q.duration_seconds, 'title', q.title, 'subtitle', q.subtitle
      ) order by q.priority desc, q.requested_at)
      from (
        select id, company_id, display_id, interruption_type, priority, requested_at, expires_at, cancelled_at, duration_seconds, title, subtitle
        from public.tv_interruptions
        union all
        select id, company_id, display_id, 'call', 1000, requested_at, null,
          case when status = 'cancelled' then completed_at end,
          coalesce((select call_duration_seconds from public.tv_displays d where d.id = c.display_id), 12), call_text, customer_name
        from public.tv_calls c where status = 'pending'
      ) q
      where q.company_id = p_company_id and q.display_id = p_display_id
        and q.cancelled_at is null and (q.expires_at is null or q.expires_at > now())
    ), '[]'::jsonb)
  )
  where p_company_id = (select public.get_current_user_cnpj())
     or (select public.get_current_user_type()) = 99999;
$$;

revoke all on function public.get_tv_player_payload(text, uuid) from public, anon;
grant execute on function public.get_tv_player_payload(text, uuid) to authenticated;
