'use client';

import { KeyboardEvent, useId, useMemo } from 'react';
import AppIcon from '@/components/AppIcon';
import { formatFileSize } from '@/lib/chatMedia';

export interface ChatMediaGalleryItem {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  publicUrl: string;
  createdAt: string;
  senderLabel: string;
}

type MediaGalleryFilter = 'all' | 'media' | 'audio' | 'files';

function getMediaKind(item: ChatMediaGalleryItem) {
  const mimeType = (item.mimeType ?? '').toLowerCase();
  if (mimeType.startsWith('image/')) {
    return 'image' as const;
  }
  if (mimeType.startsWith('video/')) {
    return 'video' as const;
  }
  if (mimeType.startsWith('audio/')) {
    return 'audio' as const;
  }
  return 'file' as const;
}

interface ChatMediaGallerySheetProps {
  title: string;
  items: ChatMediaGalleryItem[];
  filter: MediaGalleryFilter;
  onFilterChange: (filter: MediaGalleryFilter) => void;
  onClose: () => void;
}

export default function ChatMediaGallerySheet({
  title,
  items,
  filter,
  onFilterChange,
  onClose,
}: ChatMediaGallerySheetProps) {
  const titleId = useId();
  const descriptionId = useId();

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const kind = getMediaKind(item);
      if (filter === 'all') {
        return true;
      }
      if (filter === 'media') {
        return kind === 'image' || kind === 'video';
      }
      if (filter === 'audio') {
        return kind === 'audio';
      }
      return kind === 'file';
    });
  }, [filter, items]);

  const handleOverlayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-[2px]"
      onClick={onClose}
      onKeyDown={handleOverlayKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="ui-sheet-surface w-full max-w-2xl rounded-t-[2rem]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-center pb-1 pt-3">
          <div className="ui-drag-handle" />
        </div>

        <div className="ui-sheet-header">
          <div>
            <h2 id={titleId} className="ui-sheet-title text-[length:var(--ui-text-lg)]">
              {title}
            </h2>
            <p id={descriptionId} className="mt-0.5 text-[length:var(--ui-text-xs)] text-slate-500">
              Browse attachments, voice notes, and shared media in one place.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ui-focus-ring ui-sheet-close h-11 w-11 text-[length:var(--ui-text-sm)] font-semibold"
            aria-label="Close media gallery"
          >
            <AppIcon kind="close" className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-2">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All' },
              { id: 'media', label: 'Photos & video' },
              { id: 'audio', label: 'Voice & audio' },
              { id: 'files', label: 'Files' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onFilterChange(option.id as MediaGalleryFilter)}
                className={`ui-focus-ring rounded-full px-3 py-1.5 text-[length:var(--ui-text-xs)] font-semibold ${
                  filter === option.id
                    ? 'bg-blue-500 text-white shadow-[0_8px_20px_rgba(37,99,235,0.22)]'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-4 max-h-[min(68vh,44rem)] overflow-y-auto pr-1">
            {filteredItems.length === 0 ? (
              <div className="ui-empty-state min-h-[14rem] px-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-blue-500/15 dark:text-blue-200">
                  <AppIcon kind="media" className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-[length:var(--ui-text-md)] font-semibold text-slate-500">No matches here yet</p>
                  <p className="mt-0.5 text-[length:var(--ui-text-xs)] text-slate-400">
                    Shared media, voice notes, and files will collect here as the chat grows.
                  </p>
                </div>
              </div>
            ) : null}

            {filteredItems.some((item) => {
              const kind = getMediaKind(item);
              return kind === 'image' || kind === 'video';
            }) ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {filteredItems
                  .filter((item) => {
                    const kind = getMediaKind(item);
                    return kind === 'image' || kind === 'video';
                  })
                  .map((item) => {
                    const kind = getMediaKind(item);
                    return (
                      <a
                        key={item.id}
                        href={item.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ui-focus-ring group overflow-hidden rounded-[1.4rem] border border-white/70 bg-white/85 shadow-sm dark:border-slate-800 dark:bg-slate-950/55"
                      >
                        <div className="aspect-square bg-slate-100 dark:bg-slate-900">
                          {kind === 'image' ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={item.publicUrl}
                              alt={item.fileName}
                              className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                            />
                          ) : (
                            <video
                              src={item.publicUrl}
                              className="h-full w-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                            />
                          )}
                        </div>
                        <div className="space-y-0.5 px-3 py-2">
                          <p className="truncate text-[length:var(--ui-text-xs)] font-semibold text-slate-700 dark:text-slate-100">
                            {item.fileName}
                          </p>
                          <p className="truncate text-[length:var(--ui-text-2xs)] text-slate-400">
                            {item.senderLabel} · {new Date(item.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </a>
                    );
                  })}
              </div>
            ) : null}

            {filteredItems.some((item) => {
              const kind = getMediaKind(item);
              return kind === 'audio' || kind === 'file';
            }) ? (
              <div className="mt-3 space-y-2">
                {filteredItems
                  .filter((item) => {
                    const kind = getMediaKind(item);
                    return kind === 'audio' || kind === 'file';
                  })
                  .map((item) => {
                    const kind = getMediaKind(item);
                    return (
                      <div
                        key={item.id}
                        className="rounded-[1.3rem] border border-white/70 bg-white/85 px-3 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/55"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-500 dark:bg-blue-500/15 dark:text-blue-200">
                            <AppIcon kind={kind === 'audio' ? 'mic' : 'attachment'} className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[length:var(--ui-text-sm)] font-semibold text-slate-800 dark:text-slate-100">
                              {item.fileName}
                            </p>
                            <p className="mt-0.5 text-[length:var(--ui-text-2xs)] text-slate-400">
                              {item.senderLabel} · {new Date(item.createdAt).toLocaleString()}
                              {item.sizeBytes ? ` · ${formatFileSize(item.sizeBytes)}` : ''}
                            </p>
                            {kind === 'audio' ? (
                              <audio controls preload="metadata" className="mt-2 w-full" src={item.publicUrl} />
                            ) : (
                              <a
                                href={item.publicUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="ui-focus-ring mt-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-[length:var(--ui-text-xs)] font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <AppIcon kind="attachment" className="h-3.5 w-3.5" />
                                Open file
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
