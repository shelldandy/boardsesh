import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.boardsesh.app',
  appName: 'Boardsesh',
  server: {
    url: process.env.CAPACITOR_DEV_URL ?? 'https://www.boardsesh.com',
    allowNavigation: ['boardsesh.com', '*.boardsesh.com', '*.ts.net'],
  },
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    backgroundColor: '#0A0A0A',
    limitsNavigationsToAppBoundDomains: true,
  },
  android: {
    backgroundColor: '#0A0A0A',
    overScrollMode: 'never',
  },
};

export default config;
