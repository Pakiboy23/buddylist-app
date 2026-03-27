interface AppIconProps {
  kind:
    | 'attachment'
    | 'chat'
    | 'chevron'
    | 'close'
    | 'clock'
    | 'link'
    | 'mail'
    | 'menu'
    | 'moon'
    | 'smile'
    | 'sparkle';
  className?: string;
}

export default function AppIcon({ kind, className = 'h-5 w-5' }: AppIconProps) {
  switch (kind) {
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
