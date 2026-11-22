// Versão extensão do Chrome: frases (sem launcher), cronômetro de streaming e estatísticas.
import { AI_TARGETS } from '../core/prompts';
import { fetchLatestRelease } from './shared';
import type { Platform } from './types';
import { createWebPlatform } from './web';

export function createExtensionPlatform(): Platform {
  const base = createWebPlatform();
  const openUrls = async (urls: string[]) => {
    for (const [i, url] of urls.entries()) await chrome.tabs.create({ url, active: i === 0 });
  };
  return {
    ...base,
    kind: 'extension',
    label: 'Extensão',
    features: { launcher: false, ocr: false, autoStart: false, streamingTracker: true, clones: false },
    openUrls,
    async openLauncherItem(item) {
      await openUrls(item.urls);
    },
    async openClone(_k, tabs) {
      await openUrls(tabs.map((t) => t.url));
    },
    async openAIs(prompt) {
      await base.copy(prompt);
      await openUrls(AI_TARGETS.map((t) => t.url(prompt)));
      return 'opened';
    },
    checkUpdate: () => fetchLatestRelease('.zip', chrome.runtime.getManifest().version),
    async installUpdate(info) {
      if (info.url) await chrome.tabs.create({ url: info.url });
    },
  };
}
