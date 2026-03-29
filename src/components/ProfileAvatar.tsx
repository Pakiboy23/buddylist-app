'use client';

import { useState } from 'react';
import { resolveBuddyIconUrl } from '@/lib/buddyIcon';
import type { ResolvedPresenceState } from '@/lib/presence';

interface ProfileAvatarProps {
  screenname: string;
  buddyIconPath?: string | null;
  imageSrc?: string | null;
  presenceState?: ResolvedPresenceState | null;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'blue' | 'violet' | 'slate';
  className?: string;
  showStatusDot?: boolean;
}

const SIZE_CLASSES = {
  sm: {
    avatar: 'h-9 w-9 text-[13px]',
    dot: 'h-3 w-3 border-2',
  },
  md: {
    avatar: 'h-10 w-10 text-[14px]',
    dot: 'h-3.5 w-3.5 border-2',
  },
  lg: {
    avatar: 'h-16 w-16 text-[22px]',
    dot: 'h-4 w-4 border-[3px]',
  },
} as const;

function getFallbackToneClasses(tone: NonNullable<ProfileAvatarProps['tone']>) {
  switch (tone) {
    case 'violet':
      return 'bg-violet-100 text-violet-700';
    case 'slate':
      return 'bg-slate-200 text-slate-700';
    default:
      return 'bg-blue-100 text-blue-700';
  }
}

function getPresenceRingClass(presenceState: ResolvedPresenceState | null | undefined) {
  switch (presenceState) {
    case 'away':
      return 'ring-amber-400';
    case 'idle':
      return 'ring-sky-400';
    case 'offline':
      return 'ring-slate-300';
    default:
      return 'ring-emerald-400';
  }
}

function getPresenceDotClass(presenceState: ResolvedPresenceState | null | undefined) {
  switch (presenceState) {
    case 'away':
      return 'bg-amber-400';
    case 'idle':
      return 'bg-sky-400';
    case 'offline':
      return 'bg-slate-300';
    default:
      return 'bg-emerald-400';
  }
}

function getInitial(screenname: string) {
  const firstCharacter = screenname.trim().charAt(0);
  return firstCharacter ? firstCharacter.toUpperCase() : '?';
}

export default function ProfileAvatar({
  screenname,
  buddyIconPath = null,
  imageSrc = null,
  presenceState = null,
  size = 'md',
  tone = 'blue',
  className = '',
  showStatusDot = true,
}: ProfileAvatarProps) {
  const iconUrl = resolveBuddyIconUrl(imageSrc ?? buddyIconPath);
  const sizeClasses = SIZE_CLASSES[size];
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const visibleIconUrl = iconUrl && failedImageUrl !== iconUrl ? iconUrl : null;

  return (
    <div className={`relative shrink-0 ${className}`}>
      <div
        className={`flex ${sizeClasses.avatar} items-center justify-center overflow-hidden rounded-full font-bold ring-2 ring-offset-1 ring-offset-transparent ${getPresenceRingClass(presenceState)} ${presenceState === 'available' ? 'presence-ring-available' : ''} ${getFallbackToneClasses(tone)}`}
      >
        {visibleIconUrl ? (
          // Remote buddy icons may come from arbitrary user-provided URLs.
          // `img` avoids Next/Image host allowlist requirements for these avatars.
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={visibleIconUrl}
            alt={`${screenname} profile photo`}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setFailedImageUrl(visibleIconUrl)}
          />
        ) : (
          <span>{getInitial(screenname)}</span>
        )}
      </div>
      {showStatusDot && presenceState ? (
        <span
          className={`absolute -bottom-0.5 -right-0.5 ${sizeClasses.dot} rounded-full border-white/85 ${getPresenceDotClass(presenceState)}`}
        />
      ) : null}
    </div>
  );
}
