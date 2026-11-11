import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { from, upload, remove, getPublicUrl } = vi.hoisted(() => {
  const hoistedUpload = vi.fn(async () => ({ error: null as { message: string } | null }));
  const hoistedRemove = vi.fn(async () => ({ error: null }));
  const hoistedGetPublicUrl = vi.fn((storagePath: string) => ({
    data: { publicUrl: `https://cdn.example.test/${storagePath}` },
  }));
  const hoistedFrom = vi.fn(() => ({
    upload: hoistedUpload,
    remove: hoistedRemove,
    getPublicUrl: hoistedGetPublicUrl,
  }));
  return {
    from: hoistedFrom,
    upload: hoistedUpload,
    remove: hoistedRemove,
    getPublicUrl: hoistedGetPublicUrl,
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from,
    },
  },
}));

import {
  CHAT_MEDIA_BUCKET,
  messageAttachmentInserts,
  uploadChatMediaFiles,
} from '@/lib/chatMedia';

const file = (name: string) => new File(['bytes'], name, { type: 'image/png' });

describe('uploadChatMediaFiles', () => {
  beforeEach(() => {
    from.mockClear();
    upload.mockClear();
    remove.mockClear();
    getPublicUrl.mockClear();
    upload.mockResolvedValue({ error: null });
  });

  it('uploads every file before returning', async () => {
    const uploads = await uploadChatMediaFiles({
      userId: 'user-1',
      files: [file('one.png'), file('two.png')],
    });

    expect(upload).toHaveBeenCalledTimes(2);
    expect(uploads).toHaveLength(2);
    expect(uploads[0]?.fileName).toBe('one.png');
    expect(uploads[1]?.fileName).toBe('two.png');
    expect(remove).not.toHaveBeenCalled();
  });

  it('rolls back earlier objects when a later upload fails', async () => {
    upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'Network connection lost' } });

    await expect(
      uploadChatMediaFiles({
        userId: 'user-1',
        files: [file('kept.png'), file('lost.png')],
      }),
    ).rejects.toThrow('Network connection lost');

    expect(remove).toHaveBeenCalledTimes(1);
    const removedPaths = (remove.mock.calls[0] as unknown[] | undefined)?.[0] as string[];
    expect(removedPaths).toHaveLength(1);
    expect(removedPaths[0]).toContain('kept.png');
  });

  it('maps uploads onto message_attachments rows', () => {
    const rows = messageAttachmentInserts({
      messageId: 42,
      uploaderId: 'user-1',
      uploads: [
        {
          bucket: CHAT_MEDIA_BUCKET,
          storagePath: 'user-1/a.png',
          fileName: 'a.png',
          mimeType: 'image/png',
          sizeBytes: 12,
          publicUrl: 'https://cdn.example.test/user-1/a.png',
        },
      ],
    });

    expect(rows).toEqual([
      {
        message_id: 42,
        uploader_id: 'user-1',
        bucket: CHAT_MEDIA_BUCKET,
        storage_path: 'user-1/a.png',
        file_name: 'a.png',
        mime_type: 'image/png',
        size_bytes: 12,
      },
    ]);
  });
});

describe('handleSendMessage attachment order', () => {
  it('uploads chat media before inserting the DM row', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/hi-its-me/page.tsx'), 'utf8');
    const fnStart = source.indexOf('const handleSendMessage');
    expect(fnStart).toBeGreaterThan(0);
    const fnSlice = source.slice(fnStart, source.indexOf('const handleSendKnockToBuddy'));
    const uploadAt = fnSlice.indexOf('uploadChatMediaFiles');
    const sendAt = fnSlice.indexOf('sendDirectMessageWithClientMessageId');
    expect(uploadAt).toBeGreaterThan(0);
    expect(sendAt).toBeGreaterThan(uploadAt);
  });
});
