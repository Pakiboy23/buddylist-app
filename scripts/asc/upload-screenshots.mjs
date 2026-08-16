// Upload App Store screenshots to a version localization via the ASC API.
// Reserve -> PUT bytes -> commit (uploaded:true + md5), per image.
//
//   ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH  (env, as in asc.mjs)
//   node scripts/asc/upload-screenshots.mjs <localizationId> <displayType> <file1> <file2> ...
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { sign as cryptoSign, createHash } from 'node:crypto';

const keyId = process.env.ASC_KEY_ID;
const issuerId = process.env.ASC_ISSUER_ID;
const keyPath = process.env.ASC_KEY_PATH;
const [LOC, DISPLAY, ...FILES] = process.argv.slice(2);
if (!keyId || !issuerId || !keyPath || !LOC || !DISPLAY || !FILES.length) {
  console.error('Missing env or args. Usage: node upload-screenshots.mjs <locId> <displayType> <files...>');
  process.exit(2);
}

function jwt() {
  const pk = readFileSync(keyPath, 'utf8');
  const b64 = (o) => Buffer.from(o).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b64(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const body = b64(JSON.stringify({ iss: issuerId, iat: now, exp: now + 1140, aud: 'appstoreconnect-v1' }));
  const sig = cryptoSign('SHA256', Buffer.from(`${head}.${body}`), { key: pk, dsaEncoding: 'ieee-p1363' });
  return `${head}.${body}.${b64(sig)}`;
}
async function api(method, path, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

// 1. Find or create the screenshot set for this display type
const sets = await api('GET', `/v1/appStoreVersionLocalizations/${LOC}/appScreenshotSets?fields[appScreenshotSets]=screenshotDisplayType&limit=50`);
let set = (sets.data || []).find((s) => s.attributes.screenshotDisplayType === DISPLAY);
if (set) {
  console.log(`reusing existing ${DISPLAY} set ${set.id}`);
} else {
  const created = await api('POST', '/v1/appScreenshotSets', {
    data: {
      type: 'appScreenshotSets',
      attributes: { screenshotDisplayType: DISPLAY },
      relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: LOC } } },
    },
  });
  set = created.data;
  console.log(`created ${DISPLAY} set ${set.id}`);
}

// 2. Upload each file: reserve -> PUT -> commit
for (const file of FILES) {
  const bytes = readFileSync(file);
  const name = basename(file);
  const reserved = await api('POST', '/v1/appScreenshots', {
    data: {
      type: 'appScreenshots',
      attributes: { fileName: name, fileSize: bytes.length },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } },
    },
  });
  const shot = reserved.data;
  const ops = shot.attributes.uploadOperations || [];
  for (const op of ops) {
    const headers = {};
    for (const h of op.requestHeaders || []) headers[h.name] = h.value;
    const chunk = bytes.subarray(op.offset, op.offset + op.length);
    const put = await fetch(op.url, { method: op.method, headers, body: chunk });
    if (!put.ok) throw new Error(`PUT ${name} -> ${put.status}: ${(await put.text()).slice(0, 200)}`);
  }
  const md5 = createHash('md5').update(bytes).digest('hex');
  await api('PATCH', `/v1/appScreenshots/${shot.id}`, {
    data: { type: 'appScreenshots', id: shot.id, attributes: { uploaded: true, sourceFileChecksum: md5 } },
  });
  console.log(`  uploaded ${name} (${bytes.length} bytes) -> ${shot.id}`);
}
console.log('ALL UPLOADED');
