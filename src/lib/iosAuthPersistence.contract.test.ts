import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const APP_DELEGATE = path.join(REPO_ROOT, 'ios/App/App/AppDelegate.swift');
const PRIVACY = path.join(REPO_ROOT, 'ios/App/App/PrivacyInfo.xcprivacy');
const SUPABASE_CLIENT = path.join(REPO_ROOT, 'src/lib/supabase.ts');

describe('iOS auth persistence contracts', () => {
  it('does not wipe localStorage/cookies when the build number changes', () => {
    const source = readFileSync(APP_DELEGATE, 'utf-8');
    expect(source).not.toMatch(/allWebsiteDataTypes\(\)/);
    expect(source).toMatch(/WKWebsiteDataTypeDiskCache/);
    expect(source).toMatch(/WKWebsiteDataTypeMemoryCache/);
    expect(source).not.toMatch(/WKWebsiteDataTypeLocalStorage/);
    expect(source).toMatch(/getPersistentItem/);
    expect(source).toMatch(/setPersistentItem/);
    expect(source).toMatch(/removePersistentItem/);
  });

  it('declares UserDefaults CA92.1 for the app target', () => {
    const source = readFileSync(PRIVACY, 'utf-8');
    expect(source).toContain('NSPrivacyAccessedAPICategoryUserDefaults');
    expect(source).toContain('CA92.1');
  });

  it('wires supabase auth to the native-capable storage adapter', () => {
    const source = readFileSync(SUPABASE_CLIENT, 'utf-8');
    expect(source).toContain('createHimAuthStorage');
    expect(source).toMatch(/storage:\s*createHimAuthStorage\(/);
  });
});
