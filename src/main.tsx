import { createRoot } from 'react-dom/client';
import './styles/fonts.css';
import './styles/app.css';
import { App } from './App';
import { platform } from './platform';
import { loadAll } from './state/store';
import { startAutoSync } from './core/sync';

async function boot() {
  await platform.init();
  if (__PLATFORM__ === 'web' && new URLSearchParams(location.search).has('demo')) {
    await (await import('./dev/demo')).seedDemo();
    const th = new URLSearchParams(location.search).get('theme');
    if (th === 'light' || th === 'amoled') await (await import('./core/db')).setSharedSettings({ theme: th });
  }
  await loadAll();
  startAutoSync();
  if (platform.kind === 'android' && (window as unknown as { Capacitor?: { isNativePlatform(): boolean } }).Capacitor?.isNativePlatform()) {
    const { startAndroidTracking } = await import('./platform/android-tracking');
    startAndroidTracking();
  }
  createRoot(document.getElementById('root')!).render(<App />);
}

void boot();
