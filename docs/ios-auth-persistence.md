# iOS auth persistence

How a signed-in session survives a TestFlight bump, a WKWebView cache clear, and the Capacitor `INITIAL_SESSION` race — and how to tell a real sign-out from "not restored yet."

Live implementation:

- Storage adapter: `src/lib/himAuthStorage.ts` + `src/lib/nativePersistentKv.ts`
- Native KV: `HiItsMeShellPlugin` in `ios/App/App/AppDelegate.swift` (`him.persist.` UserDefaults keys)
- Session lookup: `src/lib/authClient.ts` (`waitForSessionOrNull`)
- Bounce policy: `src/lib/authSessionPolicy.ts` (`shouldBounceToSignedOutRoute`)
- Contract tests: `src/lib/iosAuthPersistence.contract.test.ts`, `src/lib/authSession.test.ts`, `src/lib/himAuthStorage.test.ts`

## Intent

App Review 2.1(a) looks like this when it fails: the reviewer signs in, the buddy list flashes, then the login UI comes back. Until #165 that bounce was a local race, not a bad password.

Two independent bugs stacked:

1. `onAuthStateChange` treated any null session as signed-out. Capacitor often emits `INITIAL_SESSION` with `session === null` while storage is still hydrating.
2. `AppDelegate.clearWebViewCacheIfBuildChanged()` used to wipe all WKWebView site data on a new `CFBundleVersion`, including localStorage. Theme and app-lock still live there; wiping them on every TestFlight build also dropped the Supabase session before the native KV existed.

A failed restore must never look like a logout. A real logout is only the `SIGNED_OUT` event.

## Architecture

```
sign-in / token refresh
  └─ supabase-js persistSession
       storage: createHimAuthStorage()
         web:    window.localStorage
         native: UserDefaults (him.persist.<key>)  +  localStorage dual-write

cold start (native)
  └─ waitForSessionOrNull()
       getSession()
       if null: retry up to 12 × 250ms (3s) while UserDefaults hydrates
       login page: if session → /hi-its-me
       /hi-its-me: bounce to / only on SIGNED_OUT
```

| Surface | What it stores | Survives a build-number cache clear? |
|---|---|---|
| UserDefaults `him.persist.*` | Supabase auth JSON (`sb-*-auth-token`) | Yes. Native plugin, not WKWebView site data. |
| WKWebView localStorage | Same auth JSON (mirror) plus theme, app-lock, outbox | Yes as of #165 — cache clear no longer includes localStorage. |
| Memory fallback | Auth JSON if localStorage throws | No. Process-lifetime only. |

On native `getItem`, UserDefaults wins. If native is empty and localStorage still has a session, the adapter copies it into UserDefaults (one-time migrate of installs that signed in before #165).

`HiItsMeShell.isAvailable()` stays `false`. That flag is presentation chrome, not "are native services up." Persistent KV and `getPushEnvironment()` must not be gated on it.

## Bounce policy

`shouldBounceToSignedOutRoute(event, session)` is true **only** for `SIGNED_OUT`.

| Event | Bounce to login? |
|---|---|
| `SIGNED_OUT` | Yes |
| `INITIAL_SESSION` (even with `session === null`) | No |
| `SIGNED_IN`, `TOKEN_REFRESHED`, `USER_UPDATED`, `PASSWORD_RECOVERY`, `MFA_CHALLENGE_VERIFIED` | No |

Call sites:

- `/hi-its-me` — `onAuthStateChange` uses the helper. Do not restore `if (!nextSession) navigate('/')`.
- Login page — ignores everything except `SIGNED_IN`, then routes to `/hi-its-me`. On mount it also `waitForSessionOrNull()` so an already-signed-in native install does not sit on Sign in. It must not `await playSignOnSound()` before routing (the sound can hang; the route would never fire).

## Cache clear on build bump

`clearWebViewCacheIfBuildChanged()` still runs once per new `CFBundleVersion` (`UserDefaults` key `lastLaunchedCFBundleVersion`) so a stale service worker cannot keep serving the previous bundle. It wipes only:

- `WKWebsiteDataTypeDiskCache`
- `WKWebsiteDataTypeMemoryCache`
- `WKWebsiteDataTypeFetchCache`
- `WKWebsiteDataTypeOfflineWebApplicationCache`
- `WKWebsiteDataTypeServiceWorkerRegistrations`

Do **not** use `WKWebsiteDataStore.allWebsiteDataTypes()`. That also deletes localStorage, cookies, and IndexedDB. Same-number reinstalls do not clear anything.

## Privacy manifest

The app target `ios/App/App/PrivacyInfo.xcprivacy` declares `NSPrivacyAccessedAPICategoryUserDefaults` reason `CA92.1` ("access info from the same app that wrote it"). Required because `HiItsMeShellPlugin` and the build-number stamp both read/write `UserDefaults.standard`. The Badge plugin already declared the same reason in its own manifest.

## Pitfalls

- **Do not treat `INITIAL_SESSION` + null as logout.** That is the 2.1(a) bounce. `authSession.test.ts` is the contract.
- **Do not `signOut()` on an invalid-refresh error inside `getSessionOrNull`.** A coalesced native lookup can still be retrying when the reviewer signs in; a local sign-out wipes the fresh session.
- **Do not hide React chat chrome because `isNativeIosShell()` is true.** `isAvailable()` is always false, so there is no native Done/Back to replace it. Chat headers always render (`#166`).
- **Do not gate `getPushEnvironment()` on `isAvailable()`.** That made every iOS token persist `push_environment: null`.
- **Do not hand-edit hashed files under `dist/assets/` or `ios/App/App/public/assets/`.** CI's bundle-integrity guard fails a modified content-hashed path. Rebuild with real `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.

## Troubleshooting

### Reviewer (or you) signs in and lands back on Sign in

1. Confirm the bounce is `SIGNED_OUT`, not `INITIAL_SESSION`. If `/hi-its-me` navigates on any null session, that is the bug in `authSession.test.ts`.
2. Confirm `createHimAuthStorage()` is the supabase `auth.storage` adapter (`src/lib/supabase.ts`).
3. Confirm `AppDelegate` still lists only the five cache/SW types above — no `allWebsiteDataTypes()`, no `WKWebsiteDataTypeLocalStorage`.
4. On device: Settings → H.I.M. should still be signed in after a TestFlight bump. If the session vanishes only on a new build number, the cache-clear set grew.

### `waitForSessionOrNull` returns null on a cold native launch, then the session appears

Expected for a few hundred milliseconds while UserDefaults hydrates. The 12×250ms retry exists for that. Do not shorten it to "one getSession" on iOS.

### Login screen plays the sign-on sound and never navigates

The route must not wait on `playSignOnSound()`. It is `void playSignOnSound()` on purpose.

## Related

- iOS host / rebuild: [../IOS_APP_STORE_RELEASE.md](../IOS_APP_STORE_RELEASE.md)
- Push environment (same plugin, different method): [push-dispatch.md](./push-dispatch.md)
- On-device key inventory: [compliance/storage-inventory.md](./compliance/storage-inventory.md)
