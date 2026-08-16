import { useState } from 'react';

export const STORAGE_NOTICE_KEY = 'storage_notice_acknowledged';

export default function StorageNotice() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_NOTICE_KEY) !== '1';
    } catch {
      return false;
    }
  });

  if (!visible) return null;

  function acknowledge() {
    try {
      localStorage.setItem(STORAGE_NOTICE_KEY, '1');
    } catch {
      // Private browsing — still dismiss for this session
    }
    setVisible(false);
  }

  return (
    <div
      role="banner"
      aria-label="Storage notice"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#1d1916] px-4 py-3 shadow-lg"
    >
      <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-x-4 gap-y-2">
        <p className="flex-1 text-sm leading-snug text-white/70" style={{ minWidth: '18rem' }}>
          H.I.M. stores data only on your device — auth session, preferences, and your offline
          message queue. No cookies. No tracking.{' '}
          <a
            href="/privacy.html#on-device-storage"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-white/30 hover:text-white"
          >
            Full list
          </a>
        </p>
        <button
          onClick={acknowledge}
          className="shrink-0 rounded-md bg-[#e8a23a] px-4 py-1.5 text-sm font-semibold text-[#13100e] transition-opacity hover:opacity-90"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
