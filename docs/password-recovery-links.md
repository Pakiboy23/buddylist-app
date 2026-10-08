# Native password recovery links

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
