import { supabase } from '@/lib/supabase';

export const CHAT_MEDIA_BUCKET = 'chat-media';
export const CHAT_MEDIA_MAX_BYTES = 10 * 1024 * 1024;
export const CHAT_MEDIA_MAX_ATTACHMENTS = 4;

const ALLOWED_EXACT_MIME_TYPES = new Set([
  'application/pdf',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
]);
const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/', 'text/'] as const;

export interface UploadedChatMedia {
  bucket: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  publicUrl: string;
}

export interface ChatMediaAttachmentRecord {
  id: string;
  bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
}

function sanitizeFileName(fileName: string) {
  const trimmed = fileName.trim();
  const fallback = 'attachment';
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
  const now = new Date();
  const year = `${now.getUTCFullYear()}`;
  const month = `${now.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${now.getUTCDate()}`.padStart(2, '0');
  const uniqueId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  return `${userId}/${year}/${month}/${day}/${uniqueId}-${sanitizeFileName(fileName)}`;
}

export function formatFileSize(sizeBytes: number | null | undefined) {
  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes < 0) {
    return '';
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateChatMediaFile(file: File) {
  if (!file) {
    return 'Choose a file first.';
  }

  if (file.size <= 0) {
    return 'File is empty.';
  }

  if (file.size > CHAT_MEDIA_MAX_BYTES) {
    return `File is too large. Max size is ${Math.floor(CHAT_MEDIA_MAX_BYTES / (1024 * 1024))}MB.`;
  }

  const mimeType = (file.type ?? '').trim().toLowerCase();
  if (!mimeType) {
    return null;
  }

  if (ALLOWED_EXACT_MIME_TYPES.has(mimeType)) {
    return null;
  }

  if (ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) {
    return null;
  }

  return 'Unsupported file type.';
}

export async function uploadChatMediaFile({
  userId,
  file,
}: {
  userId: string;
  file: File;
}): Promise<UploadedChatMedia> {
  const validationError = validateChatMediaFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const storagePath = buildStoragePath(userId, file.name);
  const mimeType = (file.type ?? '').trim() || 'application/octet-stream';
  const { error: uploadError } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .upload(storagePath, file, {
      upsert: false,
      cacheControl: '3600',
      contentType: mimeType,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(storagePath);
  const publicUrl = data.publicUrl;

  return {
    bucket: CHAT_MEDIA_BUCKET,
    storagePath,
    fileName: file.name,
    mimeType,
    sizeBytes: file.size,
    publicUrl,
  };
}

export async function removeUploadedChatMedia(uploads: UploadedChatMedia[]): Promise<void> {
  if (uploads.length === 0) {
    return;
  }

  const pathsByBucket = new Map<string, string[]>();
  for (const upload of uploads) {
    const paths = pathsByBucket.get(upload.bucket) ?? [];
    paths.push(upload.storagePath);
    pathsByBucket.set(upload.bucket, paths);
  }

  await Promise.all(
    [...pathsByBucket.entries()].map(async ([bucket, paths]) => {
      try {
        await supabase.storage.from(bucket).remove(paths);
      } catch {
        // Best-effort cleanup; the original send/upload error is what the user needs.
      }
    }),
  );
}

/**
 * Upload every file, or none. A later failure rolls back objects already
 * written so a retried send does not leave orphan blobs.
 */
export async function uploadChatMediaFiles({
  userId,
  files,
}: {
  userId: string;
  files: File[];
}): Promise<UploadedChatMedia[]> {
  const uploaded: UploadedChatMedia[] = [];
  try {
    for (const file of files) {
      uploaded.push(await uploadChatMediaFile({ userId, file }));
    }
    return uploaded;
  } catch (error) {
    await removeUploadedChatMedia(uploaded);
    throw error;
  }
}

export function messageAttachmentInserts({
  messageId,
  uploaderId,
  uploads,
}: {
  messageId: number;
  uploaderId: string;
  uploads: UploadedChatMedia[];
}) {
  return uploads.map((uploaded) => ({
    message_id: messageId,
    uploader_id: uploaderId,
    bucket: uploaded.bucket,
    storage_path: uploaded.storagePath,
    file_name: uploaded.fileName,
    mime_type: uploaded.mimeType,
    size_bytes: uploaded.sizeBytes,
  }));
}

