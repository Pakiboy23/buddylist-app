import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BuddyList',
    short_name: 'BuddyList',
    description: 'BuddyList messenger',
    start_url: '/',
    display: 'standalone',
    background_color: '#eef4ff',
    theme_color: '#1d4ed8',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
