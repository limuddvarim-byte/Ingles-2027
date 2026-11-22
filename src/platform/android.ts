// Versão app (Android/Capacitor).
import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Clipboard } from '@capacitor/clipboard';
import { App } from '@capacitor/app';
import { AI_TARGETS } from '../core/prompts';
import type { CloneKind, LauncherItem } from '../core/types';
import { blobToBase64 } from './ankiconnect';
import { compareVersions, fetchLatestRelease, geminiFillScript } from './shared';
import type { AnkiDeck, CloneTab, HttpRequest, HttpResponse, Platform } from './types';

interface InglesNative {
  openClone(o: { kind: string; tabs: CloneTab[]; start?: number }): Promise<void>;
  openApp(o: { package?: string | null; url: string }): Promise<{ opened: 'app' | 'browser' }>;
  ocr(o: { path: string }): Promise<{ text: string }>;
  ankiStatus(): Promise<{ installed: boolean; permission: boolean }>;
  ankiRequestPermission(): Promise<{ granted: boolean }>;
  ankiDecks(): Promise<{ decks: AnkiDeck[] }>;
  ankiCreateDeck(o: { name: string }): Promise<{ id: string }>;
  ankiAddNote(o: { deck: string; front: string; back: string; notes: string; audioBase64?: string; audioName?: string }): Promise<{ id: string }>;
  installApk(o: { url: string }): Promise<void>;
  appInfo(): Promise<{ version: string; build: number }>;
  trackingStatus(): Promise<{ notification: boolean; accessibility: boolean }>;
  openNotificationAccess(): Promise<void>;
  openAccessibility(): Promise<void>;
}

const Native = registerPlugin<InglesNative>('Ingles');

function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}

async function nativeHttp(req: HttpRequest): Promise<HttpResponse> {
  const isJson = req.body !== undefined && typeof req.body !== 'string';
  const res = await CapacitorHttp.request({
    url: req.url,
    method: req.method ?? (req.body ? 'POST' : 'GET'),
    headers: { ...(isJson ? { 'Content-Type': 'application/json' } : {}), ...(req.headers ?? {}) },
    data: req.body,
    responseType: req.responseType === 'arraybuffer' ? 'arraybuffer' : req.responseType === 'text' ? 'text' : 'json',
  });
  let data: unknown = res.data;
  if (req.responseType === 'arraybuffer' && typeof data === 'string') data = b64ToArrayBuffer(data);
  return { status: res.status, ok: res.status >= 200 && res.status < 300, data, headers: res.headers ?? {} };
}

const CLONE_PROFILE: Record<Exclude<CloneKind, null>, string> = {
  realworld: 'realworld',
  youtube: 'youtube',
  chatgpt: 'chatgpt',
  gemini: 'gemini',
  claude: 'claude',
};

export function createAndroidPlatform(): Platform {
  const p: Platform = {
    kind: 'android',
    label: 'App',
    features: { launcher: true, ocr: true, autoStart: false, streamingTracker: false, clones: true },
    async init() {
      App.addListener('backButton', ({ canGoBack }) => {
        const ev = new CustomEvent('ingles:back', { cancelable: true });
        window.dispatchEvent(ev);
        if (ev.defaultPrevented) return;
        if (canGoBack) history.back();
        else void App.minimizeApp();
      });
    },
    async copy(text) {
      await Clipboard.write({ string: text });
    },
    async readClipboard() {
      const r = await Clipboard.read();
      return r.value ?? '';
    },
    http: nativeHttp,
    async openUrls(urls) {
      for (const url of urls) await Native.openApp({ url });
    },
    async openLauncherItem(item: LauncherItem) {
      if (item.clone) {
        await p.openClone(item.clone, item.urls.map((url, i) => ({ title: item.urls.length > 1 ? `${item.name} ${i + 1}` : item.name, url, profile: CLONE_PROFILE[item.clone!], service: item.service ?? null })));
        return;
      }
      if (item.urls.length > 1) {
        // grupo de páginas → abas no navegador isolado
        await p.openClone('chatgpt', item.urls.map((url) => ({ title: new URL(url).hostname.replace('www.', ''), url, profile: `group-${item.id}` })));
        return;
      }
      await Native.openApp({ package: item.androidPackage ?? null, url: item.urls[0] });
    },
    async openClone(kind, tabs) {
      await Native.openClone({ kind: kind ?? 'web', tabs });
    },
    async openAIs(prompt) {
      await p.copy(prompt);
      const tabs: CloneTab[] = AI_TARGETS.map((t) => ({
        title: t.name,
        url: t.id === 'gemini' ? 'https://gemini.google.com/app' : t.url(prompt),
        profile: CLONE_PROFILE[t.id],
        inject: t.id === 'gemini' ? geminiFillScript(prompt) : undefined,
      }));
      await Native.openClone({ kind: 'ai', tabs, start: 0 });
      return 'opened';
    },
    anki: {
      describe: () => 'AnkiDroid neste celular',
      async available() {
        const s = await Native.ankiStatus();
        if (!s.installed) return { ok: false, message: 'AnkiDroid não está instalado' };
        if (!s.permission) {
          const r = await Native.ankiRequestPermission();
          if (!r.granted) return { ok: false, message: 'Permita o acesso ao AnkiDroid' };
        }
        return { ok: true, message: 'AnkiDroid conectado' };
      },
      async decks() {
        return (await Native.ankiDecks()).decks;
      },
      async createDeck(name) {
        await Native.ankiCreateDeck({ name });
      },
      async addNote(note) {
        const { splitNotes } = await import('./ankiconnect');
        const { front, notes } = splitNotes(note.front);
        await Native.ankiAddNote({ deck: note.deck, front, back: note.back, notes, audioBase64: note.audio?.base64, audioName: note.audio?.filename });
      },
    },
    async ocr(source) {
      const photo = await Camera.getPhoto({
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
        resultType: CameraResultType.Uri,
        quality: 95,
        correctOrientation: true,
        promptLabelHeader: 'Ler texto de imagem',
      });
      if (!photo.path) throw new Error('Nenhuma imagem selecionada');
      const r = await Native.ocr({ path: photo.path });
      return r.text;
    },
    tracking: {
      status: () => Native.trackingStatus(),
      openNotificationSettings: () => Native.openNotificationAccess(),
      openAccessibilitySettings: () => Native.openAccessibility(),
    },
    async checkUpdate() {
      const info = await Native.appInfo().catch(() => ({ version: '0.0.0', build: 0 }));
      const latest = await fetchLatestRelease('.apk', info.version);
      return { ...latest, available: latest.available && compareVersions(latest.version ?? '0', info.version) > 0 };
    },
    async installUpdate(info) {
      if (info.url) await Native.installApk({ url: info.url });
    },
  };
  return p;
}

export const isNative = () => Capacitor.isNativePlatform();
export { blobToBase64 };
