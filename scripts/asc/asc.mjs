#!/usr/bin/env node
// Minimal App Store Connect API client (no dependencies, no fastlane).
//
// Generates a short-lived ES256 JWT from an App Store Connect API key (.p8) and
// makes a single authenticated request. Credentials come from the environment so
// nothing secret is ever hard-coded or committed:
//
//   ASC_KEY_ID     10-char key id (e.g. LMT6SQA4GV)
//   ASC_ISSUER_ID  team-wide issuer id (UUID)
//   ASC_KEY_PATH   path to the .p8 private key (gitignored, e.g. fastlane/.keys/AuthKey_*.p8)
//
// Usage:
//   node scripts/asc/asc.mjs GET  /v1/apps
//   node scripts/asc/asc.mjs PATCH /v1/appStoreVersionLocalizations/ID body.json
//
// The JWT and key bytes are never printed — only the HTTP status and response body.
import { readFileSync } from 'node:fs';
import { sign as cryptoSign } from 'node:crypto';

const keyId = process.env.ASC_KEY_ID;
const issuerId = process.env.ASC_ISSUER_ID;
const keyPath = process.env.ASC_KEY_PATH;
if (!keyId || !issuerId || !keyPath) {
  console.error('Missing env: set ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH');
  process.exit(2);
}

const privateKey = readFileSync(keyPath, 'utf8');
const b64url = (buf) => Buffer.from(buf).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
const payload = { iss: issuerId, iat: now, exp: now + 1140, aud: 'appstoreconnect-v1' };
const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
// ASC requires JOSE/IEEE-P1363 (raw r||s) signatures, not DER.
const signature = cryptoSign('SHA256', Buffer.from(signingInput), { key: privateKey, dsaEncoding: 'ieee-p1363' });
const jwt = `${signingInput}.${b64url(signature)}`;

const method = (process.argv[2] || 'GET').toUpperCase();
const path = process.argv[3];
const bodyFile = process.argv[4];
if (!path) {
  console.error('Usage: node scripts/asc/asc.mjs <METHOD> <PATH> [bodyFile.json]');
  process.exit(2);
}

const url = path.startsWith('http') ? path : `https://api.appstoreconnect.apple.com${path}`;
const opts = { method, headers: { Authorization: `Bearer ${jwt}` } };
if (bodyFile) {
  opts.headers['Content-Type'] = 'application/json';
  opts.body = readFileSync(bodyFile, 'utf8');
}

const res = await fetch(url, opts);
const text = await res.text();
console.log('HTTP', res.status);
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text);
}
