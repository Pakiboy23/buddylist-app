import AppIcon from '@/components/AppIcon';
import { normalizeRoomKey } from '@/lib/roomName';

export interface JoinedRoomCardRoom {
  id: string;
  slug: string;
  name: string;
  description: string;
}

interface JoinedRoomCardProps {
  room: JoinedRoomCardRoom;
  unreadCount: number;
  isSelected: boolean;
  isJoining: boolean;
  onOpen: () => void;
  onLeave: () => void;
}

export function JoinedRoomCard({
  room,
  unreadCount,
  isSelected,
  isJoining,
  onOpen,
  onLeave,
}: JoinedRoomCardProps) {
  const normalizedRoomKey = normalizeRoomKey(room.slug);
  const description = room.description.trim();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onOpen}
        disabled={isJoining}
        data-testid={`room-row-${normalizedRoomKey}`}
        data-room-name={room.name}
        data-room-description={description}
        data-room-unread={unreadCount}
        data-active={isSelected ? 'true' : 'false'}
        className="ui-list-row ui-room-card flex-1 text-left disabled:cursor-wait disabled:opacity-60"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.9rem] border border-[rgba(232,162,58,0.18)] bg-[rgba(232,162,58,0.14)] text-[13px] font-bold text-[var(--gold)]">
          #
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{room.name}</p>
          {description ? (
            <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">{description}</p>
          ) : null}
        </div>
        {unreadCount > 0 ? (
          <span
            data-testid={`room-unread-${normalizedRoomKey}`}
            aria-label={`Unread in ${room.name}: ${unreadCount}`}
            className={`ui-unread-badge flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              isSelected ? '' : 'aim-unread-badge-pulse'
            }`}
          >
            {unreadCount}
          </span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={onLeave}
        className="ui-focus-ring ui-button-danger ui-button-compact flex h-8 w-8 shrink-0 p-0"
        aria-label={`Leave ${room.name}`}
        title="Leave room"
      >
        <AppIcon kind="close" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
