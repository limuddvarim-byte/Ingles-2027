import { PLATFORM } from '../core/build';
import type { Platform } from './types';
import { createWebPlatform } from './web';
import { createDesktopPlatform } from './desktop';
import { createExtensionPlatform } from './extension';
import { createAndroidPlatform } from './android';

function detect(): Platform {
  if (PLATFORM === 'desktop' && typeof window !== 'undefined' && window.inglesDesktop) return createDesktopPlatform();
  if (PLATFORM === 'android') return createAndroidPlatform();
  if (PLATFORM === 'extension' && typeof chrome !== 'undefined' && chrome.runtime?.id) return createExtensionPlatform();
  const p = createWebPlatform();
  // Visualização no navegador: permite ver a interface de cada versão com ?as=android|desktop|extension
  const as = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('as') : null;
  if (as === 'extension') return { ...p, kind: 'extension', label: 'Extensão', features: { ...p.features, launcher: false, streamingTracker: true } };
  if (as === 'android') return { ...p, kind: 'android', label: 'App', features: { ...p.features, ocr: true, clones: true } };
  if (as === 'desktop') return { ...p, kind: 'desktop', label: 'Software', features: { ...p.features, autoStart: true } };
  return p;
}

export const platform: Platform = detect();
export type { Platform };
