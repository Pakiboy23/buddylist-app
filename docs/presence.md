# Presence, Browse, and privacy

How H.I.M. decides Available / Idle / Away / Offline — and what other people are allowed to see.

Live derivation: `src/lib/presence.ts`.
Browse cards: `src/lib/browsePresence.ts` + `src/components/BrowsePanel.tsx`.
Directory gates: `src/lib/discoverableSearch.ts`.
Schema: `supabase/migrations/20260907000001_show_online_status.sql`.

## Intent

Presence is a social signal, not a leftover `users.status` string. A chip that says Available next to a 12-day-old `last_active_at` is a lie. Away messages are authored expression and stay readable even while the author is offline.

Two independent privacy flags:

| Flag | Column | Default | What it controls |
|---|---|---|---|
| Appear in Browse & Search | `users.discoverable` | `true` | Whether global people lookups can return you at all |
| Show my online status | `users.show_online_status` | `true` | Whether other viewers see chips, idle, and last-active times |

Turning online-status off does **not** hide the away-message text. Own profile always sees the truth.

Settings copy lives next to Discoverable in the buddy-shell privacy card (`src/app/hi-its-me/page.tsx`).

## How a chip is derived

`resolvePresenceState({ isOnline, status, idleSince })` is the ordered rule:

1. not signed on → `offline`
2. `status` is `"away"` (case-insensitive) → `away`
3. `idle_since` is a non-empty string → `idle`
4. else → `available`

`derivePresenceState()` is the single entry for every chip and filter. Prefer an explicit realtime `isOnline` when the caller has it (buddy list). Otherwise infer signed-on from `last_active_at` newer than **24 hours** (`PRESENCE_LAST_ACTIVE_ONLINE_MS`). Browse cards do not subscribe to the presence channel, so that cutoff is what stops a leftover Available from reading as live.

Buddy-list `isOnline` is `onlineUserIds.has(id) && show_online_status !== false`. The global presence channel untracks when the owner turns the toggle off, so they stop appearing in other clients' `onlineUserIds` as well as being masked in the UI.

Activity heartbeat (`LAST_ACTIVE_WRITE_INTERVAL_MS` in `page.tsx`) writes `last_active_at` at most once a minute on pointer / key / touch / mouse activity. Anyone actually around stays well inside the 24h window.

## What other viewers see

```
resolveVisiblePresence()
  └─ canViewerSeeActivity(showOnlineStatus, { isSelf })
       own profile → always true
       missing / null / true → visible (legacy rows)
       false → maskPresenceSignals() nulls isOnline, status, idle_since, last_active_at
```

Browse maps a masked row to chip `'hidden'` (no Available / Away now / last-active relative time). Authored `away_message` still renders.

### Postgres is not column-private

RLS is row-level. Raw `users.status`, `last_active_at`, and `idle_since` remain readable on the table. Do not treat a `select` from `public.users` as privacy-safe.

Directory-safe reads:

- View `public.user_presence_directory` already nulls those three columns for other viewers when `show_online_status` is false. Away message stays visible.
- App-layer mask in `src/lib/presence.ts` is required on any surface that still reads `public.users` directly (Browse currently does, then runs `describeBrowseCard()`).

`can_see_presence(viewer, subject)` also requires the legacy `user_connections` grant. Do not build new presence UI on `user_connections` — live social graph is `buddies`. The toggle is the part new code must honor.

## Find / Browse vs Search

Find (`bodyShellSection === 'buddy'`) is People first, Search second, Requests as a badge.

| Surface | Discoverable gate | Away-message required | Notes |
|---|---|---|---|
| Browse (`BrowsePanel`) | yes | yes | Presence board. Ordered by `last_active_at`. Client filters (All / Away now / Available, mood, activity) only see loaded pages — keep paging while the current page is empty (`shouldFillBrowseFilterPages`). |
| Search (`SearchPanel`) | yes | no | Known-screenname lookup. A set name should still resolve after opt-in. |
| Buddy-shell people search (`page.tsx` `handleSearch`) | yes | no | Same `applyDiscoverablePeopleGate` helper. Do not add an unscoped `ilike`. |

`applyDiscoverablePeopleGate` / `applyBrowseAwayMessageRequired` are the contract. Any new global people lookup that skips them makes opt-out a no-op.

Blocked accounts are excluded client-side from Browse and Search. Buddy-list filters are local and do not use these gates.

### First-session away nudge

Accounts younger than 24h (`isFirstSession`, from `auth.users.created_at`) with no accepted buddies land on Find. Browse shows a "Set an away message so people can find you" card until they have a line.

Flags `him.firstSession.awayNudgeShown:<userId>` and `him.firstSession.awaySetLogged:<userId>` are **per account** on this install so a shared device does not undercount. Events: `him_first_session_away_nudge_shown`, `him_away_message_set` (`src/lib/productEvents.ts`).

## Constraints

- Do not drive chips from `users.status` alone.
- Do not invent a "live now" count from presence. `himArtDirection.ts` hard-codes honesty here on purpose.
- Missing `show_online_status` (schema cache) is treated as visible; Browse falls back to a select without the column (`isShowOnlineStatusColumnMissingError`).
- Export includes `discoverable` and `show_online_status` (`supabase/functions/export-account`).

## Tests

- `src/lib/presence.test.ts` — derivation, 24h cutoff, privacy mask, authored status notes
- `src/lib/browsePresence.test.ts` — chips, hidden activity, filter paging
- `src/lib/discoverableSearch.test.ts` — Browse vs Search gates
- `src/lib/firstSessionAway.test.ts` — per-account flags
- `src/lib/profileSchema.test.ts` — missing-column fallback
