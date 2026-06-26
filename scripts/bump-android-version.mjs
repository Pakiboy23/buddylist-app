import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Bumps the committed Android version in android/app/build.gradle.
//
//   node scripts/bump-android-version.mjs                 # versionCode += 1
//   node scripts/bump-android-version.mjs --code 42       # set versionCode = 42
//   node scripts/bump-android-version.mjs --name 1.2.0    # set versionName = "1.2.0"
//   node scripts/bump-android-version.mjs --name 1.2.0    # (combine with --code as needed)
//
// versionCode must strictly increase for every Play upload; versionName is the
// user-facing string. This edits the `defaultVersionCode`/`defaultVersionName`
// literals — env/Gradle-property overrides still take precedence at build time.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const buildGradlePath = path.resolve(__dirname, '..', 'android', 'app', 'build.gradle');

function parseArgs(argv) {
  const args = { code: null, name: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--code') {
      args.code = argv[++i];
    } else if (arg === '--name') {
      args.name = argv[++i];
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let source = await readFile(buildGradlePath, 'utf8');

  const codeMatch = source.match(/def defaultVersionCode = (\d+)/);
  if (!codeMatch) {
    throw new Error('Could not find `def defaultVersionCode = <int>` in android/app/build.gradle.');
  }
  const currentCode = parseInt(codeMatch[1], 10);

  let nextCode;
  if (args.code !== null) {
    if (!/^\d+$/.test(args.code)) throw new Error(`--code must be a positive integer, got ${args.code}.`);
    nextCode = parseInt(args.code, 10);
    if (nextCode <= currentCode) {
      throw new Error(`--code ${nextCode} must be greater than current versionCode ${currentCode}.`);
    }
  } else {
    nextCode = currentCode + 1;
  }
  source = source.replace(/def defaultVersionCode = \d+/, `def defaultVersionCode = ${nextCode}`);

  let nameLine = '';
  if (args.name !== null) {
    const nameMatch = source.match(/def defaultVersionName = "([^"]*)"/);
    if (!nameMatch) {
      throw new Error('Could not find `def defaultVersionName = "<string>"` in android/app/build.gradle.');
    }
    source = source.replace(/def defaultVersionName = "[^"]*"/, `def defaultVersionName = "${args.name}"`);
    nameLine = ` and versionName ${nameMatch[1]} -> ${args.name}`;
  }

  await writeFile(buildGradlePath, source);
  console.log(`Bumped versionCode ${currentCode} -> ${nextCode}${nameLine}.`);
}

await main();
