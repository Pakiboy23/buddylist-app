# Password recovery

Supabase Auth email reset. There is no Recovery Concierge, no recovery-code
table, and no admin ticket API.

## Intent

Accounts need a real inbox. New signups collect one. Older accounts were
created with a constructed `${screenname}@hiitsme.app` (or legacy
`@buddylist.com`) address that cannot receive mail. Reset only works for the
email stored on `auth.users`.

## Flow

1. Logged-out **Forgot password** on `/` (`authView === 'forgot-password'`).
2. Client calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })`.
3. User opens the email link.
4. `/reset-password` reads `#type=recovery&access_token=…&refresh_token=…`,
   calls `setSession`, then `updateUser({ password })`, then a local sign-out.

| Surface | Redirect target |
|---|---|
| Web | `https://hiitsme-app.vercel.app/reset-password` (hard-coded, not `window.location.origin`, so preview deploys still land on production) |
| Native | `HIM://reset-password` (`capacitor.config.ts` `ios.scheme`) |

`DeepLinkHandler` keeps the URL hash so the recovery tokens survive the
Capacitor `appUrlOpen` hop.

## Constraints

- Password must be at least 8 characters (`reset-password/page.tsx`).
- `/account` shows a banner when the signed-in email is `@hiitsme.app` or
  `@buddylist.com` and asks the user to add a real address.
- `src/lib/deadAdminReset.guard.test.ts` fails the build if ticket/Concierge
  client markers return.

## What was deleted

| Removed | When |
|---|---|
| `account_recovery_codes`, `password_reset_tickets`, `password_reset_audit`, `password_reset_attempts` | Migration `20260426083107_drop_password_recovery.sql` |
| Vercel `/api/auth/recovery/{setup,reset,redeem-ticket}` | #172 |
| Recovery Concierge UI + admin ticket client | #173 |

Do not rebuild those. The only remaining Vercel function is `GET /api/admin/me`.

## Troubleshooting

| Symptom | Cause |
|---|---|
| "Check your email" but nothing arrives | Auth email is a synthetic `@hiitsme.app` / `@buddylist.com` address. Add a real inbox on `/account`. |
| Native link opens the app, then "invalid or expired" | Recovery tokens live in the URL hash. `DeepLinkHandler` must keep `#access_token`. Do not "fix" this by restoring ticket APIs. |
| Looking for `src/lib/passwordRecovery.ts` | File is gone. Reset lives in `src/app/page.tsx` and `src/app/reset-password/page.tsx`. |
