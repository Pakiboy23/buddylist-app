import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'H.I.M.',
    short_name: 'H.I.M.',
    description: 'H.I.M. messenger',
    start_url: '/',
    display: 'standalone',
    background_color: '#13100E',
    theme_color: '#13100E',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
