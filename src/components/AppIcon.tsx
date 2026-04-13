interface AppIconProps {
  kind:
    | 'add'
    | 'attachment'
    | 'bolt'
    | 'buddy'
    | 'chat'
    | 'check'
    | 'chevron'
    | 'close'
    | 'clock'
    | 'flag'
    | 'lock'
    | 'link'
    | 'mail'
    | 'media'
    | 'menu'
    | 'mic'
    | 'moon'
    | 'search'
    | 'shield'
    | 'smile'
    | 'sparkle';
  className?: string;
}

export default function AppIcon({ kind, className = 'h-5 w-5' }: AppIconProps) {
  switch (kind) {
    case 'add':
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case 'attachment':
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
          <path d="M8.5 12.5 14 7a3 3 0 1 1 4.25 4.25L10 19.5a5 5 0 0 1-7-7l8-8" />
        </svg>
      );
    case 'bolt':
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
          <path d="M13 2 4.5 13H12l-1 9L19.5 11H12z" />
        </svg>
      );
    case 'buddy':
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <circle cx="12" cy="6.5" r="3" />
          <path d="M9 12.5 7 20" />
          <path d="M15 12.5 17 20" />
          <path d="M8 12.5c1-.8 2.5-1.2 4-1.2s3 .4 4 1.2" />
          <path d="M10.5 16h3" />
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
          <path d="M9 9.5h6" />
          <path d="M9 12.5h4" />
        </svg>
      );
    case 'check':
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M5 12.5 10 17.5 19 7" />
        </svg>
      );
    case 'chevron':
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      );
    case 'close':
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M6 6 18 18" />
          <path d="M18 6 6 18" />
        </svg>
      );
    case 'clock':
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
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2.5 2.5" />
        </svg>
      );
    case 'flag':
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
          <path d="M6 20V5" />
          <path d="M6 6c2-1.5 4-1.5 6 0s4 1.5 6 0v8c-2 1.5-4 1.5-6 0s-4-1.5-6 0" />
        </svg>
      );
    case 'lock':
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
          <rect x="5.5" y="10" width="13" height="10" rx="2.5" />
          <path d="M8.5 10V8a3.5 3.5 0 1 1 7 0v2" />
        </svg>
      );
    case 'link':
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
          <path d="M10 13.5 14 9.5" />
          <path d="M7.25 15.75a3.25 3.25 0 0 1 0-4.6l2.1-2.1a3.25 3.25 0 0 1 4.6 0" />
          <path d="M16.75 8.25a3.25 3.25 0 0 1 0 4.6l-2.1 2.1a3.25 3.25 0 0 1-4.6 0" />
        </svg>
      );
    case 'mail':
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
          <path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h10a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 17 19H7a2.5 2.5 0 0 1-2.5-2.5z" />
          <path d="m6 8 6 5 6-5" />
        </svg>
      );
    case 'media':
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
          <rect x="4.5" y="5" width="15" height="14" rx="2.5" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="m19.5 15-4.8-4.8a1.5 1.5 0 0 0-2.12 0L7 15" />
          <path d="m11.5 15 1.8-1.8a1.5 1.5 0 0 1 2.12 0l2.1 2.1" />
        </svg>
      );
    case 'menu':
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
        >
          <circle cx="6" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="18" cy="12" r="1.5" />
        </svg>
      );
    case 'mic':
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
          <rect x="9" y="4" width="6" height="10" rx="3" />
          <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0" />
          <path d="M12 17v3" />
          <path d="M9 20h6" />
        </svg>
      );
    case 'moon':
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
          <path d="M15.5 3.5a7.5 7.5 0 1 0 5 13 8 8 0 1 1-5-13Z" />
        </svg>
      );
    case 'smile':
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
          <circle cx="12" cy="12" r="8" />
          <path d="M9 10h.01" />
          <path d="M15 10h.01" />
          <path d="M8.5 14c.9 1.2 2 1.8 3.5 1.8s2.6-.6 3.5-1.8" />
        </svg>
      );
    case 'search':
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
          <circle cx="10.5" cy="10.5" r="6" />
          <path d="m15 15 5.5 5.5" />
        </svg>
      );
    case 'shield':
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
          <path d="M12 4 18 6.5v5.2c0 3.6-2.3 6.8-6 8.3-3.7-1.5-6-4.7-6-8.3V6.5Z" />
          <path d="m9.5 11.5 1.7 1.7 3.3-3.7" />
        </svg>
      );
    case 'sparkle':
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
        >
          <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" />
        </svg>
      );
  }
}
