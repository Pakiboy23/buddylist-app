-- Change the default notification preview mode from 'full' to 'name_only' for new users.
-- This reduces outing risk: new accounts start with sender-only previews (no message text
-- on the lock screen) rather than showing the full message body.
--
-- Existing users who already have a row in user_privacy_settings are unaffected —
-- their stored value is left as-is. Users without a row are backfilled to 'full' so
-- their current lock-screen experience is preserved until they change it deliberately.

-- Backfill existing users so they keep their current 'full' behavior after we change the default.
insert into public.user_privacy_settings (user_id, notification_preview_mode)
select u.id, 'full'
from public.users u
where not exists (
  select 1 from public.user_privacy_settings ps where ps.user_id = u.id
)
on conflict (user_id) do nothing;

-- New rows default to 'name_only' going forward.
alter table public.user_privacy_settings
  alter column notification_preview_mode set default 'name_only';

comment on column public.user_privacy_settings.notification_preview_mode is
  'Controls what appears in push notification banners and on the lock screen. '
  '''full'': sender name + message preview. '
  '''name_only'': sender name only, body hidden. '
  '''hidden'': no sender or content shown. '
  'Default for new accounts is ''name_only'' (since 2026-05-25). '
  'Pre-existing accounts were backfilled to ''full'' to preserve their prior experience.';
