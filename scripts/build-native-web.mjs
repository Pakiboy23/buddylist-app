/**
 * Native web bundle build script.
 *
 * Previously: ran Next.js static export into a temp workspace, stripped API routes,
 * and copied the output to native-web/.
 *
 * Now: Vite outputs directly to dist/ with a clean build. This script is a thin
 * wrapper that runs `vite build` and asserts the required Capacitor artifacts exist.
 *
 * Usage:
 *   npm run native:web:build          # builds dist/ for Capacitor
 *   npm run ios:sync                  # builds then syncs to iOS project
 */

import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'dist');

function runCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? 'unknown'}`));
    });
  });
}

async function assertBuildArtifacts() {
  const requiredFiles = [
    path.join(outputDir, 'index.html'),
    path.join(outputDir, 'favicon.ico'),
    path.join(outputDir, 'manifest.webmanifest'),
  ];

  for (const requiredFile of requiredFiles) {
    try {
      await readFile(requiredFile);
    } catch {
      throw new Error(
        `Missing build artifact: ${path.relative(repoRoot, requiredFile)}. Check that vite build completed successfully.`,
      );
    }
  }
}

async function main() {
  await runCommand('npx', ['vite', 'build'], { cwd: repoRoot });
  await assertBuildArtifacts();
  console.log('Native web bundle written to dist/');
}

await main();
