-- Close the content-moderation edit bypass.
--
-- The profanity filter (20260515021650_content_moderation.sql) installed only
-- BEFORE INSERT triggers (messages_flag_objectionable,
-- room_messages_flag_objectionable). A user could therefore post clean content
-- and then EDIT it to objectionable content without it ever being flagged.
--
-- Add BEFORE UPDATE OF triggers that reuse the existing flagging functions so
-- edits are re-scanned. Scoped to the content column (messages.content /
-- room_messages.body) so unrelated updates (read_at, delivered_at, deleted_at,
-- reactions, etc.) do not pay the regex cost.
--
-- The flagging functions only SET new.flagged_at when content is objectionable;
-- they never clear it. That is intentional and conservative: an edit from
-- objectionable -> clean leaves the message flagged for review rather than
-- silently un-flagging it.

drop trigger if exists messages_flag_objectionable_update on public.messages;
create trigger messages_flag_objectionable_update
  before update of content on public.messages
  for each row
  execute function public.flag_objectionable_message();

drop trigger if exists room_messages_flag_objectionable_update on public.room_messages;
create trigger room_messages_flag_objectionable_update
  before update of body on public.room_messages
  for each row
  execute function public.flag_objectionable_room_message();
