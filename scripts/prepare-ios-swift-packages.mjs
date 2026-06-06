import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const vendorRoot = path.join(repoRoot, 'ios', 'App', 'CapacitorVendor');
const capAppPackagePath = path.join(repoRoot, 'ios', 'App', 'CapApp-SPM', 'Package.swift');
const capConfigJsonPath = path.join(repoRoot, 'ios', 'App', 'App', 'capacitor.config.json');

// In-app Capacitor plugins (defined in AppDelegate.swift, not in node_modules)
// that must appear in packageClassList so the bridge registers them.
const inAppPluginClasses = ['HiItsMeShellPlugin'];

// privacySourceDir: path within the vendored package where PrivacyInfo.xcprivacy lives
//   (same as the `path:` value in the main .target(...) declaration)
// accessedAPIs: required-reason API categories needed by this plugin.
//   Empty = no required-reason APIs used.
const packages = [
  {
    source: path.join(repoRoot, 'node_modules', '@aparajita', 'capacitor-biometric-auth'),
    vendorDir: 'AparajitaCapacitorBiometricAuth',
    packageName: 'AparajitaCapacitorBiometricAuth',
    privacySourceDir: 'ios/Sources/BiometricAuthNative',
    accessedAPIs: [],
  },
  {
    source: path.join(repoRoot, 'node_modules', '@capacitor', 'app'),
    vendorDir: 'CapacitorApp',
    packageName: 'CapacitorApp',
    privacySourceDir: 'ios/Sources/AppPlugin',
    accessedAPIs: [],
  },
  {
    source: path.join(repoRoot, 'node_modules', '@capacitor', 'haptics'),
    vendorDir: 'CapacitorHaptics',
    packageName: 'CapacitorHaptics',
    privacySourceDir: 'ios/Sources/HapticsPlugin',
    accessedAPIs: [],
  },
  {
    source: path.join(repoRoot, 'node_modules', '@capacitor', 'local-notifications'),
    vendorDir: 'CapacitorLocalNotifications',
    packageName: 'CapacitorLocalNotifications',
    privacySourceDir: 'ios/Sources/LocalNotificationsPlugin',
    accessedAPIs: [],
  },
  {
    source: path.join(repoRoot, 'node_modules', '@capacitor', 'push-notifications'),
    vendorDir: 'CapacitorPushNotifications',
    packageName: 'CapacitorPushNotifications',
    privacySourceDir: 'ios/Sources/PushNotificationsPlugin',
    accessedAPIs: [],
  },
  {
    source: path.join(repoRoot, 'node_modules', '@capawesome', 'capacitor-badge'),
    vendorDir: 'CapawesomeCapacitorBadge',
    packageName: 'CapawesomeCapacitorBadge',
    privacySourceDir: 'ios/Plugin',
    // UserDefaults.standard in Badge.swift — CA92.1: access info the same app wrote
    accessedAPIs: [{ type: 'NSPrivacyAccessedAPICategoryUserDefaults', reasons: ['CA92.1'] }],
  },
];

async function copyPackage(source, destination) {
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await cp(path.join(source, 'Package.swift'), path.join(destination, 'Package.swift'));
  await cp(path.join(source, 'ios'), path.join(destination, 'ios'), { recursive: true });
}

function buildPrivacyManifest(accessedAPIs) {
  const accessedTypesXml =
    accessedAPIs.length === 0
      ? '\t<array/>'
      : [
          '\t<array>',
          ...accessedAPIs.flatMap(({ type, reasons }) => [
            '\t\t<dict>',
            '\t\t\t<key>NSPrivacyAccessedAPIType</key>',
            `\t\t\t<string>${type}</string>`,
            '\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>',
            '\t\t\t<array>',
            ...reasons.map((r) => `\t\t\t\t<string>${r}</string>`),
            '\t\t\t</array>',
            '\t\t</dict>',
          ]),
          '\t</array>',
        ].join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '\t<key>NSPrivacyTracking</key>',
    '\t<false/>',
    '\t<key>NSPrivacyTrackingDomains</key>',
    '\t<array/>',
    '\t<key>NSPrivacyCollectedDataTypes</key>',
    '\t<array/>',
    '\t<key>NSPrivacyAccessedAPITypes</key>',
    accessedTypesXml,
    '</dict>',
    '</plist>',
  ].join('\n') + '\n';
}

function injectPrivacyResource(content, targetSourceDir) {
  // Find the main target's `path:` line and add a `resources:` argument.
  // The line looks like one of:
  //   path: "ios/Sources/Foo")     ← last target in array, no trailing comma
  //   path: "ios/Sources/Foo"),    ← followed by testTarget, trailing comma
  const escaped = targetSourceDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`([ \\t]+path: "${escaped}")(\\))(,?)`);
  const patched = content.replace(
    pattern,
    `$1,\n            resources: [.copy("PrivacyInfo.xcprivacy")])$3`,
  );
  if (patched === content) {
    throw new Error(
      `Could not inject PrivacyInfo resource into Package.swift — path "${targetSourceDir}" not found.`,
    );
  }
  return patched;
}

async function applyPrivacyManifest(destination, pkg) {
  const manifestContent = buildPrivacyManifest(pkg.accessedAPIs);
  const manifestPath = path.join(destination, pkg.privacySourceDir, 'PrivacyInfo.xcprivacy');
  await writeFile(manifestPath, manifestContent);

  const pkgSwiftPath = path.join(destination, 'Package.swift');
  const original = await readFile(pkgSwiftPath, 'utf8');
  const patched = injectPrivacyResource(original, pkg.privacySourceDir);
  await writeFile(pkgSwiftPath, patched);
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
    await applyPrivacyManifest(destination, pkg);
    console.log(`Vendored ${pkg.packageName} -> ${path.relative(repoRoot, destination)}`);
  }

  const original = await readFile(capAppPackagePath, 'utf8');
  const rewritten = rewriteCapAppPackage(original);

  if (rewritten === original) {
    throw new Error('CapApp-SPM/Package.swift did not contain the expected node_modules package paths.');
  }

  await writeFile(capAppPackagePath, rewritten);
  console.log(`Rewrote ${path.relative(repoRoot, capAppPackagePath)} to use vendored Swift packages`);

  // Inject in-app plugin classes into capacitor.config.json so the bridge
  // registers them. Capacitor 8's autoRegisterPlugins reads packageClassList
  // from this file but only includes classes from SPM package plugins — in-app
  // plugins defined directly in the Xcode target are not discovered.
  const capConfigRaw = await readFile(capConfigJsonPath, 'utf8');
  const capConfig = JSON.parse(capConfigRaw);
  const classList = new Set(capConfig.packageClassList ?? []);
  for (const cls of inAppPluginClasses) {
    classList.add(cls);
  }
  capConfig.packageClassList = [...classList];
  await writeFile(capConfigJsonPath, JSON.stringify(capConfig, null, '\t') + '\n');
  console.log(`Injected in-app plugin classes into capacitor.config.json: ${inAppPluginClasses.join(', ')}`);
}

await main();
