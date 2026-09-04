# Push dispatch

How H.I.M. turns a message, room post, or buddy request into an APNs notification — and how to tell a silent send from a successful one.

Live implementation: `supabase/functions/push-dispatch/index.ts`.
Client entry: `src/lib/pushDispatch.ts`.
Token registration: `src/components/GlobalNotificationListener.tsx`.

## Intent

Push is a delivery side-effect, not part of the write path. A failed or empty dispatch must never fail the DM, room message, or buddy insert. Until Sept 2026 the function returned HTTP 200 whether it reached every device or none of them, so four weeks of engine sends were indistinguishable from success. `push_dispatch_log` exists so that case is queryable.

## Architecture

```
user action (signed-in client)
  └─ insert row ──► src/lib/pushDispatch.ts
                      POST /functions/v1/push-dispatch
                      Authorization: Bearer <user JWT>

service-role / SQL insert (auth.uid() IS NULL)
  └─ AFTER INSERT trigger dispatch_push_for_inserted_row
       tables: messages, room_messages, buddies (pending only)
       POST /functions/v1/push-dispatch
       x-him-fanout-secret: <Vault push_fanout_secret>
```

The trigger skips any insert that already has `auth.uid()`, so a client send is not announced twice.

| Kind | Required body | Who may call it | Recipients |
|---|---|---|---|
| `dm` (default) | `messageId` | message author, or automation | `messages.receiver_id` |
| `room` | `roomMessageId` | room-message author, or automation | `room_memberships` except the author |
| `buddy_request` | `buddyId` (+ `actorId` in automation) | requester, or automation | the target |
| `buddy_accept` | `buddyId` | accepting user only | the original requester |

Automation may announce `buddy_request` only. Acceptances are always client-written and client-dispatched.

Both modes re-read the row before sending. A JWT is not enough to put `"sent you a buddy request"` on a stranger's lock screen: the function requires a `buddies` row with the matching status (`pending` or `accepted`). `public.buddies` is asymmetric — a pending request is one directional row.

## Tokens

`public.user_push_tokens` is the device registry. One token belongs to one account:

- `claim_push_token_for_user` (BEFORE INSERT, SECURITY DEFINER) deletes any other owner's row for the same token, under an advisory lock.
- Unique index `user_push_tokens_token_key` makes a second owner unstorable.

Without that, a device that signed into a second account kept delivering the first account's notifications — including the message preview — to whoever was signed in now.

The client upserts on `user_id,token` after Capacitor `registration`. iOS also stores `push_environment` (`sandbox` | `production`) so APNs hits the matching host. Unknown environment tries production then sandbox.

Dead tokens are pruned on this send:

- APNs: `BadDeviceToken`, `Unregistered`, `DeviceTokenNotForTopic`
- FCM (legacy Android rows): 404, or 400 with `INVALID_ARGUMENT` / `NOT_FOUND` / `UNREGISTERED`

Stale tokens (90 days from `last_registered_at`) are also removed by `run_retention_cleanup()`.

## Preview privacy

Per-recipient mode comes from `user_privacy_settings.notification_preview_mode`. Missing row → `name_only` (sender name, body `"New message"`). `hidden` shows title `H.I.M.` and the same generic body. `full` includes up to 140 characters of stripped text. Buzz / knock / voice-note / attachment use fixed copy instead of the body.

## Permission (iOS)

Never request on cold launch (`pushColdLaunchGuard.test.ts` enforces this). The only callers of `requestAndRegisterPush()` are:

- `/account` (user-initiated Enable)
- `maybePromptForPushAfterFriendshipAction` after a completed `buddy_accepted` or `first_dm_sent`

Friendship-action callers: `src/lib/buddyRequest.ts` (both Accept buttons go through `acceptIncomingBuddyRequest`) and `src/lib/messageIdempotency.ts` (every successful DM insert; the moment name is `first_dm_sent`). First room message is **not** wired.

### How the ask is gated (#154)

iOS permission state is the source of truth for whether *this install* has been asked. The stored flag (`him.pushPrompt.askedAt` in WKWebView localStorage) only throttles repeats:

| `checkPushPermission()` | What happens |
|---|---|
| `granted` / `denied` / `not-native` | return. A denial is never nagged |
| `prompt`, last ask younger than 7 days | return. Cooldown |
| `prompt`, no recent ask | `markAsked()`, then `requestAndRegisterPush()` |

Order matters: the OS is consulted **before** storage. The previous guard read localStorage first and returned if the flag was set, which permanently suppressed the prompt on installs iOS had never asked.

The two states desync because they live in different places:

- the flag sits in WKWebView localStorage and survives app updates and reinstalls
- authorization is per-install and resets on delete-and-reinstall, or when swapping an Xcode debug build for TestFlight

After that the flag said "asked" while iOS said "never asked", and the only remaining route to push was the `/account` row.

Do **not** key the ask on "does this user have a push token". Tokens outlive the install that created them, so a `user_push_tokens` row is no evidence the current install was asked.

Private mode / storage unavailable is treated as no record (ask), not as "already asked". That is safe because the ask is only reached when iOS reports `prompt`, and iOS shows the sheet only while undetermined.

