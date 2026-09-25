# Buddy list

Flat Online / Offline list. There is no Add Buddy modal and no Circles product
UI.

## Add a buddy

| Surface | What happens |
|---|---|
| Find → Browse | `BrowsePanel` → `DiscoveryProfileSheet` → `sendOrAcceptBuddyRequest()` |
| Find → Search | `SearchPanel` → same sheet / helper |
| Buddy / room profile sheet | "Add Buddy" via `handleAddBuddyById` or `sendOrAcceptBuddyRequest` |
| Incoming request row | Accept both directions (`acceptIncomingBuddyRequest`) |
| In-list "Find a Buddy" field | Filters the signed-in list in place. Not a search modal. |

Shared write path: `src/lib/buddyRequest.ts`. Graph is `public.buddies`
(asymmetric). `pending` is one directional row; `accepted` writes both
directions, but some mirrors are missing — treat an accepted row in either
direction as friends.

The old `showAddWindow` modal is gone (#173).
`src/lib/deadAdminReset.guard.test.ts` forbids bringing it back.

## List grouping

`src/lib/buddyListGroups.ts` builds **Online** and **Offline** sections
(`isSignedOn`). Search narrows visible rows without changing header totals.

Buddy Circles UI (`BuddyCircles.tsx`, `buddyCircles.ts`) was deleted in #174.
Postgres still has `buddy_circles` / `buddy_circle_members` from
`20260722130125_buddy_circles.sql`. Those tables are unused. Do not restore
the product surface on top of empty tables.

## Room invites (not links)

Accepted buddies can be pulled into a room they are not already in:

- Client: `src/lib/roomsInvite.ts` → Edge Function `rooms-invite`
- Body: `POST { roomId, buddyIds }`
- Function confirms an accepted `buddies` row in either direction

There are no shareable invite URLs. `/join/:inviteCode` navigates to
`/hi-its-me/rooms` and discards the code.

Safari "Load failed" on the invite sheet is a **deployed-function CORS
miss**. The function source allows `apikey`; an older deploy that only
allowed `authorization, content-type` will fail the POST after OPTIONS 204.
