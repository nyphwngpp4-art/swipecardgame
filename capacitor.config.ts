import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agavi.swipe',
  appName: 'Swipe',
  webDir: 'dist',
  // Felt green behind the webview — no white flash on launch/rotation
  backgroundColor: '#0F1B14',
};

export default config;
