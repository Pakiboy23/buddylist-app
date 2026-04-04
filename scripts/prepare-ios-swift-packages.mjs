import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const vendorRoot = path.join(repoRoot, 'ios', 'App', 'CapacitorVendor');
const capAppPackagePath = path.join(repoRoot, 'ios', 'App', 'CapApp-SPM', 'Package.swift');

const packages = [
  {
    source: path.join(repoRoot, 'node_modules', '@aparajita', 'capacitor-biometric-auth'),
    vendorDir: 'AparajitaCapacitorBiometricAuth',
    packageName: 'AparajitaCapacitorBiometricAuth',
  },
  {
    source: path.join(repoRoot, 'node_modules', '@capacitor', 'haptics'),
    vendorDir: 'CapacitorHaptics',
    packageName: 'CapacitorHaptics',
  },
  {
    source: path.join(repoRoot, 'node_modules', '@capacitor', 'local-notifications'),
    vendorDir: 'CapacitorLocalNotifications',
    packageName: 'CapacitorLocalNotifications',
  },
  {
    source: path.join(repoRoot, 'node_modules', '@capacitor', 'push-notifications'),
    vendorDir: 'CapacitorPushNotifications',
    packageName: 'CapacitorPushNotifications',
  },
  {
    source: path.join(repoRoot, 'node_modules', '@capawesome', 'capacitor-badge'),
    vendorDir: 'CapawesomeCapacitorBadge',
    packageName: 'CapawesomeCapacitorBadge',
  },
];

async function copyPackage(source, destination) {
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await cp(path.join(source, 'Package.swift'), path.join(destination, 'Package.swift'));
  await cp(path.join(source, 'ios'), path.join(destination, 'ios'), { recursive: true });
}

function rewriteCapAppPackage(packageText) {
  let next = packageText;

  for (const pkg of packages) {
    const pattern = new RegExp(
      String.raw`\.package\(name: "${pkg.packageName}", path: "\.\./\.\./\.\./node_modules/[^"]+"\)`,
      'g',
    );
    const replacement = `.package(name: "${pkg.packageName}", path: "../CapacitorVendor/${pkg.vendorDir}")`;
    next = next.replace(pattern, replacement);
  }

  return next;
}

async function main() {
  await mkdir(vendorRoot, { recursive: true });

  for (const pkg of packages) {
    const destination = path.join(vendorRoot, pkg.vendorDir);
    await copyPackage(pkg.source, destination);
    console.log(`Vendored ${pkg.packageName} -> ${path.relative(repoRoot, destination)}`);
  }

  const original = await readFile(capAppPackagePath, 'utf8');
  const rewritten = rewriteCapAppPackage(original);

  if (rewritten === original) {
    throw new Error('CapApp-SPM/Package.swift did not contain the expected node_modules package paths.');
  }

  await writeFile(capAppPackagePath, rewritten);
  console.log(`Rewrote ${path.relative(repoRoot, capAppPackagePath)} to use vendored Swift packages`);
}

await main();
