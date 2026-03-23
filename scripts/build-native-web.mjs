import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const nextServerAppDir = path.join(repoRoot, '.next', 'server', 'app');
const nextStaticDir = path.join(repoRoot, '.next', 'static');
const publicDir = path.join(repoRoot, 'public');
const outputDir = path.join(repoRoot, 'native-web');

async function copyFile(sourcePath, targetPath) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath);
}

async function writeTextFile(sourcePath, targetPath) {
  const body = await readFile(sourcePath, 'utf8');
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, body, 'utf8');
}

async function assertBuildArtifacts() {
  const requiredFiles = [
    path.join(nextServerAppDir, 'index.html'),
    path.join(nextServerAppDir, 'buddy-list.html'),
    path.join(nextServerAppDir, 'favicon.ico.body'),
    path.join(nextServerAppDir, 'manifest.webmanifest.body'),
  ];

  for (const requiredFile of requiredFiles) {
    try {
      await readFile(requiredFile);
    } catch {
      throw new Error(
        `Missing Next build artifact: ${path.relative(repoRoot, requiredFile)}. Run \`npm run build\` before bundling native web assets.`,
      );
    }
  }
}

async function main() {
  await assertBuildArtifacts();
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  await cp(publicDir, outputDir, { recursive: true });
  await cp(nextStaticDir, path.join(outputDir, '_next', 'static'), { recursive: true });

  await copyFile(path.join(nextServerAppDir, 'index.html'), path.join(outputDir, 'index.html'));
  await copyFile(path.join(nextServerAppDir, 'buddy-list.html'), path.join(outputDir, 'buddy-list', 'index.html'));
  await copyFile(path.join(nextServerAppDir, 'buddy-list.html'), path.join(outputDir, 'buddy-list.html'));
  await copyFile(path.join(nextServerAppDir, '_not-found.html'), path.join(outputDir, '404.html'));

  await writeTextFile(path.join(nextServerAppDir, 'manifest.webmanifest.body'), path.join(outputDir, 'manifest.webmanifest'));
  await copyFile(path.join(nextServerAppDir, 'favicon.ico.body'), path.join(outputDir, 'favicon.ico'));

  console.log('Native web bundle written to native-web/');
}

await main();
