import { supabase } from '@/lib/supabase';

export const BUDDY_ICON_BUCKET = 'buddy-icons';
export const BUDDY_ICON_MAX_BYTES = 2 * 1024 * 1024;
const DIRECT_IMAGE_SOURCE_PATTERN = /^(blob:|data:|https?:\/\/|file:|capacitor:|\/)/i;

function sanitizeFileName(fileName: string) {
  const trimmed = fileName.trim();
  const fallback = 'buddy-icon';
  if (!trimmed) {
    return fallback;
  }

  const normalized = trimmed
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return normalized || fallback;
}

function buildStoragePath(userId: string, fileName: string) {
  const uniqueId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  return `${userId}/profile/${uniqueId}-${sanitizeFileName(fileName)}`;
}

export function getBuddyIconUrl(storagePath: string | null | undefined) {
  const normalizedPath = (storagePath ?? '').trim();
  if (!normalizedPath) {
    return null;
  }

  const { data } = supabase.storage.from(BUDDY_ICON_BUCKET).getPublicUrl(normalizedPath);
  return data.publicUrl;
}

export function resolveBuddyIconUrl(source: string | null | undefined) {
  const normalizedSource = (source ?? '').trim();
  if (!normalizedSource) {
    return null;
  }

  if (DIRECT_IMAGE_SOURCE_PATTERN.test(normalizedSource)) {
    return normalizedSource;
  }

  return getBuddyIconUrl(normalizedSource);
}

export function validateBuddyIconFile(file: File) {
  if (!file) {
    return 'Choose an image first.';
  }

  if (file.size <= 0) {
    return 'Image is empty.';
  }

  if (file.size > BUDDY_ICON_MAX_BYTES) {
    return `Image is too large. Max size is ${Math.floor(BUDDY_ICON_MAX_BYTES / (1024 * 1024))}MB.`;
  }

  const mimeType = (file.type ?? '').trim().toLowerCase();
  if (!mimeType.startsWith('image/')) {
    return 'Buddy icons must be image files.';
  }

  return null;
}

export async function uploadBuddyIconFile({
  userId,
  file,
}: {
  userId: string;
  file: File;
}) {
  const validationError = validateBuddyIconFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const storagePath = buildStoragePath(userId, file.name);
  const mimeType = (file.type ?? '').trim() || 'image/png';
  const { error: uploadError } = await supabase.storage
    .from(BUDDY_ICON_BUCKET)
    .upload(storagePath, file, {
      upsert: false,
      cacheControl: '3600',
      contentType: mimeType,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  return {
    bucket: BUDDY_ICON_BUCKET,
    storagePath,
    fileName: file.name,
    mimeType,
    sizeBytes: file.size,
    publicUrl: getBuddyIconUrl(storagePath),
  };
}

export async function deleteBuddyIconFile(storagePath: string | null | undefined) {
  const normalizedPath = (storagePath ?? '').trim();
  if (!normalizedPath) {
    return;
  }

  const { error } = await supabase.storage.from(BUDDY_ICON_BUCKET).remove([normalizedPath]);
  if (error) {
    throw new Error(error.message);
  }
}