The 7-day window is `REASK_COOLDOWN_MS` in `src/lib/pushPromptMoments.ts`. `pushColdLaunchGuard.test.ts` asserts OS-before-storage, that the throttle is a cooldown rather than a permanent veto, and that no cold-launch surface imports the prompt.

## Auth and secrets

| Mode | Header | Check |
|---|---|---|
| Client | `Authorization: Bearer <JWT>` | caller must be the author / actor of the row |
| Automation | `x-him-fanout-secret` | must equal `public.push_fanout_secret()` (Vault; service_role only) |

Platform `verify_jwt` is off; the function verifies itself. CORS allows `authorization`, `content-type`, `x-him-fanout-secret`.

Required function secrets (iOS):

- `APPLE_PUSH_KEY_ID`
- `APPLE_PUSH_TEAM_ID`
- `APPLE_PUSH_PRIVATE_KEY`
- `APPLE_PUSH_TOPIC` (falls back to `VITE_IOS_BUNDLE_ID` or `com.hiitsme.app`)

`FCM_SERVICE_ACCOUNT_JSON` is still read for leftover `platform = 'android'` rows. If unset, Android tokens are skipped and iOS still sends. The `android/` client was removed in #147, so new FCM registrations should not appear.

Vault secrets used by the trigger (not in the repo): `push_fanout_secret`, `edge_functions_base_url`. Re-running `20260819060000` will not rotate an existing secret.

## Observability: `push_dispatch_log`

One row per dispatch. Written under the service role. RLS on, no policies — clients cannot read it. Insert failures are swallowed so logging cannot break delivery.

| Column | Meaning |
|---|---|
| `variant` | `dm` / `room` / `buddy` |
| `kind` | request kind (`dm`, `room`, `buddy_request`, `buddy_accept`) |
| `automation` | `true` when the fanout secret was used |
| `actor_id` | sender / requester |
| `subject_id` | message id, room-message id, or buddy recipient (text; not a join key) |
| `recipients` | accounts resolved for this send |
| `tokens` | device rows found for those accounts |
| `attempted` / `delivered` / `pruned` | provider calls / 2xx / tokens deleted as dead |
| `failures` | up to 20 `{platform, env, status, reason}` objects. Reasons are redacted (`src/lib/pushFailureRedaction.ts`) — no device tokens |

The two operational alerts:

```sql
-- Dispatched to people, reached no device (nobody registered).
select created_at, variant, kind, automation, actor_id, recipients, tokens
from public.push_dispatch_log
where recipients > 0 and tokens = 0
order by created_at desc
limit 50;

-- Reached nobody, for any reason (unregistered or dead tokens).
select created_at, variant, kind, automation, recipients, tokens, attempted, delivered, failures
from public.push_dispatch_log
where recipients > 0 and delivered = 0
order by created_at desc
limit 50;
```

`recipients > 0 AND tokens = 0` is the row that would have caught the Aug 2026 silent-engine window on day one.

There is no automated purge of this table yet. It holds no device tokens; `actor_id` is a user FK (`ON DELETE SET NULL`).

## Constraints and pitfalls

- **HTTP 200 is not delivery.** Read `delivered` / `tokens` on the log row, not the status code.
- **Delivered is not seen.** APNs can accept a token from a previous install while the current one has never requested authorization. iOS then drops the notification. Diagnostic: H.I.M. is absent from Settings → Notifications (iOS only lists an app once it has requested authorization). `user_push_tokens` will still show rows. The #154 prompt fix exists because of this; do not "fix" it by skipping the ask when tokens exist.
- **Client dispatch needs a session.** `pushDispatch.ts` no-ops if `getAccessTokenOrNull()` is empty. Server-side writes must rely on the trigger — do not also try to call the function without a JWT or the fanout secret.
- **Do not invent a `buddy_accept` automation call.** The function rejects it.
- **Do not POST a `buddyId` you did not write.** The relationship check returns 404 and is the rate-limit/abuse backstop.
- **Mirror redaction.** Token-shaped strings in APNs/FCM error text are stripped before insert. Keep `push-dispatch/index.ts` and `src/lib/pushFailureRedaction.ts` in sync; the tests live with the latter.
- **APNs JWT is cached per invocation**, reused across tokens. Apple asks for no more than one token per 20 minutes; regenerating per device risks Edge timeouts on room fan-out.
- **`apns-expiration` is +24h.** Without it APNs treats the push as immediate-or-discard when the device is asleep.
- **`mutable-content: 1` is a hook.** No Notification Service Extension is implemented yet.
- **Legacy Vercel copies** (`api/push/dispatch.ts`, `src/app/api/push/dispatch/route.ts`) are not the path the client calls. Do not "fix" them instead of the Edge Function.

## Related

- Permission + registration: `src/lib/nativePush.ts`, `src/lib/pushPromptMoments.ts`
- Exclusive-token migration: `supabase/migrations/20260901060100_push_token_single_account.sql`
- Log schema: `supabase/migrations/20260901060000_push_dispatch_log.sql`
- Server-side buddy requests: `supabase/migrations/20260901060200_dispatch_push_on_buddy_request.sql`
- iOS host / rebuild: [../IOS_APP_STORE_RELEASE.md](../IOS_APP_STORE_RELEASE.md)
