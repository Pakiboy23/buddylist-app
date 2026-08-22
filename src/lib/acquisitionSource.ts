import { Capacitor } from '@capacitor/core';

/**
 * First-touch acquisition source for web signups (GH-13).
 *
 * Captured from the landing URL and parked in sessionStorage so the
 * create-account toggle — which re-renders the form but keeps the tab — does
 * not lose it. Written exactly once, onto the new public.users row at signup.
 * Sign-in never touches it, and neither does profile editing.
 *
 * Native (Capacitor) is deliberately inert: the native shell can hand users
 * into this same web form via showWebAuth('signup'), and a native launch has
 * no landing URL to attribute, so every entry point here no-ops on native.
 *
 * No third-party analytics SDK is involved; this is four query params and a
 * string column.
 */

const STORAGE_KEY = 'him.acquisition_source';

/** Column is text, but attribution values are channel names, not prose. */
const MAX_LENGTH = 64;

export const DIRECT_SOURCE = 'direct';

function isNativePlatform(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
}

/**
 * Channel names only: lowercase, and anything that isn't a plain token
 * character collapses to a single dash. Keeps a stray `?utm_source=<script>`
 * or a 2KB query string from ever reaching the column.
 */
function normalize(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned ? cleaned.slice(0, MAX_LENGTH) : null;
}

function readStored(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // Private browsing / storage disabled. Attribution is best-effort.
    return null;
  }
}

function writeStored(value: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Same: never let attribution break signup.
  }
}

/** utm_source, else utm_medium, else ref, else direct. */
export function resolveAcquisitionSource(search: string): string {
  const params = new URLSearchParams(search);
  return (
    normalize(params.get('utm_source')) ??
    normalize(params.get('utm_medium')) ??
    normalize(params.get('ref')) ??
    DIRECT_SOURCE
  );
}

/**
 * Record the first touch for this tab. Later calls return what was already
 * stored, so an in-session navigation that drops or changes the UTM cannot
 * overwrite the source the visitor actually arrived on.
 */
export function captureAcquisitionSource(search?: string): string | null {
  if (typeof window === 'undefined' || isNativePlatform()) return null;

  const existing = readStored();
  if (existing) return existing;

  const resolved = resolveAcquisitionSource(search ?? window.location.search);
  writeStored(resolved);
  return resolved;
}

/** The captured source, or null on native and when nothing was captured. */
export function readAcquisitionSource(): string | null {
  if (typeof window === 'undefined' || isNativePlatform()) return null;
  return readStored();
}
