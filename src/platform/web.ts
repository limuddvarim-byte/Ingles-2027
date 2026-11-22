// Versão navegador (dev/web) — base também para a extensão.
import { getLocalSettings } from '../core/db';
import { AI_TARGETS } from '../core/prompts';
import type { LauncherItem } from '../core/types';
import { ankiConnect } from './ankiconnect';
import { fetchLatestRelease } from './shared';
import type { HttpRequest, HttpResponse, Platform } from './types';

export async function fetchHttp(req: HttpRequest): Promise<HttpResponse> {
  const isJsonBody = req.body !== undefined && typeof req.body !== 'string';
  const res = await fetch(req.url, {
    method: req.method ?? (req.body ? 'POST' : 'GET'),
    headers: { ...(isJsonBody ? { 'Content-Type': 'application/json' } : {}), ...(req.headers ?? {}) },
    body: req.body === undefined ? undefined : isJsonBody ? JSON.stringify(req.body) : (req.body as string),
  });
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => (headers[k] = v));
  let data: unknown;
  if (req.responseType === 'arraybuffer') data = await res.arrayBuffer();
  else if (req.responseType === 'text') data = await res.text();
  else data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data, headers };
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

export function createWebPlatform(): Platform {
  const p: Platform = {
    kind: 'web',
    label: 'Navegador',
    features: { launcher: true, ocr: false, autoStart: false, streamingTracker: false, clones: false },
    async init() {},
    copy: copyText,
    async readClipboard() {
      try {
        return await navigator.clipboard.readText();
      } catch {
        return '';
      }
    },
    http: fetchHttp,
    async openUrls(urls) {
      urls.forEach((u) => window.open(u, '_blank', 'noopener'));
    },
    async openLauncherItem(item: LauncherItem) {
      await p.openUrls(item.urls);
    },
    async openClone(_kind, tabs) {
      await p.openUrls(tabs.map((t) => t.url));
    },
    async openAIs(prompt) {
      await p.copy(prompt);
      await p.openUrls(AI_TARGETS.map((t) => t.url(prompt)));
      return 'opened';
    },
    anki: ankiConnect(fetchHttp, async () => (await getLocalSettings()).ankiConnectUrl),
    checkUpdate: () => Promise.resolve({ available: false }),
    async installUpdate(info) {
      if (info.url) window.open(info.url, '_blank');
    },
  };
  return p;
}

export { fetchLatestRelease };
