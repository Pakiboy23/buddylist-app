-- ============================================================
-- Migrate messages.id from bigint (identity) to uuid
-- v2: includes RLS policy drop/recreate for dependent policies
-- Imported retroactively from production migrations table.
-- ============================================================

-- Step 1: Drop RLS policies that reference the old bigint message_id columns
DROP POLICY IF EXISTS message_reactions_insert_participants ON public.message_reactions;
DROP POLICY IF EXISTS message_reactions_select_participants ON public.message_reactions;
DROP POLICY IF EXISTS message_attachments_insert_participants ON public.message_attachments;
DROP POLICY IF EXISTS message_attachments_select_participants ON public.message_attachments;

-- Step 2: Add new uuid columns everywhere
ALTER TABLE public.messages ADD COLUMN new_id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE public.message_reactions ADD COLUMN new_message_id uuid;
ALTER TABLE public.message_attachments ADD COLUMN new_message_id uuid;
ALTER TABLE public.saved_messages ADD COLUMN new_source_message_id uuid;
ALTER TABLE public.abuse_reports ADD COLUMN new_source_message_id uuid;
ALTER TABLE public.messages ADD COLUMN new_reply_to_message_id uuid;
ALTER TABLE public.messages ADD COLUMN new_forward_source_message_id uuid;

-- Step 3: Back-fill FK columns from the messages.new_id mapping
UPDATE public.message_reactions mr
SET new_message_id = m.new_id
FROM public.messages m WHERE mr.message_id = m.id;

UPDATE public.message_attachments ma
SET new_message_id = m.new_id
FROM public.messages m WHERE ma.message_id = m.id;

UPDATE public.saved_messages sm
SET new_source_message_id = m.new_id
FROM public.messages m WHERE sm.source_message_id = m.id;

UPDATE public.abuse_reports ar
SET new_source_message_id = m.new_id
FROM public.messages m WHERE ar.source_message_id = m.id;

UPDATE public.messages child
SET new_reply_to_message_id = parent.new_id
FROM public.messages parent WHERE child.reply_to_message_id = parent.id;

UPDATE public.messages child
SET new_forward_source_message_id = parent.new_id
FROM public.messages parent WHERE child.forward_source_message_id = parent.id;

-- Step 4: Drop existing FK constraints
ALTER TABLE public.abuse_reports DROP CONSTRAINT abuse_reports_source_message_id_fkey;
ALTER TABLE public.message_attachments DROP CONSTRAINT message_attachments_message_id_fkey;
ALTER TABLE public.message_reactions DROP CONSTRAINT message_reactions_message_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT messages_forward_source_message_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT messages_reply_to_message_id_fkey;
ALTER TABLE public.saved_messages DROP CONSTRAINT saved_messages_source_message_id_fkey;

-- Step 5: Drop old PK on messages
ALTER TABLE public.messages DROP CONSTRAINT messages_pkey;

-- Step 6: Drop old bigint columns (CASCADE to handle any remaining dependencies)
ALTER TABLE public.message_reactions DROP COLUMN message_id CASCADE;
ALTER TABLE public.message_attachments DROP COLUMN message_id CASCADE;
ALTER TABLE public.saved_messages DROP COLUMN source_message_id;
ALTER TABLE public.abuse_reports DROP COLUMN source_message_id;
ALTER TABLE public.messages DROP COLUMN id;
ALTER TABLE public.messages DROP COLUMN reply_to_message_id;
ALTER TABLE public.messages DROP COLUMN forward_source_message_id;

-- Step 7: Rename new columns to canonical names
ALTER TABLE public.message_reactions RENAME COLUMN new_message_id TO message_id;
ALTER TABLE public.message_attachments RENAME COLUMN new_message_id TO message_id;
ALTER TABLE public.saved_messages RENAME COLUMN new_source_message_id TO source_message_id;
ALTER TABLE public.abuse_reports RENAME COLUMN new_source_message_id TO source_message_id;
ALTER TABLE public.messages RENAME COLUMN new_id TO id;
ALTER TABLE public.messages RENAME COLUMN new_reply_to_message_id TO reply_to_message_id;
ALTER TABLE public.messages RENAME COLUMN new_forward_source_message_id TO forward_source_message_id;

-- Step 8: Re-add PK with uuid default
ALTER TABLE public.messages ADD PRIMARY KEY (id);
ALTER TABLE public.messages ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Step 9: Restore FK constraints with original ON DELETE behavior
ALTER TABLE public.message_reactions ADD CONSTRAINT message_reactions_message_id_fkey
  FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;

ALTER TABLE public.message_attachments ADD CONSTRAINT message_attachments_message_id_fkey
  FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;

ALTER TABLE public.saved_messages ADD CONSTRAINT saved_messages_source_message_id_fkey
  FOREIGN KEY (source_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;

ALTER TABLE public.abuse_reports ADD CONSTRAINT abuse_reports_source_message_id_fkey
  FOREIGN KEY (source_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;

ALTER TABLE public.messages ADD CONSTRAINT messages_reply_to_message_id_fkey
  FOREIGN KEY (reply_to_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;

ALTER TABLE public.messages ADD CONSTRAINT messages_forward_source_message_id_fkey
  FOREIGN KEY (forward_source_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;

-- Step 10: Recreate RLS policies using the renamed (uuid) message_id column
CREATE POLICY message_reactions_select_participants ON public.message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_reactions.message_id
        AND (auth.uid() = m.sender_id OR auth.uid() = m.receiver_id)
    )
  );

CREATE POLICY message_reactions_insert_participants ON public.message_reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_reactions.message_id
        AND (auth.uid() = m.sender_id OR auth.uid() = m.receiver_id)
    )
  );

CREATE POLICY message_attachments_select_participants ON public.message_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_attachments.message_id
        AND (auth.uid() = m.sender_id OR auth.uid() = m.receiver_id)
    )
  );

CREATE POLICY message_attachments_insert_participants ON public.message_attachments
  FOR INSERT WITH CHECK (
    auth.uid() = uploader_id
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_attachments.message_id
        AND (auth.uid() = m.sender_id OR auth.uid() = m.receiver_id)
    )
  );
