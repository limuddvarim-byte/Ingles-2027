// Versão software (Windows/Electron).
import { getLocalSettings } from '../core/db';
import { AI_TARGETS } from '../core/prompts';
import { ankiConnect } from './ankiconnect';
import type { Platform } from './types';
import { createWebPlatform } from './web';

export function createDesktopPlatform(): Platform {
  const bridge = window.inglesDesktop!;
  const base = createWebPlatform();
  const openUrls = async (urls: string[]) => {
    const l = await getLocalSettings();
    const r = await bridge.openUrls(urls, l.browserMode, l.chromePath || undefined);
    if (!r.ok && r.message) throw new Error(r.message);
  };
  return {
    ...base,
    kind: 'desktop',
    label: 'Software',
    features: { launcher: true, ocr: false, autoStart: true, streamingTracker: false, clones: false },
    copy: (t) => bridge.copy(t),
    readClipboard: () => bridge.readClipboard(),
    http: (r) => bridge.http(r),
    openUrls,
    async openLauncherItem(item) {
      await openUrls(item.urls);
    },
    async openClone(_k, tabs) {
      await openUrls(tabs.map((t) => t.url));
    },
    async openAIs(prompt) {
      await bridge.copy(prompt);
      await openUrls(AI_TARGETS.map((t) => t.url(prompt)));
      return 'opened';
    },
    anki: ankiConnect((r) => bridge.http(r), async () => (await getLocalSettings()).ankiConnectUrl),
    getAutoStart: () => bridge.getAutoStart(),
    setAutoStart: (on) => bridge.setAutoStart(on),
    checkUpdate: () => bridge.checkUpdate(),
    installUpdate: () => bridge.installUpdate(),
    onUpdate: (fn) => bridge.onUpdate(fn),
    desktop: {
      setupExtension: async () => bridge.setupExtension((await getLocalSettings()).chromePath || undefined),
      openExtensionFolder: () => bridge.openExtensionFolder(),
      chromeStatus: async () => bridge.chromeStatus((await getLocalSettings()).chromePath || undefined),
    },
  };
}
