import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

interface RoomRow {
  id: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  member_count: number;
}

export default function RoomListClient({ rooms }: { rooms: RoomRow[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.tags?.some((t) => t.toLowerCase().includes(q)),
    );
  }, [rooms, query]);

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by name or tag…"
        className="ui-focus-ring w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[length:var(--ui-text-sm)] text-slate-700 placeholder-slate-400 dark:border-slate-700 dark:bg-[#13100E] dark:text-slate-100 dark:placeholder-slate-500"
      />

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-[length:var(--ui-text-sm)] text-slate-400">
          {query ? 'No rooms match that search.' : 'No public rooms yet.'}
        </p>
      ) : (
        <ul className="space-y-1">
          {filtered.map((room) => (
            <li key={room.id}>
              <div className="ui-panel-card flex items-center gap-3 rounded-[1.4rem] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[length:var(--ui-text-md)] font-semibold text-slate-800">
                    {room.name}
                  </p>
                  {room.description ? (
                    <p className="truncate text-[length:var(--ui-text-xs)] text-slate-500">
                      {room.description}
                    </p>
                  ) : null}
                  {room.tags && room.tags.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {room.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[length:var(--ui-text-2xs)] font-medium text-slate-500 dark:bg-[#13100E] dark:text-slate-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <p className="text-[length:var(--ui-text-xs)] text-slate-400">
                    {room.member_count}{' '}
                    {room.member_count === 1 ? 'member' : 'members'}
                  </p>
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
