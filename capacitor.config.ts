import { CapacitorConfig } from '@capacitor/cli';

const isBundledBuild = process.env.CAPACITOR_BUNDLED === '1';

const config: CapacitorConfig = {
  appId: 'com.buddylist.app',
  appName: 'BuddyList',
  webDir: isBundledBuild ? 'native-web' : 'public',
  ...(isBundledBuild
    ? {}
    : {
        server: {
          url: 'https://buddylist-app.vercel.app',
          cleartext: true,
        },
      }),
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: 'LIGHT',
      backgroundColor: '#1D4ED8',
    },
  },
};

export default config;
