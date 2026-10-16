# Password recovery

How a member with a real inbox resets a forgotten password, and how iOS opens
that email without a custom URL scheme.

Live implementation: `src/app/page.tsx` (`resetPasswordForEmail`),
`src/app/reset-password/page.tsx`, `src/lib/deepLinkPath.ts`,
`src/components/DeepLinkHandler.tsx`.

## Intent

Recovery is Supabase Auth's email link. There are no ticket tables, no
Recovery Concierge, and no Vercel `/api/auth/recovery/*` routes. Those were
dropped in April 2026 (`20260426083107_drop_password_recovery.sql`). A reset
email is only useful if the account has a real inbox — synthetic
`${screenname}@hiitsme.app` / `@buddylist.com` addresses cannot receive it.

## Flow

1. Sign-in screen → Forgot password → `resetPasswordForEmail(email, { redirectTo })`.
2. Native `redirectTo` is `https://hiitsme.app/reset-password`.
   Web `redirectTo` is `https://hiitsme-app.vercel.app/reset-password`
   (hard-coded production origin, not `window.location.origin`, so a preview
   deploy cannot mint a reset that lands on a dead preview URL).
3. The email's hash carries `#access_token=…&refresh_token=…&type=recovery`.
4. `/reset-password` parses those tokens, `setSession`, then `updateUser({ password })`.
   Tokens are stripped from the URL after a successful exchange.

Only `https://hiitsme.app/reset-password` is a valid **native** recovery
callback. `HIM://reset-password`, `hiitsme://reset-password`, and any other
origin's `/reset-password` are rejected in `resolveDeepLinkPath`. The iOS
custom scheme is `hiitsme`, not `HIM`, and it is not used for recovery.
`Info.plist` must not grow a `HIM` scheme.

## Native HTTPS rollout

The native reset callback is `https://hiitsme.app/reset-password`. iOS already
has `applinks:hiitsme.app` in its associated domains; the site's AASA file now
includes `/reset-password` for `6KTSZRW2J6.com.hiitsme.app`.

Release configuration:

1. Deploy `public/.well-known/apple-app-site-association` on `hiitsme.app`, served
   as JSON over HTTPS without a redirect (configured in `vercel.json`).
2. In the hosted Supabase project's Auth URL Configuration, add the exact
   `https://hiitsme.app/reset-password` redirect and remove `HIM://reset-password`.
   `supabase/config.toml` records this configuration locally; editing it does
   not update a hosted project. Keep the existing web reset redirect.
3. Build/sync and release the iOS app. Verify a real reset email on a device,
   with the app both running and terminated, reaches the reset screen and can
   update the password. Check the deployed association before releasing.

Universal links prevent another app from claiming this callback via a custom
scheme. iOS may still open the HTTPS page in a browser when the app is absent
or the user has chosen browser handling. The website remains the trusted
fallback; no recovery callback should redirect to a custom scheme.

## Pitfalls

- **"I never got the email."** The account is almost certainly a pre-real-email
  synthetic address. There is no admin ticket path to fall back on.
- **Vercel recovery routes.** `api/` is only `GET /api/admin/me`. Do not
  restore `/api/auth/recovery/*` or `src/lib/passwordRecovery.ts`.
- **Custom-scheme reset.** `#186` switched native onto the HTTPS universal
  link. Do not re-register `HIM://reset-password` in Info.plist or the
  Supabase allow list.
- **Contract tests.** `src/lib/deepLinkPath.test.ts` asserts the client
  redirect, AASA path, entitlements, `config.toml` allow list, and the
  absence of a `HIM` URL scheme stay aligned.

## Related

- Interrupted sends after an app kill: [outbox.md](./outbox.md)
