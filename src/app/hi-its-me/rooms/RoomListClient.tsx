import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RoomRow } from './page';

const KIND_LABEL: Record<string, string> = {
  regional: 'City',
  vibe: 'Vibe',
};

export default function RoomListClient({ rooms }: { rooms: RoomRow[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.kind.toLowerCase().includes(q),
    );
  }, [rooms, query]);

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter rooms…"
        className="ui-focus-ring w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[length:var(--ui-text-sm)] text-slate-700 placeholder-slate-400 dark:border-slate-700 dark:bg-[#13100E] dark:text-slate-100 dark:placeholder-slate-500"
      />

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-[length:var(--ui-text-sm)] text-slate-400">
          {query ? 'No rooms match that search.' : 'No rooms available.'}
        </p>
      ) : (
        <ul className="space-y-1">
          {filtered.map((room) => (
            <li key={room.id}>
              <div className="ui-panel-card flex items-center gap-3 rounded-[1.4rem] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[length:var(--ui-text-md)] font-semibold text-slate-800 dark:text-slate-100">
                    {room.name}
                  </p>
                  {room.description ? (
                    <p className="truncate text-[length:var(--ui-text-xs)] text-slate-500 dark:text-slate-400">
                      {room.description}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[length:var(--ui-text-2xs)] font-medium text-slate-500 dark:bg-[#13100E] dark:text-slate-300">
                    {KIND_LABEL[room.kind] ?? room.kind}
                  </span>
                  <Link
                    to={`/hi-its-me/rooms/${room.id}/preview`}
                    className="ui-focus-ring ui-button-secondary rounded-xl px-3 py-1.5 text-[length:var(--ui-text-xs)] font-semibold"
                  >
                    Preview
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
