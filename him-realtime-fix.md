# H.I.M. Realtime Fix

Two files to patch. Both changes together address the Capacitor/iOS realtime auth issue.

---

## 1. `src/lib/supabase.ts` — full file replacement

```typescript
import { createClient } from '@supabase/supabase-js';

const fallbackUrl = 'https://placeholder.supabase.co';
const fallbackAnonKey = 'placeholder-anon-key';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const shouldAllowFallback =
  process.env.NODE_ENV !== 'production' || process.env.ALLOW_SUPABASE_FALLBACK === 'true';

if ((!supabaseUrl || !supabaseAnonKey) && !shouldAllowFallback) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Set public Supabase env vars for production builds.',
  );
}

export const supabase = createClient(
  supabaseUrl ?? fallbackUrl,
  supabaseAnonKey ?? fallbackAnonKey,
  {
    auth: {
      detectSessionInUrl: false, // Capacitor doesn't use URL-based auth callbacks
      persistSession: true,
    },
  }
);
```

---

## 2. `src/components/GroupChatWindow.tsx` — subscription useEffect only (lines 635–755)

Replace the entire useEffect block (635–755) with this:

```typescript
  useEffect(() => {
    const roomChannel = supabase.channel(`active_chat_room:${roomId}`, {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });
    roomChannelRef.current = roomChannel;

    roomChannel.on('presence', { event: 'sync' }, () => {
      const presenceState = roomChannel.presenceState() as Record<string, RoomPresenceMeta[]>;
      const presentUserIds = Object.keys(presenceState);
      void ensureScreennames(presentUserIds);

      const nextParticipants = presentUserIds
        .map((userId) => {
          const metas = presenceState[userId] ?? [];
          const latestMeta = metas[metas.length - 1] ?? {};
          const resolvedScreenname =
            (typeof latestMeta.screenname === 'string' && latestMeta.screenname.trim()) ||
            screennameMapRef.current[userId] ||
            (userId === currentUserId ? currentUserScreenname : 'Unknown User');

          return {
            userId,
            screenname: resolvedScreenname,
            onlineAt: typeof latestMeta.online_at === 'string' ? latestMeta.online_at : null,
          };
        })
        .sort((left, right) =>
          left.screenname.localeCompare(right.screenname, undefined, { sensitivity: 'base' }),
        );

      setParticipants(nextParticipants);
    });

    // Server-side filter removed — filtering client-side to avoid JWT evaluation issues
    // in Capacitor WebSocket connections.
    roomChannel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'room_messages' },
      (payload) => {
        const incoming = payload.new as RoomMessage;
        if (!incoming?.id || incoming.room_id !== roomId) {
          return;
        }
        setMessages((previous) =>
          previous.some((message) => message.id === incoming.id) ? previous : [...previous, incoming],
        );
        setHasLiveMessageSinceOpen(true);
        void clearUnreads(roomName);
        void ensureScreennames([incoming.sender_id]);
      },
    );

    roomChannel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'room_messages' },
      (payload) => {
        const updated = payload.new as RoomMessage;
        if (!updated?.id || updated.room_id !== roomId) {
          return;
        }

        setMessages((previous) =>
          previous.map((message) => (message.id === updated.id ? { ...message, ...updated } : message)),
        );
      },
    );

    roomChannel.on('broadcast', { event: 'typing' }, (event) => {
      const payload = event.payload as RoomTypingPayload;
      const typingUserId = typeof payload.userId === 'string' ? payload.userId : '';
      if (!typingUserId || typingUserId === currentUserId) {
        return;
      }

      const typingScreenname =
        (typeof payload.screenname === 'string' && payload.screenname.trim()) ||
        screennameMapRef.current[typingUserId] ||
        'Unknown User';

      setTypingMap((previous) => ({
        ...previous,
        [typingUserId]: typingScreenname,
      }));

      if (typingTimeoutsRef.current[typingUserId]) {
        clearTimeout(typingTimeoutsRef.current[typingUserId]);
      }

      typingTimeoutsRef.current[typingUserId] = setTimeout(() => {
        setTypingMap((previous) => {
          if (!(typingUserId in previous)) {
            return previous;
          }

          const next = { ...previous };
          delete next[typingUserId];
          return next;
        });
      }, 3500);
    });

    // Explicitly sync the user's JWT to the realtime WebSocket connection.
    // In Capacitor, the HTTP session and WebSocket session can diverge without this.
    roomChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          await supabase.realtime.setAuth(session.access_token);
        }
        void roomChannel.track({
          user_id: currentUserId,
          screenname: currentUserScreenname,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      roomChannelRef.current = null;
      void roomChannel.untrack();
      roomChannel.unsubscribe();
      Object.values(typingTimeoutsRef.current).forEach((timeoutId) => clearTimeout(timeoutId));
      typingTimeoutsRef.current = {};
    };
  }, [clearUnreads, currentUserId, currentUserScreenname, ensureScreennames, roomId, roomName]);
```

---

## What changed and why

| Change | Why |
|---|---|
| `detectSessionInUrl: false` | Capacitor doesn't handle URL-based auth callbacks — without this, the client wastes time looking for a session in the URL on every mount |
| `persistSession: true` | Ensures session is written to localStorage and restored correctly across Capacitor app lifecycle |
| Removed `filter: room_id=eq.${roomId}` from postgres_changes | Server-side filter evaluation requires the realtime WebSocket to carry a valid JWT. If there's any auth timing issue, the filter silently drops all events. Client-side filtering is safer and has no perf cost at current message volume. |
| Added `incoming.room_id !== roomId` client-side guard | Replaces the server-side filter — only processes events for the active room |
| `supabase.realtime.setAuth(session.access_token)` | Explicitly syncs the user's JWT to the WebSocket connection after SUBSCRIBED. Prevents the WebSocket from using the anon key while the HTTP layer is using the user's session token. |
