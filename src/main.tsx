import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/dm-sans';
import App from './App';
import './index.css';
import { Capacitor } from '@capacitor/core';
import { preloadSounds } from './lib/sound';

// Auto-reload as soon as an updated service worker takes control, so deploys
// show up on the first visit instead of the second refresh
registerSW({ immediate: true });

// Fetch + decode the card foley up front so the very first tap sounds real
preloadSounds();

// Native-only chrome: light status bar text over the dark felt
if (Capacitor.isNativePlatform()) {
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
