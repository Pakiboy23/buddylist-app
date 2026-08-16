-- ============================================================
-- MIGRATION: rooms_v2_launch_schema
-- Archive prototype tables, create real rooms schema, seed 7 rooms.
-- Imported retroactively from production migrations table.
-- ============================================================

-- ============================================================
-- STEP 1: Archive prototype tables (rename, data preserved)
-- ============================================================

ALTER TABLE public.room_message_attachments  RENAME TO _archive_room_message_attachments;
ALTER TABLE public.room_message_reactions     RENAME TO _archive_room_message_reactions;
ALTER TABLE public.room_messages              RENAME TO _archive_room_messages;
ALTER TABLE public.room_participants          RENAME TO _archive_room_participants;
ALTER TABLE public.user_active_rooms          RENAME TO _archive_user_active_rooms;
ALTER TABLE public.chat_rooms                 RENAME TO _archive_chat_rooms;

-- ============================================================
-- STEP 2: room_kind enum
-- ============================================================

CREATE TYPE public.room_kind AS ENUM ('regional', 'vibe');

-- ============================================================
-- STEP 3: rooms table
-- ============================================================

CREATE TABLE public.rooms (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           text        UNIQUE NOT NULL,
  name           text        NOT NULL,
  description    text        NOT NULL DEFAULT '',
  kind           public.room_kind NOT NULL,
  region_code    text,
  display_order  integer     NOT NULL DEFAULT 0,
  is_active      boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at     timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- ============================================================
-- STEP 4: room_memberships (presence + join tracking)
-- ============================================================

CREATE TABLE public.room_memberships (
  room_id      uuid        NOT NULL REFERENCES public.rooms(id)  ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  joined_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_seen_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX idx_room_memberships_room_last_seen
  ON public.room_memberships (room_id, last_seen_at DESC);

-- ============================================================
-- STEP 5: room_messages (fresh, new shape)
-- ============================================================

CREATE TABLE public.room_messages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid        NOT NULL REFERENCES public.rooms(id)  ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  body       text        NOT NULL CHECK (char_length(trim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX idx_room_messages_room_created
  ON public.room_messages (room_id, created_at DESC);

-- ============================================================
-- STEP 6: Enable RLS on new tables
-- ============================================================

ALTER TABLE public.rooms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_messages    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 7: RLS Policies
-- ============================================================

-- rooms: authenticated users can see active rooms
CREATE POLICY "rooms_select_active"
  ON public.rooms FOR SELECT TO authenticated
  USING (is_active = true);

-- room_memberships: members can see all members in their rooms
CREATE POLICY "memberships_select_room_members"
  ON public.room_memberships FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.room_memberships rm
      WHERE rm.room_id = room_memberships.room_id
        AND rm.user_id = auth.uid()
    )
  );

-- room_memberships: users manage only their own rows
CREATE POLICY "memberships_insert_own"
  ON public.room_memberships FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "memberships_update_own"
  ON public.room_memberships FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "memberships_delete_own"
  ON public.room_memberships FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- room_messages: read only if you have a membership row
CREATE POLICY "messages_select_member"
  ON public.room_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.room_memberships rm
      WHERE rm.room_id = room_messages.room_id
        AND rm.user_id = auth.uid()
    )
  );

-- room_messages: insert into active rooms you've joined
CREATE POLICY "messages_insert_member"
  ON public.room_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.rooms r
      JOIN public.room_memberships rm ON rm.room_id = r.id
      WHERE r.id = room_messages.room_id
        AND r.is_active = true
        AND rm.user_id = auth.uid()
    )
  );

-- ============================================================
-- STEP 8: updated_at trigger for rooms
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE TRIGGER rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- STEP 9: Seed 7 launch rooms
-- ============================================================

INSERT INTO public.rooms (slug, name, description, kind, region_code, display_order) VALUES
  ('nyc',            'New York City',   'The city that never sleeps.',                        'regional', 'US-NY', 1),
  ('la',             'Los Angeles',     'West Coast vibes, sun and screens.',                  'regional', 'US-CA', 2),
  ('chicago',        'Chicago',         'Chi-town. The Second City. Our kind of town.',        'regional', 'US-IL', 3),
  ('atlanta',        'Atlanta',         'ATL forever.',                                        'regional', 'US-GA', 4),
  ('everywhere-else','Everywhere Else', 'Not NYC, LA, Chicago, or ATL? This is your room.',   'regional',  NULL,   5),
  ('late-night',     'Late Night',      'For the night owls. No judgment.',                   'vibe',      NULL,   6),
  ('sunday-reset',   'Sunday Reset',    'Prep, reflect, recharge. See you Monday.',           'vibe',      NULL,   7);
