import { CapacitorConfig } from '@capacitor/cli';

const isHostedBuild = process.env.CAPACITOR_HOSTED === '1';
const hostedServerUrl = (process.env.CAPACITOR_SERVER_URL ?? 'https://buddylist-app.vercel.app')
  .trim()
  .replace(/\/+$/, '');

const config: CapacitorConfig = {
  appId: 'com.buddylist.app',
  appName: 'BuddyList',
  // Default to bundled native assets for release-safe syncs.
  webDir: isHostedBuild ? 'public' : 'native-web',
  ...(isHostedBuild
    ? {
        server: {
          url: hostedServerUrl,
        },
      }
    : {}),
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: 'LIGHT',
      backgroundColor: '#1D4ED8',
    },
  },
};

export default config;
