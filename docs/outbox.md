# Offline outbox

How unsent DMs and room messages survive a disconnect or an app kill, and how
not to duplicate a room send when recovering.

Live implementation: `src/lib/outbox.ts`.
Load / save / kill-recovery: `src/app/hi-its-me/page.tsx`.
Room dedup probe: `src/lib/messageIdempotency.ts` (`supportsRoomMessageDeduplication`).

## Intent

The outbox is a per-user local queue, not a server table. A send that is in
flight when the process dies must go back on the queue on the next sign-in.
Flush skips `sending` on purpose — an in-session row is owned by the request
still awaiting — and the UI hides Retry while a row is `sending`. Without the
load-time requeue those rows stay stuck forever.

## Architecture

```
sign-in / userId change
  └─ loadOutbox(userId)          localStorage hiitsme:outbox:v1:<userId>
       └─ requeueInterruptedOutboxSends(loaded)
            DM `sending`  → queued immediately
            room `sending` → stays sending until client_msg_id + flagged_at
                             exist on room_messages, then queued

later state updates
  └─ saveOutbox(userId, items)   only after outboxLoadedForUserId === userId
```

| Constraint | Value | Why |
|---|---|---|
| Storage key | `hiitsme:outbox:v1:<userId>` | Per account; sign-out must not flush someone else's queue |
| Max items | 160 | `normalizeOutboxItems` keeps the newest |
| Max body | 4000 chars | Truncated on create / normalize |
| Statuses | `queued` \| `sending` \| `failed` | Flush only takes `queued` / due `failed` |
| Backoff | 1.5s, 4s, 10s, 30s, 120s | `OUTBOX_BACKOFF_STEPS_MS` |
| Dedup id | `client_msg_id` (the outbox item `id`) | Room unique index `(user_id, client_msg_id)` |

Room recovery waits on `supportsRoomMessageDeduplication()`: a `select
client_msg_id,flagged_at` against `room_messages` that returns no error. If
that probe is false, an interrupted room send is left as `sending` so the
legacy insert path cannot duplicate it. The page only requeues the room ids
from **this** load — a `sending` row created after load is an in-session
send, not a kill.

Persist is gated on `outboxLoadedForUserId === userId`. Writing before that
marker would store an empty array (or another user's items) over the queue
that just loaded.

## Usage

Requeue is load-time only. Do not call `requeueInterruptedOutboxSends` from
the cross-tab `storage` listener — a live send in this tab looks the same as
a killed one in the serialized snapshot.

```ts
const loaded = loadOutbox(userId);
setOutboxItems(requeueInterruptedOutboxSends(loaded)); // DMs recovered; rooms wait
setOutboxLoadedForUserId(userId);
```

To force a room retry after the schema probe succeeds:

```ts
requeueInterruptedOutboxSends([item], true); // roomDedupSupported
```

## Pitfalls

- **Stuck `sending` after a kill.** That is the bug #186 fixed. If it returns,
  confirm the load effect in `hi-its-me/page.tsx` still calls
  `requeueInterruptedOutboxSends` and that persist still waits on
  `outboxLoadedForUserId`.
- **Duplicate room messages.** Recovering a room send before
  `client_msg_id` is unique-indexed duplicates the body. Leave those rows
  `sending` until the probe is true.
- **Safari “Load failed” on invite vs outbox.** Unrelated. Invites go through
  `rooms-invite`; the outbox talks to `messages` / `room_messages` via the
  Supabase client.
- **Tests.** `src/lib/outbox.test.ts` covers the mapper. `src/lib/outboxRecovery.test.ts`
  transpiles the page effect so a refactor that drops the load-time requeue
  fails CI.

## Related

- Password reset on iOS: [password-recovery-links.md](./password-recovery-links.md)
- Push after a successful send: [push-dispatch.md](./push-dispatch.md)
