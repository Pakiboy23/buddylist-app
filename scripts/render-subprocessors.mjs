#!/usr/bin/env node
/**
 * Reads docs/compliance/sub-processors.json and emits an HTML table fragment,
 * then injects it into public/privacy.html between
 *   <!-- SUBPROCESSORS:START --> ... <!-- SUBPROCESSORS:END -->
 *
 * Usage:
 *   node scripts/render-subprocessors.mjs
 *
 * The markers must already exist in privacy.html. Re-running the script is
 * safe — it replaces only the content between the markers.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jsonPath  = resolve(root, 'docs/compliance/sub-processors.json');
const htmlPath  = resolve(root, 'public/privacy.html');

const processors = JSON.parse(readFileSync(jsonPath, 'utf8'));

function esc(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderRow(p) {
  const statusBadge = p.status === 'planned'
    ? ' <span style="font-size:0.75rem;opacity:0.55;font-style:italic;">(planned)</span>'
    : '';
  const certStr = p.certifications?.length
    ? `<br><span style="font-size:0.8rem;opacity:0.6;">${p.certifications.map(esc).join(', ')}</span>`
    : '';
  return `            <tr>
              <td><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.name)}</a>${statusBadge}${certStr}</td>
              <td>${esc(p.purpose)}</td>
              <td>${esc(p.location)}</td>
              <td>${esc(p.transfer_mechanism)}</td>
              <td style="font-size:0.85rem;">${esc(p.data_processed)}</td>
            </tr>`;
}

const table = `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sub-processor</th>
                  <th>Purpose</th>
                  <th>Location</th>
                  <th>Transfer mechanism</th>
                  <th>Data processed</th>
                </tr>
              </thead>
              <tbody>
${processors.map(renderRow).join('\n')}
              </tbody>
            </table>
          </div>
          <p style="margin-top:1rem;font-size:0.875rem;opacity:0.7;">
            All libraries used in the app that operate solely on your device
            (Capacitor, jose, @aparajita/capacitor-biometric-auth, bad-words)
            transmit no data to third parties and are not listed above.
          </p>
          <p style="margin-top:0.5rem;font-size:0.875rem;opacity:0.7;">
            This table is generated from
            <code>docs/compliance/sub-processors.json</code>.
            To update it, edit that file and re-run
            <code>node scripts/render-subprocessors.mjs</code>.
          </p>`.trimEnd();

const START = '<!-- SUBPROCESSORS:START -->';
const END   = '<!-- SUBPROCESSORS:END -->';

const html = readFileSync(htmlPath, 'utf8');

if (!html.includes(START) || !html.includes(END)) {
  console.error(`Error: markers ${START} … ${END} not found in ${htmlPath}`);
  process.exit(1);
}

const updated = html.replace(
  new RegExp(`${START}[\\s\\S]*?${END}`),
  `${START}\n${table}\n          ${END}`,
);

writeFileSync(htmlPath, updated, 'utf8');
console.log(`✓ Sub-processors table injected into ${htmlPath}`);
console.log(`  ${processors.filter(p => p.status === 'active').length} active, ${processors.filter(p => p.status === 'planned').length} planned`);
