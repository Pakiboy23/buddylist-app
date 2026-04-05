const MESSAGE_RUN_GAP_MS = 6 * 60 * 1000;
const MESSAGE_DIVIDER_GAP_MS = 30 * 60 * 1000;

export interface ConversationClusterMeta {
  isFirstInRun: boolean;
  isLastInRun: boolean;
  showTimeDivider: boolean;
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function getConversationClusterMeta<T extends { created_at: string; sender_id: string }>(
  messages: readonly T[],
  index: number,
): ConversationClusterMeta {
  const message = messages[index];
  const timestamp = new Date(message.created_at);
  const currentTime = timestamp.getTime();

  const previous = index > 0 ? messages[index - 1] : null;
  const next = index < messages.length - 1 ? messages[index + 1] : null;

  const previousTime = previous ? new Date(previous.created_at) : null;
  const nextTime = next ? new Date(next.created_at) : null;
  const previousGap = previousTime ? currentTime - previousTime.getTime() : Number.POSITIVE_INFINITY;
  const nextGap = nextTime ? nextTime.getTime() - currentTime : Number.POSITIVE_INFINITY;

  return {
    isFirstInRun:
      !previous || previous.sender_id !== message.sender_id || previousGap > MESSAGE_RUN_GAP_MS,
    isLastInRun:
      !next || next.sender_id !== message.sender_id || nextGap > MESSAGE_RUN_GAP_MS,
    showTimeDivider:
      !previous ||
      !previousTime ||
      !isSameDay(timestamp, previousTime) ||
      previousGap > MESSAGE_DIVIDER_GAP_MS,
  };
}

export function formatConversationDividerLabel(isoString: string, now = new Date()) {
  const timestamp = new Date(isoString);
  const timeLabel = timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isSameDay(timestamp, now)) {
    return timeLabel;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(timestamp, yesterday)) {
    return `Yesterday · ${timeLabel}`;
  }

  const dateLabel = timestamp.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
  return `${dateLabel} · ${timeLabel}`;
}

export function formatConversationMetaTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
