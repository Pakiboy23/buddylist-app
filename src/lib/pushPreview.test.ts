import { describe, expect, it } from 'vitest';
import { applyNotificationPreview, type NotificationPreviewMode } from './pushPreview';

const BASE = { senderName: 'Joe', messagePreview: "hey what's up" };

describe('applyNotificationPreview', () => {
  it('full: returns sender and preview unchanged', () => {
    expect(applyNotificationPreview(BASE, 'full')).toEqual(BASE);
  });

  it('name_only: preserves sender, replaces preview with "New message"', () => {
    expect(applyNotificationPreview(BASE, 'name_only')).toEqual({
      senderName: 'Joe',
      messagePreview: 'New message',
    });
  });

  it('hidden: replaces both sender and preview — no identifying info', () => {
    expect(applyNotificationPreview(BASE, 'hidden')).toEqual({
      senderName: 'H.I.M.',
      messagePreview: 'New message',
    });
  });

  it('hidden with buzz preview still shows no identifying info', () => {
    expect(applyNotificationPreview({ senderName: 'Alex', messagePreview: '⚡ Buzz!' }, 'hidden')).toEqual({
      senderName: 'H.I.M.',
      messagePreview: 'New message',
    });
  });

  it.each<NotificationPreviewMode>(['full', 'name_only', 'hidden'])(
    '%s: result messagePreview is never empty',
    (mode) => {
      const { messagePreview } = applyNotificationPreview(BASE, mode);
      expect(messagePreview.length).toBeGreaterThan(0);
    },
  );
});
