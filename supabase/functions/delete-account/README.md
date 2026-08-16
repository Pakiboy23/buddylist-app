# delete-account

Self-service account deletion endpoint. Required for Apple App Store Guideline 5.1.1(v).

## Endpoint

`POST /functions/v1/delete-account`

Headers:
- `Authorization: Bearer <user JWT>` (required — the JWT identifies the account to delete)
- `Content-Type: application/json` (body is unused but allowed for future audit-log fields)

Returns `200 { ok: true, userId, deletes: [...] }` on success or `500 { error, detail, completed }` on partial failure.

## What it does

1. Verifies the caller via JWT (`auth.getUser`).
2. With the service-role client, deletes the user's data from the following tables in dependency order. Most child tables cascade off `public.users`, but we delete explicitly so partial failures surface rather than silently leaving rows.
3. Deletes the auth user **last** via `auth.admin.deleteUser`. Once this returns, the account cannot be recovered.

## Tables touched (in deletion order)

| Table                  | Filter(s)                       | Notes                                                              |
|------------------------|---------------------------------|--------------------------------------------------------------------|
| `messages`             | `sender_id`, `receiver_id`      | Direct messages on both sides.                                     |
| `room_messages`        | `user_id` (v2) → `sender_id` (v1 fallback) | Group/room messages authored by the user.              |
| `room_memberships`     | `user_id`                       | Rooms v2 membership (replaces `room_participants`).                |
| `room_participants`    | `user_id`                       | Rooms v1 membership. Production has this as `_archive_room_participants` after the v2 launch — kept for envs still on v1. |
| `user_active_rooms`    | `user_id`                       | Rooms v1 persistent list / unread counters. Production has this as `_archive_user_active_rooms` after the v2 launch. |
| `user_dm_state`        | `user_id`, `buddy_id`           | Per-DM unread counters on both sides of every DM.                  |
| `user_dm_preferences`  | `user_id`, `buddy_id`           | Per-DM pin/mute/archive/theme/wallpaper/disappearing-timer.        |
| `blocked_users`        | `blocker_id`, `blocked_id`      | Block records on both sides.                                       |
| `abuse_reports`        | `reporter_id`, `target_user_id` | Reports filed by AND against the user (full erasure).              |
| `buddies`              | `user_id`, `buddy_id`           | Legacy buddy graph (gtm_plan migration).                           |
| `user_connections`     | `user_a`, `user_b`              | Newer connection model (migration 18).                             |
| `saved_messages`       | `user_id`                       | Bookmarked messages.                                               |
| `user_privacy_settings`| `user_id`                       | Read receipts / preview mode / screen shield preferences.          |
| `user_push_tokens`     | `user_id`                       | iOS/Android/web push device tokens.                                |
| `users` (public)       | `id`                            | Profile mirror. Most cascading FKs hang off this row.              |
| `auth.users`           | `id` (via `auth.admin.deleteUser`) | **Final, irreversible step.**                                  |

## Tables NOT touched (intentionally)

- `chat_rooms` — public rooms persist even if their creator leaves. Their `created_by_id` FK uses `on delete set null`.
- `message_reactions`, `room_message_reactions`, `message_attachments`, `room_message_attachments` — cascade off `messages`/`room_messages` (deleted above) and off `users` directly.
- `admin_users`, `password_reset_*`, `account_recovery_codes` — cascade off `auth.users` and clear automatically when the auth row is deleted.

## Deployment

```bash
supabase functions deploy delete-account
```

Required env vars (set automatically for hosted Edge Functions):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Notes

- This function is invoked from the in-app `/account/delete` flow after the user types their screenname to confirm.
- Errors return HTTP 500 with a `completed` array listing which deletes succeeded before the failure, to aid manual cleanup if it ever fires.
- No transaction wraps the cross-table deletes — Supabase JS does not support multi-statement transactions over PostgREST. The order above is chosen so that an early failure leaves only orphan child rows (which the eventual cascade on `auth.users` will clean up), never an orphaned auth row.
