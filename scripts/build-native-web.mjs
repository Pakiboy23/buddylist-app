import { cp, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'native-web');
const tempPrefix = path.join(os.tmpdir(), 'hiitsme-native-export-');
const tempExportDirName = '.next-native';
const excludedTopLevelEntries = new Set([
  '.git',
  '.next',
  '.next-native',
  'android',
  'ios',
  'native-web',
  'node_modules',
]);

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

async function createTempWorkspace() {
  const tempDir = await mkdtemp(tempPrefix);
  await cp(repoRoot, tempDir, {
    recursive: true,
    filter(sourcePath) {
      const relativePath = path.relative(repoRoot, sourcePath);
      if (!relativePath) {
        return true;
      }

      const topLevelEntry = relativePath.split(path.sep)[0];
      return !excludedTopLevelEntries.has(topLevelEntry);
    },
  });

  await rm(path.join(tempDir, 'src', 'app', 'api'), { recursive: true, force: true });
  await symlink(path.join(repoRoot, 'node_modules'), path.join(tempDir, 'node_modules'));
  return tempDir;
}

async function assertBuildArtifacts(staticExportDir) {
  const requiredFiles = [
    path.join(staticExportDir, 'index.html'),
    path.join(staticExportDir, 'hi-its-me', 'index.html'),
    path.join(staticExportDir, 'favicon.ico'),
    path.join(staticExportDir, 'manifest.webmanifest'),
  ];

  for (const requiredFile of requiredFiles) {
    try {
      await readFile(requiredFile);
    } catch {
      throw new Error(
        `Missing native export artifact: ${path.relative(repoRoot, requiredFile)}. Run \`NATIVE_STATIC_EXPORT=1 next build\` before bundling native web assets.`,
      );
    }
  }
}

async function main() {
  const tempDir = await createTempWorkspace();

  try {
    await runCommand('npx', ['next', 'build', '--webpack'], {
      cwd: tempDir,
      env: {
        ...process.env,
        NATIVE_STATIC_EXPORT: '1',
      },
    });

    const staticExportDir = path.join(tempDir, tempExportDirName);
    await assertBuildArtifacts(staticExportDir);
    await rm(outputDir, { recursive: true, force: true });
    await cp(staticExportDir, outputDir, { recursive: true });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  console.log('Native web bundle written to native-web/');
}

await main();
