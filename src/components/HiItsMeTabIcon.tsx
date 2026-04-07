interface HiItsMeTabIconProps {
  kind: 'im' | 'chat' | 'buddy' | 'profile';
  className?: string;
}

export default function HiItsMeTabIcon({
  kind,
  className = 'h-5 w-5',
}: HiItsMeTabIconProps) {
  switch (kind) {
    case 'im':
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v6A2.5 2.5 0 0 1 16.5 16h-5.25L7 19v-3H7.5A2.5 2.5 0 0 1 5 13.5z" />
          <path d="M9 9.5h6" />
          <path d="M9 12.5h4" />
        </svg>
      );
    case 'chat':
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h8a2.5 2.5 0 0 1 2.5 2.5V12A2.5 2.5 0 0 1 15 14.5h-4.5L7 17v-2.5A2.5 2.5 0 0 1 4.5 12z" />
          <path d="M9.5 18.5h4A2.5 2.5 0 0 0 16 16v-.5" />
        </svg>
      );
    case 'buddy':
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          <path d="M5.5 19.25c1.3-2.5 3.5-3.75 6.5-3.75s5.2 1.25 6.5 3.75" />
          <path d="M18.5 7v4" />
          <path d="M16.5 9h4" />
        </svg>
      );
    case 'profile':
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M12 9.75A2.75 2.75 0 1 0 12 4.25a2.75 2.75 0 0 0 0 5.5Z" />
          <path d="M6.75 19.25c1.1-2 2.85-3 5.25-3s4.15 1 5.25 3" />
          <path d="m19.35 10.9.55 1.1 1.25.25-.9.9.2 1.3-1.1-.55-1.1.55.2-1.3-.9-.9 1.25-.25z" />
        </svg>
      );
  }
}
