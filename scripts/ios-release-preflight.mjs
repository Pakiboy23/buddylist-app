import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const generatedCapacitorConfigPath = path.join(
  repoRoot,
  'ios',
  'App',
  'App',
  'capacitor.config.json',
);
const infoPlistPath = path.join(repoRoot, 'ios', 'App', 'App', 'Info.plist');
const pbxprojPath = path.join(repoRoot, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env,
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

async function assertBundledIosSync() {
  const generatedConfig = JSON.parse(await readFile(generatedCapacitorConfigPath, 'utf8'));
  if (generatedConfig.webDir !== 'native-web') {
    throw new Error(`Expected generated iOS webDir to be native-web, received ${generatedConfig.webDir ?? 'unknown'}.`);
  }
  if (generatedConfig.server) {
    throw new Error('Generated iOS Capacitor config still includes server.url. Release sync must stay bundled.');
  }

  const infoPlist = await readFile(infoPlistPath, 'utf8');
  if (infoPlist.includes('UISupportedInterfaceOrientations~ipad')) {
    throw new Error('Info.plist still advertises iPad orientations.');
  }
  if (infoPlist.includes('UIInterfaceOrientationLandscape')) {
    throw new Error('Info.plist still advertises landscape orientations.');
  }

  const pbxproj = await readFile(pbxprojPath, 'utf8');
  if (
    !pbxproj.includes('TARGETED_DEVICE_FAMILY = "1";') &&
    !pbxproj.includes('TARGETED_DEVICE_FAMILY = 1;')
  ) {
    throw new Error('Xcode project is not restricted to iPhone device family.');
  }
}

async function main() {
  const steps = [
    ['npm', ['run', 'lint']],
    ['npm', ['run', 'test:unit']],
    ['npm', ['run', 'build']],
    ['npm', ['run', 'ios:assets']],
    ['npm', ['run', 'ios:sync']],
  ];

  for (const [command, args] of steps) {
    console.log(`\n==> ${command} ${args.join(' ')}`);
    await runCommand(command, args);
  }

  await assertBundledIosSync();

  console.log('\nRepo-side iOS preflight passed.');
  console.log('Manual release checklist:');
  console.log('- Set the final Version and Build in Xcode.');
  console.log('- Confirm Apple Developer team/signing for the App target.');
  console.log('- Complete App Store privacy answers, support URL, privacy policy, and screenshots.');
  console.log('- Archive from Xcode and validate the uploaded build in TestFlight.');
}

await main();
