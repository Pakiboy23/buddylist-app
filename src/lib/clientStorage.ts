type Guard<T> = (value: unknown) => value is T;

export interface VersionedDataEnvelope<T> {
  version: number;
  savedAt: string;
  data: T;
}

interface ReadJSONOptions<T> {
  fallback: T;
  guard?: Guard<T>;
}

interface ReadVersionedDataOptions<T> {
  version: number;
  fallback: T;
  guard?: Guard<T>;
  migrate?: (legacy: unknown) => T | null;
  maxAgeMs?: number;
}

interface WriteJSONOptions<T> {
  maxBytes?: number;
  compact?: (value: T) => T;
}

const memoryStorage = new Map<string, string>();

function getStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storage = window.localStorage;
    const probeKey = '__buddylist_storage_probe__';
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
}

function getByteSize(value: string) {
  if (typeof TextEncoder === 'undefined') {
    return value.length;
  }
  return new TextEncoder().encode(value).length;
}

export function getRaw(key: string) {
  const storage = getStorage();
  if (storage) {
    try {
      return storage.getItem(key);
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  }

  return memoryStorage.get(key) ?? null;
}

export function setRaw(key: string, value: string) {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(key, value);
      return true;
    } catch {
      // Fall back to memory cache.
    }
  }

  memoryStorage.set(key, value);
  return true;
}

export function removeValue(key: string) {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(key);
    } catch {
      // Ignore and remove memory fallback.
    }
  }

  memoryStorage.delete(key);
}

export function getJSON<T>(key: string, options: ReadJSONOptions<T>) {
  const raw = getRaw(key);
  if (!raw) {
    return options.fallback;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (options.guard && !options.guard(parsed)) {
      return options.fallback;
    }
    return parsed as T;
  } catch {
    return options.fallback;
  }
}

export function setJSON<T>(key: string, value: T, options?: WriteJSONOptions<T>) {
  let nextValue = value;
  if (options?.compact) {
    nextValue = options.compact(nextValue);
  }

  const serialized = JSON.stringify(nextValue);
  if (typeof options?.maxBytes === 'number' && options.maxBytes > 0) {
    if (getByteSize(serialized) > options.maxBytes) {
      if (!options.compact) {
        return false;
      }

      const compacted = options.compact(value);
      const compactedSerialized = JSON.stringify(compacted);
      if (getByteSize(compactedSerialized) > options.maxBytes) {
        return false;
      }
      return setRaw(key, compactedSerialized);
    }
  }

  return setRaw(key, serialized);
}

function isVersionedEnvelope<T>(value: unknown, guard?: Guard<T>): value is VersionedDataEnvelope<T> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const envelope = value as Partial<VersionedDataEnvelope<T>>;
  if (
    typeof envelope.version !== 'number' ||
    typeof envelope.savedAt !== 'string' ||
    !('data' in envelope)
  ) {
    return false;
  }

  if (guard && !guard(envelope.data)) {
    return false;
  }

  return true;
}

export function getVersionedData<T>(key: string, options: ReadVersionedDataOptions<T>) {
  const raw = getRaw(key);
  if (!raw) {
    return options.fallback;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isVersionedEnvelope(parsed, options.guard)) {
      if (parsed.version === options.version) {
        if (typeof options.maxAgeMs === 'number' && options.maxAgeMs > 0) {
          const savedAtMs = Date.parse(parsed.savedAt);
          if (Number.isNaN(savedAtMs) || Date.now() - savedAtMs > options.maxAgeMs) {
            return options.fallback;
          }
        }
        return parsed.data;
      }

      if (parsed.version < options.version && options.migrate) {
        const migrated = options.migrate(parsed.data);
        if (migrated !== null) {
          return migrated;
        }
      }

      return options.fallback;
    }

    if (options.migrate) {
      const migrated = options.migrate(parsed);
      if (migrated !== null) {
        return migrated;
      }
    }

    return options.fallback;
  } catch {
    return options.fallback;
  }
}

export function setVersionedData<T>(
  key: string,
  version: number,
  data: T,
  options?: WriteJSONOptions<VersionedDataEnvelope<T>>,
) {
  const envelope: VersionedDataEnvelope<T> = {
    version,
    savedAt: new Date().toISOString(),
    data,
  };

  return setJSON(key, envelope, options);
}

export function subscribeToStorageKey(key: string, onChange: (rawValue: string | null) => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const listener = (event: StorageEvent) => {
    if (event.key !== key) {
      return;
    }
    onChange(event.newValue);
  };

  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener('storage', listener);
  };
}
