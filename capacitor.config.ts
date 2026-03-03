import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.buddylist.app', // Or whatever you typed during init
  appName: 'BuddyList',
  webDir: 'public', // We aren't really using this, but Capacitor requires the field
  server: {
    // Replace this with your actual Vercel production URL or your new custom domain
    url: 'https://buddylist-app.vercel.app',
    cleartext: true,
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: 'LIGHT',
      backgroundColor: '#1D4ED8',
    },
  },
};

export default config;
