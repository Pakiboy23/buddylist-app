# Chat media privacy rollout

Plan to take DM media (photos, videos, voice notes in the `chat-media` bucket)
from **public-by-URL** to **private + signed URLs** without breaking clients.

## Why

Supabase linter 0025 flagged both storage buckets, and the deeper issue is that
`chat-media` is a public bucket: anyone with an object URL can fetch DM media
without authentication, and (before migration `20260703000002`) any signed-in
user could list and download every object. For a community messaging app this
is the single biggest privacy exposure.

`buddy-icons` stays public by design — avatars are shown to other users and the
exposure is limited to profile images. Its policies were still tightened
(owner-scoped SELECT, own-prefix INSERT) to remove bucket-wide listing.

## Phases

### ✅ Phase 1 — scoped storage policies (migration `20260703000002`)

- `chat-media` SELECT: owner, DM participant (via `message_attachments` →
  `messages`), or room attachment. Kills bucket-wide listing and enables
  participant-scoped signed URLs.
- `chat-media` INSERT: only under the caller's own `<uid>/...` prefix.
- `buddy-icons`: owner-scoped SELECT, own-prefix INSERT.
- **Buckets remain public.** Public URL fetches bypass RLS, so nothing breaks.

### ✅ Phase 2 — signed-URL client

- `src/lib/chatMediaUrl.ts` — `resolveChatMediaUrl()` signs (6 h TTL, in-memory
  cache, in-flight dedupe) and falls back to the public URL on any failure.
- `src/hooks/useChatMediaUrl.ts` — paints with the best synchronous URL, swaps
  to the signed URL when resolved.
- `ChatWindow` attachment previews and the media gallery use signed URLs.
- Buddy icons intentionally stay on `getPublicUrl`.

### ⏳ Phase 3 — flip the bucket private (MANUAL, gated)

**Preconditions:**
1. Phase 2 client is live on web (auto via Vercel).
2. An iOS build containing Phase 2 is **released on the App Store and adopted**
   — older iOS builds render media via public URLs and WILL break the moment
   the bucket is private. Check adoption in App Store Connect first.
3. Android launches with Phase 2 built in (any Play build from this commit
   forward), so no gating needed there.

**The flip:**

```sql
update storage.buckets set public = false where id = 'chat-media';
```

**Rollback** (instant, safe): set `public = true` again.

**After the flip, verify:**
- Signed-in user A can view media in a DM with B (signed URL renders).
- A signed-out `curl` of an old public URL
  (`/storage/v1/object/public/chat-media/...`) returns 400/404.
- A third signed-in user C cannot `createSignedUrl` for A↔B's object
  (RLS denies — error surfaces as the public-URL fallback, which now 400s).

## Notes

- Old messages keep working after the flip: attachments are stored as
  `bucket` + `storage_path` in `message_attachments` and URLs are generated at
  render time — nothing persistent embeds a public URL.
- `getChatMediaPublicUrl` fallback keeps the app functional if signing is ever
  unavailable *while the bucket is public*; after the flip it degrades to a
  broken image rather than an error loop, and the next render re-attempts
  signing.
- Data Safety / privacy docs: once Phase 3 lands, message media is no longer
  world-readable by URL; no disclosure change required (it was already declared
  "collected", not "shared").
