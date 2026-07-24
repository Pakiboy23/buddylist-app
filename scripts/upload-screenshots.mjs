/**
 * upload-screenshots.mjs — push App Store screenshots to ASC via the API key.
 *
 * Runs on the Mac (where the PNGs and your .p8 key live). No npm deps — uses
 * Node's built-in crypto for the ES256 JWT.
 *
 * Uploads every *.png in DIR to the 2.1 App Store listing's 6.9"/6.7" set,
 * in filename order, SKIPPING anything named in EXCLUDE.
 *
 *   ASC_KEY=/path/to/AuthKey_ZL862UA586.p8 \
 *   EXCLUDE=08_away-message.png \
 *   node scripts/upload-screenshots.mjs
 *
 * Preview first without uploading:  DRY=1 ... node scripts/upload-screenshots.mjs
 *
 * Env:
 *   ASC_KEY     path to the .p8 (required)
 *   KEY_ID      default ZL862UA586
 *   ISSUER      default f42ab007-1295-4ecb-b309-023ddfdac034
 *   DIR         default screenshots/app-store/iphone-6.9
 *   EXCLUDE     comma-separated filenames to skip (e.g. the broken one)
 *   LOC         appStoreVersionLocalization id (default = 2.1 en-US)
 *   DISPLAY     screenshot display type (default APP_IPHONE_67 — accepts 1320×2868)
 *   DRY         set to 1 to list what would upload and stop
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const KEY_PATH = process.env.ASC_KEY;
const KEY_ID = process.env.KEY_ID ?? 'ZL862UA586';
const ISSUER = process.env.ISSUER ?? 'f42ab007-1295-4ecb-b309-023ddfdac034';
const DIR = process.env.DIR ?? 'screenshots/app-store/iphone-6.9';
const EXCLUDE = new Set((process.env.EXCLUDE ?? '').split(',').map((s) => s.trim()).filter(Boolean));
const LOC = process.env.LOC ?? '20d84707-c245-4f9a-a768-4bfa85783d81'; // 2.1 en-US
const DISPLAY = process.env.DISPLAY ?? 'APP_IPHONE_67';
const DRY = process.env.DRY === '1';
const BASE = 'https://api.appstoreconnect.apple.com';

if (!KEY_PATH || !fs.existsSync(KEY_PATH)) { console.error('Set ASC_KEY to your .p8 path.'); process.exit(1); }
const KEY = fs.readFileSync(KEY_PATH, 'utf8');

const b64url = (b) => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
function token() {
  const header = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: ISSUER, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = crypto.createSign('SHA256').update(input).sign({ key: KEY, dsaEncoding: 'ieee-p1363' });
  return `${input}.${b64url(sig)}`;
}
async function api(p, method = 'GET', body) {
  const r = await fetch(BASE + p, {
    method,
    headers: { Authorization: `Bearer ${token()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const t = await r.text();
  let j; try { j = t ? JSON.parse(t) : {}; } catch { j = { raw: t }; }
  if (r.status >= 300) throw new Error(`${method} ${p} → ${r.status} ${JSON.stringify(j.errors?.[0]?.detail || j).slice(0, 300)}`);
  return j;
}

async function ensureSet() {
  const sets = await api(`/v1/appStoreVersionLocalizations/${LOC}/appScreenshotSets?fields[appScreenshotSets]=screenshotDisplayType`);
  const found = (sets.data || []).find((s) => s.attributes.screenshotDisplayType === DISPLAY);
  if (found) return found.id;
  const created = await api('/v1/appScreenshotSets', 'POST', {
    data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: DISPLAY },
      relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: LOC } } } },
  });
  return created.data.id;
}

async function uploadOne(setId, file) {
  const buf = fs.readFileSync(file);
  const fileName = path.basename(file);
  const md5 = crypto.createHash('md5').update(buf).digest('hex');
  // 1. reserve
  const res = await api('/v1/appScreenshots', 'POST', {
    data: { type: 'appScreenshots', attributes: { fileName, fileSize: buf.length },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } } } },
  });
  const id = res.data.id;
  const ops = res.data.attributes.uploadOperations || [];
  // 2. upload the bytes per operation
  for (const op of ops) {
    const headers = {};
    for (const h of op.requestHeaders || []) headers[h.name] = h.value;
    const chunk = buf.subarray(op.offset, op.offset + op.length);
    const put = await fetch(op.url, { method: op.method || 'PUT', headers, body: chunk });
    if (put.status >= 300) throw new Error(`upload PUT ${fileName} → ${put.status}`);
  }
  // 3. commit
  await api(`/v1/appScreenshots/${id}`, 'PATCH', {
    data: { type: 'appScreenshots', id, attributes: { uploaded: true, sourceFileChecksum: md5 } },
  });
  console.log(`  ✓ ${fileName} (${(buf.length / 1024).toFixed(0)} KB)`);
}

async function main() {
  const files = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.png') && !EXCLUDE.has(f)).sort();
  const skipped = fs.readdirSync(DIR).filter((f) => EXCLUDE.has(f));
  console.log(`Uploading ${files.length} screenshot(s) from ${DIR} → 2.1 listing, set ${DISPLAY}`);
  if (skipped.length) console.log(`Skipping (EXCLUDE): ${skipped.join(', ')}`);
  files.forEach((f) => console.log(`  • ${f}`));
  if (DRY) { console.log('\nDRY run — nothing uploaded.'); return; }
  const setId = await ensureSet();
  for (const f of files) await uploadOne(setId, path.join(DIR, f));
  console.log('\nDone. Review the 2.1 version in App Store Connect before submitting.');
}
main().catch((e) => { console.error('\nERROR:', e.message); process.exit(1); });
