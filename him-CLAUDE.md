# CLAUDE.md — H.I.M. ("Hi, It's Me")

## What this is

H.I.M. is a friendship-first social app for gay men. Built on AIM-era mechanics: screennames, away messages, buddy lists, chat rooms. Not a dating app, not a hookup app. The positioning is intentional and non-negotiable.

**Parent company:** Saman Technologies LLC
**Domain:** hiitsme.app
**Bundle ID:** com.hiitsme.app
**Supabase project:** BuddyList (`keckqpadzxwwmagnmpuk`, us-west-2)
**Vercel project:** hiitsme-app (`prj_b5HOSaxQJ2o0pbtczs4mLpHene8N`)
**Vercel team:** syed-shariffs-projects
**GitHub:** Pakiboy23/buddylist-app

---

## Stack

- **Frontend:** Vite + React Router v7 (TypeScript, React). Client-side SPA. The Vercel project is still named `hiitsme-app` for historical reasons — the repo is `buddylist-app`.
- **Mobile wrapper:** Capacitor 8 (iOS-only at launch)
- **Styling:** Tailwind v4 — but all background colors must use inline styles or arbitrary values, not utility classes. Tailwind utilities override CSS custom properties and break the design system. See "Design System" below.
- **Backend/DB:** Supabase (PostgreSQL, RLS, Realtime, Edge Functions)
- **Auth:** Supabase Auth with synthetic emails (`${screenname}@buddylist.com`). Screenname stored as `username` in `profiles` table.
- **Push:** APNs (key XV95PUP6YN, topic com.hiitsme.app)
- **Deployment:** Vercel

---

## Critical architecture notes

### Client-side SPA + Capacitor
The app is a pure client-side SPA (Vite build, React Router v7). Capacitor serves the built assets from `ios/App/App/public/`. No server runtime at any point. Supabase realtime needed explicit workarounds for the WebSocket vs HTTP session divergence — do not remove them:

- `detectSessionInUrl: false` in Supabase client config
- `supabase.realtime.setAuth(session.access_token)` after SUBSCRIBED
- Client-side filtering on `room_id` instead of server-side realtime filters

**Do not introduce any server-side primitives** (no API routes, no server components, no SSR data fetching). Everything must work inside the Capacitor shell as a static bundle.

### Auth model
Users sign up with a screenname, not an email. Supabase Auth requires an email, so the app generates synthetic emails (`screenname@buddylist.com`). The screenname is the user-facing identity everywhere.

Password reset uses a custom flow (not Supabase's built-in) because there's no real email to send to. Four tables power this: `account_recovery_codes`, `password_reset_tickets`, `password_reset_audit`, `password_reset_attempts`. This is security-critical code — do not refactor without explicit instruction.

### Social graph
The `buddies` table is the authoritative social graph. Symmetric friendship model (pending → accepted). The `user_connections` table is a dead artifact — it was never used and should be dropped. Do not build anything on `user_connections`.

### Room membership
`user_active_rooms` is the primary room membership table (has unread counts, read state). `room_participants` is a legacy duplicate that should be merged into `user_active_rooms`. Until that migration happens, writes must go to both tables.

---

## Design system

**Every background color must use Tailwind arbitrary values or inline styles.** Standard Tailwind utility classes (`bg-black`, `bg-slate-950`, etc.) override CSS custom properties and render incorrect colors. This is the single most common source of visual bugs.

### Tokens

```
Base background:       #13100E   (dark warm charcoal — NOT black)
Surface / cards:       #1E1812
Surface border:        #2A221A
Rose primary:          #E8608A
Gold warmth:           #D4963A
Lavender idle:         #A78BFA
Green online:          #4EC97A
Text primary:          #F5EDE0
Text muted:            #6B5B4E
Text inactive nav:     #4A3C35
```

### Typography
- Screennames: IBM Plex Mono
- UI copy: Nunito
- Headers: rose-to-lavender-to-gold gradient, 2px

### Tab bar
- Active tab: rose `#E8608A` icon + label. No background pill, no rounded container, no badge. Color only.
- Inactive tab: `#4A3C35`

### Logo
Orbit mark. Three bodies — rose, gold, lavender — on an outer and inner orbit ring around a soft cream center. Asymmetric composition, intentional. Wordmark is lowercase `him` in Space Grotesk 600 with `FRIENDSHIP · FIRST` tagline at letter-spacing 4. Never uppercase, never `H.I.M.` in the wordmark slot (periods only survive in body copy and press). Full brand sheet, deliverables, and usage rules live in `him-brand-kit/him-brand-lock.md`. Source SVGs in `him-brand-kit/source/`, iOS AppIcon set in `him-brand-kit/ios-appicon/`, web favicons + OG in `him-brand-kit/web/`.

### Chat input
```tsx
className="bg-[#1E1812] border border-[#2A221A] text-white placeholder-[#6B5B4E] rounded-lg px-4 py-3 w-full focus:outline-none focus:border-[#E8608A] transition-colors"
```

---

## Supabase schema conventions

- Primary keys: UUID everywhere. `messages.id` is currently `bigint` (migration to UUID is planned — 163 rows, do it before scale).
- `room_messages.id` is already UUID.
- Attachment tables (`message_attachments`, `room_message_attachments`) mirror each other structurally. Default bucket: `chat-media`. 10MB size cap.
- Presence fields on `users` table have sprawl: `status`, `status_msg`, `away_message`, `is_online`, `last_seen`, `idle_since`, `last_active_at`. Consolidation to `status` (enum) + `away_message` + `last_active_at` is planned.
- Migrations must use `YYYYMMDDHHmmss` filename format. If applied as raw SQL, register with `supabase migration repair --status applied [name]`.

---

## Code conventions

- TypeScript strict mode
- Functional React components with hooks
- No class components
- Prefer `const` arrow functions for components
- All realtime subscriptions must include the `setAuth()` pattern after SUBSCRIBED
- Client-side filtering on realtime payloads (do not rely on server-side filters in Capacitor context)
- No `bg-black`, `bg-slate-*`, `bg-zinc-*`, `bg-gray-*`, `bg-neutral-*` utility classes for backgrounds. Use `bg-[#13100E]` or `bg-[#1E1812]`.

---

## What not to do

- Do not use server-side rendering features (getServerSideProps, server components, etc.)
- Do not add SSR-dependent API routes
- Do not use standard Tailwind background utility classes
- Do not build on the `user_connections` table
- Do not refactor the custom password reset flow without explicit instruction
- Do not use generic startup language in any copy ("revolutionize", "authentic self", "vibrant community", etc.)
- Do not introduce heavy dependencies without justification
- Do not touch unrelated files when making scoped changes

---

## Testing

- Real device testing via TestFlight (Xcode Cloud builds)
- APNs push notifications require a real device — simulator won't work
- Verify realtime subscriptions connect and receive events inside the Capacitor shell, not just the browser
- After any styling change, check that backgrounds render `#13100E`, not black or navy

---

## Brand voice (for any copy work)

Confident, sharp, modern, culturally aware, slightly dry, human. Not corporate, not campy, not gimmicky. Friendship-first, not hookup-first. Write like you'd talk to a friend who gets it.
