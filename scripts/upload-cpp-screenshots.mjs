/**
 * upload-cpp-screenshots.mjs — push screenshots to the 4 Custom Product Pages.
 *
 * CPP-ONLY. Does NOT touch the main listing. Each CPP gets its tailored subset
 * (per marketing/release-2-1/custom-product-pages/cpp-strategy.md §2), uploaded
 * in the page's own order. No npm deps (built-in-crypto ES256 JWT).
 *
 * Runs on the Mac, where the PNGs + your .p8 live:
 *
 *   ASC_KEY="$HOME/Desktop/AuthKey_ZL862UA586.p8" \
 *   DIR="$HOME/Desktop/HIM-asc-screenshots" \
 *   DRY=1 node scripts/upload-cpp-screenshots.mjs        # preview, uploads nothing
 *   # then drop DRY=1 to upload.
 *
 * EDIT `FILES` below so each role points at your actual filename in DIR. Roles
 * with an empty value or a missing file are skipped (logged). EXCLUDE also skips.
 *
 * Env: ASC_KEY (req), KEY_ID, ISSUER, DIR, EXCLUDE, DISPLAY (default
 * APP_IPHONE_67 — accepts 1320×2868), DRY=1.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ── role → your filename in DIR (EDIT to match what you captured) ──────────────
const FILES = {
  hero:       '02_buddylist-hero.png',  // native presence-first BuddyList hero
  circles:    '04_buddy-list.png',      // Buddy Circles (they render on the list)
  knock:      '05_direct-message.png',  // DM showing the Knock button
  rooms:      '06_chat-rooms.png',      // rooms list
  chatroom:   '06_chat-rooms.png',      // in-room view (swap if you shot one)
  mutual:     '07_profile-mutual.png',  // profile sheet + mutual context
  away:       '08_away-message.png',    // away-message composer
  screenname: '',                       // add filename if captured
  notif:      '',                       // notification-preview settings
  awayreply:  '',                       // away-message reply
};

// ── per-CPP ordered subsets (cpp-strategy.md §2) ──────────────────────────────
const PAGES = [
  { name: 'Sorted',             id: 'f3c32019-fe92-4bfc-a0ed-3c5c33693c52', roles: ['circles', 'hero', 'away', 'rooms', 'mutual'] },
  { name: 'New City',           id: 'b33c3788-7503-4809-bd72-7eacce86b78f', roles: ['rooms', 'chatroom', 'screenname', 'hero'] },
  { name: 'Quiet Hello',        id: '95bc6d08-a349-471a-b47f-e33a11e10bc3', roles: ['knock', 'away', 'notif', 'hero'] },
  { name: 'Buddy List, Reborn', id: '3b2d7d52-f879-4628-8f95-792261e9bff2', roles: ['hero', 'circles', 'knock', 'awayreply', 'chatroom', 'mutual'] },
];

const KEY_PATH = process.env.ASC_KEY;
const KEY_ID = process.env.KEY_ID ?? 'ZL862UA586';
const ISSUER = process.env.ISSUER ?? 'f42ab007-1295-4ecb-b309-023ddfdac034';
const DIR = process.env.DIR ?? 'screenshots/app-store/iphone-6.9';
const EXCLUDE = new Set((process.env.EXCLUDE ?? '').split(',').map((s) => s.trim()).filter(Boolean));
const DISPLAY = process.env.DISPLAY ?? 'APP_IPHONE_67';
const DRY = process.env.DRY === '1';
const BASE = 'https://api.appstoreconnect.apple.com';

if (!KEY_PATH || !fs.existsSync(KEY_PATH)) { console.error('Set ASC_KEY to your .p8 path.'); process.exit(1); }
const KEY = fs.readFileSync(KEY_PATH, 'utf8');

const b64url = (b) => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
function token() {
  const now = Math.floor(Date.now() / 1000);
  const input = `${b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }))}.${b64url(JSON.stringify({ iss: ISSUER, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' }))}`;
  return `${input}.${b64url(crypto.createSign('SHA256').update(input).sign({ key: KEY, dsaEncoding: 'ieee-p1363' }))}`;
}
async function api(p, method = 'GET', body) {
  const r = await fetch(BASE + p, { method, headers: { Authorization: `Bearer ${token()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const t = await r.text(); let j; try { j = t ? JSON.parse(t) : {}; } catch { j = { raw: t }; }
  if (r.status >= 300) throw new Error(`${method} ${p} → ${r.status} ${JSON.stringify(j.errors?.[0]?.detail || j).slice(0, 300)}`);
  return j;
}

async function locForPage(id) {
  const v = await api(`/v1/appCustomProductPages/${id}/appCustomProductPageVersions?limit=1`);
  const vid = v.data?.[0]?.id;
  if (!vid) throw new Error('no version');
  const loc = await api(`/v1/appCustomProductPageVersions/${vid}/appCustomProductPageLocalizations?fields[appCustomProductPageLocalizations]=locale`);
  const en = (loc.data || []).find((l) => l.attributes?.locale === 'en-US') || loc.data?.[0];
  if (!en) throw new Error('no localization');
  return en.id;
}
async function ensureSet(locId) {
  const sets = await api(`/v1/appCustomProductPageLocalizations/${locId}/appScreenshotSets?fields[appScreenshotSets]=screenshotDisplayType`);
  const found = (sets.data || []).find((s) => s.attributes.screenshotDisplayType === DISPLAY);
  if (found) return found.id;
  const created = await api('/v1/appScreenshotSets', 'POST', { data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: DISPLAY }, relationships: { appCustomProductPageLocalization: { data: { type: 'appCustomProductPageLocalizations', id: locId } } } } });
  return created.data.id;
}
async function uploadOne(setId, file) {
  const buf = fs.readFileSync(file);
  const fileName = path.basename(file);
  const md5 = crypto.createHash('md5').update(buf).digest('hex');
  const res = await api('/v1/appScreenshots', 'POST', { data: { type: 'appScreenshots', attributes: { fileName, fileSize: buf.length }, relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } } } } });
  const id = res.data.id;
  for (const op of res.data.attributes.uploadOperations || []) {
    const headers = {}; for (const h of op.requestHeaders || []) headers[h.name] = h.value;
    const put = await fetch(op.url, { method: op.method || 'PUT', headers, body: buf.subarray(op.offset, op.offset + op.length) });
    if (put.status >= 300) throw new Error(`PUT ${fileName} → ${put.status}`);
  }
  await api(`/v1/appScreenshots/${id}`, 'PATCH', { data: { type: 'appScreenshots', id, attributes: { uploaded: true, sourceFileChecksum: md5 } } });
  console.log(`    ✓ ${fileName}`);
}

function resolveFiles(roles) {
  const out = [];
  for (const role of roles) {
    const fn = FILES[role];
    if (!fn) { console.log(`    – ${role}: no filename mapped (skip)`); continue; }
    if (EXCLUDE.has(fn)) { console.log(`    – ${role} → ${fn}: EXCLUDEd (skip)`); continue; }
    const full = path.join(DIR, fn);
    if (!fs.existsSync(full)) { console.log(`    – ${role} → ${fn}: not found in DIR (skip)`); continue; }
    out.push(full);
  }
  return out;
}

async function main() {
  console.log(`CPP screenshot upload — DIR=${DIR}, set=${DISPLAY}${DRY ? '  [DRY RUN]' : ''}\n`);
  for (const page of PAGES) {
    console.log(`▸ ${page.name}`);
    const files = resolveFiles(page.roles);
    if (DRY) { files.forEach((f) => console.log(`    • ${path.basename(f)}`)); continue; }
    if (!files.length) { console.log('    (nothing to upload)'); continue; }
    const locId = await locForPage(page.id);
    const setId = await ensureSet(locId);
    for (const f of files) await uploadOne(setId, f);
  }
  console.log(DRY ? '\nDRY run — nothing uploaded.' : '\nDone. Review each CPP in App Store Connect, then submit each for review.');
}
main().catch((e) => { console.error('\nERROR:', e.message); process.exit(1); });
