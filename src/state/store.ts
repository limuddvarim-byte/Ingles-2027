import { create } from 'zustand';
import { all, getLocalSettings, getSharedSettings, onChange, putMany, setLocalSettings, setSharedSettings } from '../core/db';
import { defaultLauncher } from '../core/defaults';
import { getSyncStatus, onSyncStatus, type SyncStatus } from '../core/sync';
import type { DraftDoc, LauncherItem, LocalSettings, Phrase, SharedSettings, WatchRecord } from '../core/types';
import { DEFAULT_LOCAL, DEFAULT_SHARED } from '../core/defaults';
import { get as dbGet } from '../core/db';

export type Page = 'home' | 'editor' | 'stats' | 'streaming' | 'settings';

export interface Toast {
  id: number;
  text: string;
  tone?: 'info' | 'success' | 'error';
  action?: { label: string; run: () => void };
}

interface State {
  ready: boolean;
  page: Page;
  phrases: Phrase[];
  launcher: LauncherItem[];
  watch: WatchRecord[];
  draft: DraftDoc | null;
  shared: SharedSettings;
  local: LocalSettings;
  sync: SyncStatus;
  toasts: Toast[];
  editorSeed: { html: string; nonce: number } | null;
  go(page: Page): void;
  toast(text: string, tone?: Toast['tone'], action?: Toast['action']): void;
  dismissToast(id: number): void;
  setShared(patch: Partial<SharedSettings>): Promise<void>;
  setLocal(patch: Partial<LocalSettings>): Promise<void>;
  seedEditor(html: string): void;
}

let toastId = 1;

export const useStore = create<State>((set, get) => ({
  ready: false,
  page: 'home',
  phrases: [],
  launcher: [],
  watch: [],
  draft: null,
  shared: DEFAULT_SHARED,
  local: DEFAULT_LOCAL,
  sync: getSyncStatus(),
  toasts: [],
  editorSeed: null,
  go(page) {
    set({ page });
    try {
      history.replaceState(null, '', `#${page}`);
    } catch {
      /* ignora */
    }
  },
  toast(text, tone = 'info', action) {
    const id = toastId++;
    set({ toasts: [...get().toasts.slice(-3), { id, text, tone, action }] });
    setTimeout(() => get().dismissToast(id), action ? 6000 : 2600);
  },
  dismissToast(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
  async setShared(patch) {
    set({ shared: { ...get().shared, ...patch } });
    await setSharedSettings(patch);
  },
  async setLocal(patch) {
    set({ local: { ...get().local, ...patch } });
    await setLocalSettings(patch);
  },
  seedEditor(html) {
    set({ editorSeed: { html, nonce: Date.now() }, page: 'editor' });
  },
}));

async function loadLauncher(): Promise<LauncherItem[]> {
  const items = await all('launcher', true);
  if (!items.length) {
    await putMany('launcher', defaultLauncher());
    return (await all('launcher')).sort((a, b) => a.order - b.order);
  }
  return items.filter((i) => !i.deleted).sort((a, b) => a.order - b.order);
}

export async function loadAll() {
  const [phrases, launcher, watch, draft, shared, local] = await Promise.all([
    all('phrases', true),
    loadLauncher(),
    all('watch'),
    dbGet('draft', 'main'),
    getSharedSettings(),
    getLocalSettings(),
  ]);
  const hash = (typeof location !== 'undefined' ? location.hash.slice(1) : '') as Page;
  useStore.setState({
    ready: true,
    phrases,
    launcher,
    watch,
    draft: draft ?? null,
    shared,
    local,
    ...(['home', 'editor', 'stats', 'streaming', 'settings'].includes(hash) ? { page: hash } : {}),
  });

  onChange(async (e) => {
    switch (e.c) {
      case 'phrases':
        useStore.setState({ phrases: await all('phrases', true) });
        break;
      case 'launcher':
        useStore.setState({ launcher: (await all('launcher')).sort((a, b) => a.order - b.order) });
        break;
      case 'watch':
        useStore.setState({ watch: await all('watch') });
        break;
      case 'draft':
        useStore.setState({ draft: (await dbGet('draft', 'main')) ?? null });
        break;
      case 'settings':
        useStore.setState({ shared: await getSharedSettings() });
        break;
      case 'meta':
        useStore.setState({ local: await getLocalSettings() });
        break;
    }
  });
  onSyncStatus((s) => useStore.setState({ sync: s }));
  window.addEventListener('hashchange', () => {
    const h = location.hash.slice(1) as Page;
    if (['home', 'editor', 'stats', 'streaming', 'settings'].includes(h) && h !== useStore.getState().page) useStore.setState({ page: h });
  });
}
