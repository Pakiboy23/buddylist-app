/// <reference types="@capacitor/push-notifications" />

import { CapacitorConfig } from '@capacitor/cli';

const isHostedBuild = process.env.CAPACITOR_HOSTED === '1';
const hostedServerUrl = (process.env.CAPACITOR_SERVER_URL ?? 'https://hiitsme-app.vercel.app')
  .trim()
  .replace(/\/+$/, '');

const config: CapacitorConfig = {
  appId: 'com.hiitsme.app',
  appName: 'H.I.M.',
  // Bundled mode: Capacitor serves from dist/ (Vite output).
  // Hosted mode: Capacitor WebView points to the deployed Vercel URL.
  webDir: isHostedBuild ? 'public' : 'dist',
  ...(isHostedBuild
    ? {
        server: {
          url: hostedServerUrl,
        },
      }
    : {}),
  ios: {
    scheme: 'HIM',
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: 'LIGHT',
      backgroundColor: '#13100E',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
