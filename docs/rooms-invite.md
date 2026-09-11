# Room invites

How an accepted buddy is pulled into a room from inside that room — and why the invite sheet used to say "Load failed".

Live implementation: `supabase/functions/rooms-invite/index.ts`.
Client: `src/lib/roomsInvite.ts` + invite sheet in `src/components/GroupChatWindow.tsx`.
Schema: `supabase/migrations/20260811000001_room_membership_invited_by.sql`.

## Intent

Invites are an in-app buddy action, not a growth loop of links. The function takes `roomId + buddyIds`, verifies the relationship, and upserts `room_memberships`. There is no token, no shareable URL, and `/join/:inviteCode` discards the code (`src/app/join/[inviteCode]/page.tsx` navigates to `/hi-its-me/rooms`).

Do not add viral invite links. Strangers cannot cold-link into rooms.

## Request

```
POST /functions/v1/rooms-invite
Authorization: Bearer <user JWT>
apikey: <VITE_SUPABASE_ANON_KEY>
Content-Type: application/json

{ "roomId": "<uuid>", "buddyIds": ["<uuid>", ...] }
```

`inviteAcceptedBuddiesToRoom()` always sends `apikey` when the anon key is present. CORS preflight must allow it.

Success: `{ success: true, invited: string[] }`.
Failure: `{ error: string }` with 4xx/5xx.

## Server checks (in order)

1. JWT required. No token → 401.
2. Body is `roomId` string + non-empty `buddyIds` string[] → else 400.
3. Each invitee has an **accepted** `buddies` row in either direction (graph is asymmetric; some accepted mirrors are missing). Lookups are two `.in()` filters, not a nested `.or(and(...))` — a ~26-buddy invite made the OR clause a multi-KB query string.
4. Room exists and `is_active`.
5. Caller has a `room_memberships` row for that room.
6. Upsert `{ room_id, user_id, joined_at, last_seen_at, invited_by }` with `onConflict: room_id,user_id` and `ignoreDuplicates: true`. Existing memberships keep their original `joined_at` / `invited_by`.

If none of the IDs confirm as accepted buddies → 403 `"None of the specified users are your buddies."`

## `invited_by`

Invite-joins stamp `room_memberships.invited_by` with the caller's user id (GH-14). Self-joins and legacy rows stay `NULL`.

The column is not client-writable. Trigger `protect_room_membership_invited_by` forces `invited_by` to `NULL` on INSERT and preserves `OLD` on UPDATE unless the writer is service-role / postgres. Client `last_seen_at` heartbeats therefore cannot forge attribution. ChatContext's own-membership upsert does not set the column.

## Client invite sheet

`selectInvitableBuddies()` lists accepted buddies who are not already members and not blocked.

`membershipReady` must be true only after the roster membership query **succeeds**. An empty map is indistinguishable from "nobody has joined yet," which would list every buddy and turn a duplicate invite into a fake success. A failed roster query is not ready — the sheet shows "Could not check who is already in this room." rather than a full buddy list.

The session token is a **static** import of `getAccessTokenOrNull`. A dynamic `import()` of `authClient` made Safari throw TypeError `"Load failed"` from a missing chunk.

While the invitee has the app open, `ChatContext` listens on `postgres_changes INSERT` for `room_memberships` filtered to `user_id=eq.<self>` and calls `syncFromServer()`, so the new room appears without a refresh.

## CORS / "Load failed" (#161)

Safari reports a blocked CORS POST as TypeError `"Load failed"` (Chromium: `"Failed to fetch"`). There is no JSON body.

Production reproduced this when the **deployed** function still advertised:

```
Access-Control-Allow-Headers: authorization, content-type
```

The web client sends `apikey`. OPTIONS returned 204; the POST never left the browser.

Required headers on the function (match `delete-account`):

```
Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type
Access-Control-Allow-Methods: POST, OPTIONS
```

`formatInviteClientError()` maps those transport errors to `"Could not reach the invite service. Try again in a moment."` so the sheet does not show the raw WebKit string.

### Deploy is the actual fix

Changing `index.ts` on `main` does not update the running function. After a CORS or auth-header change:

```bash
supabase functions deploy rooms-invite
```

Then confirm the preflight `Access-Control-Allow-Headers` on `OPTIONS https://<project>.supabase.co/functions/v1/rooms-invite` includes `apikey`.

## Constraints

- Invitees must already be accepted buddies. Pending requests are not invitable.
- Caller must already be in the room. Preview/join uses `join_room_by_id`, not this function.
- Do not reintroduce a nested `.or()` buddy filter.
- Do not treat `/join/:inviteCode` or `getShareableInviteUrl` as a working redemption path.

## Tests

`src/lib/roomsInvite.test.ts` asserts the Edge Function source (CORS allow-list, `.in()` lookups, accepted-buddy + membership checks), the static `authClient` import, `membershipReady` wiring, and the WebKit error rewrite.
