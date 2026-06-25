import { readFile, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const generatedCapacitorConfigPath = path.join(
  repoRoot,
  'android',
  'app',
  'src',
  'main',
  'assets',
  'capacitor.config.json',
);
const appBuildGradlePath = path.join(repoRoot, 'android', 'app', 'build.gradle');
const googleServicesPath = path.join(repoRoot, 'android', 'app', 'google-services.json');
const manifestPath = path.join(repoRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const assetlinksPath = path.join(repoRoot, 'public', '.well-known', 'assetlinks.json');

const EXPECTED_APPLICATION_ID = 'com.hiitsme.app';

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

async function fileExists(filePath) {
  try {
    await access(filePath, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function assertBundledAndroidSync() {
  const generatedConfig = JSON.parse(await readFile(generatedCapacitorConfigPath, 'utf8'));
  if (generatedConfig.webDir !== 'dist') {
    throw new Error(`Expected generated Android webDir to be dist, received ${generatedConfig.webDir ?? 'unknown'}.`);
  }
  if (generatedConfig.server) {
    throw new Error('Generated Android Capacitor config still includes server.url. Release sync must stay bundled.');
  }
}

async function assertReleaseManifest() {
  const buildGradle = await readFile(appBuildGradlePath, 'utf8');

  const applicationIdMatch = buildGradle.match(/applicationId\s+["']([^"']+)["']/);
  if (!applicationIdMatch || applicationIdMatch[1] !== EXPECTED_APPLICATION_ID) {
    throw new Error(`Expected applicationId ${EXPECTED_APPLICATION_ID}, found ${applicationIdMatch?.[1] ?? 'none'}.`);
  }

  const versionCodeMatch = buildGradle.match(/versionCode\s+([^\s]+)/);
  const versionCodeRaw = versionCodeMatch?.[1] ?? '';
  // versionCode may be a literal (1) or read from an env override helper; only the
  // literal form is statically checkable. If it's a literal, it must be a positive int.
  if (/^\d+$/.test(versionCodeRaw)) {
    if (parseInt(versionCodeRaw, 10) < 1) {
      throw new Error(`versionCode must be a positive integer, found ${versionCodeRaw}.`);
    }
  }

  if (!(await fileExists(googleServicesPath))) {
    throw new Error('android/app/google-services.json is missing — FCM Android push will not work.');
  }
  const googleServices = JSON.parse(await readFile(googleServicesPath, 'utf8'));
  const packageNames = (googleServices.client ?? []).flatMap((client) =>
    client?.client_info?.android_client_info?.package_name
      ? [client.client_info.android_client_info.package_name]
      : [],
  );
  if (!packageNames.includes(EXPECTED_APPLICATION_ID)) {
    throw new Error(
      `google-services.json does not contain an Android client for ${EXPECTED_APPLICATION_ID} (found: ${packageNames.join(', ') || 'none'}).`,
    );
  }

  const manifest = await readFile(manifestPath, 'utf8');
  if (!manifest.includes('android.permission.POST_NOTIFICATIONS')) {
    throw new Error('AndroidManifest.xml is missing the POST_NOTIFICATIONS permission (Android 13+ push).');
  }

  if (await fileExists(assetlinksPath)) {
    const assetlinks = JSON.parse(await readFile(assetlinksPath, 'utf8'));
    const declaresPackage = JSON.stringify(assetlinks).includes(EXPECTED_APPLICATION_ID);
    if (!declaresPackage) {
      console.warn(
        `\n⚠️  public/.well-known/assetlinks.json does not reference ${EXPECTED_APPLICATION_ID}. App Links verification will fail.`,
      );
    }
  } else {
    console.warn('\n⚠️  public/.well-known/assetlinks.json not found — Android App Links will show a chooser.');
  }
}

async function main() {
  const steps = [
    ['npm', ['run', 'lint']],
    ['npm', ['run', 'test:unit']],
    ['npm', ['run', 'build']],
    ['npm', ['run', 'android:assets']],
    ['npm', ['run', 'android:sync']],
  ];

  for (const [command, args] of steps) {
    console.log(`\n==> ${command} ${args.join(' ')}`);
    await runCommand(command, args);
  }

  await assertBundledAndroidSync();
  await assertReleaseManifest();

  console.log('\nRepo-side Android preflight passed.');
  console.log('Manual release checklist:');
  console.log('- Bump versionCode (and versionName) for this release — see scripts/bump-android-version.mjs.');
  console.log('- Provide signing config: android/keystore.properties OR ANDROID_KEYSTORE_* env vars.');
  console.log('- Set FCM_SERVICE_ACCOUNT_JSON on the Supabase push-dispatch function (Android push).');
  console.log('- Confirm assetlinks.json uses the Play App Signing SHA-256 (Play Console → Setup → App signing).');
  console.log('- Build the bundle: npm run android:bundle:release → app/build/outputs/bundle/release/app-release.aab.');
  console.log('- Complete Play Console: Data safety, content rating, target audience, privacy policy URL, store listing.');
}

await main();
