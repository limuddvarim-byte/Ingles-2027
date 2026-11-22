// Motor de sincronização com o servidor Cloudflare (Worker + D1).
// Estratégia: Last-Write-Wins por registro, com cursor do servidor.
import {
  applyRemote,
  clearOutbox,
  emit,
  get,
  getAudio,
  getDeviceId,
  getLocalSettings,
  getMeta,
  markAudioSynced,
  outbox,
  putAudio,
  setLocalChangeHook,
  setLocalSettings,
  setMeta,
  unsyncedAudio,
} from './db';
import type { CollectionName, SyncChange } from './types';

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'ok' | 'error' | 'off';
  at: number;
  error?: string;
  pushed?: number;
  pulled?: number;
}

let status: SyncStatus = { state: 'off', at: 0 };
const statusListeners = new Set<(s: SyncStatus) => void>();
export const getSyncStatus = () => status;
export function onSyncStatus(fn: (s: SyncStatus) => void) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}
function setStatus(s: SyncStatus) {
  status = s;
  statusListeners.forEach((l) => l(s));
}

export function normalizeUrl(url: string): string {
  let u = url.trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u.replace(/\/+$/, '');
}

async function call(path: string, init: RequestInit = {}) {
  const local = await getLocalSettings();
  const base = normalizeUrl(local.syncUrl);
  if (!base) throw new Error('Servidor de sincronização não configurado');
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${local.syncToken}`,
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401) throw new Error('Token de sincronização inválido');
  if (!res.ok) throw new Error(`Servidor respondeu ${res.status}`);
  return res;
}

export async function testConnection(url: string, token: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${normalizeUrl(url)}/health`, { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) return { ok: false, message: 'Token incorreto' };
    if (!res.ok) return { ok: false, message: `Erro ${res.status}` };
    return { ok: true, message: `Conectado • ${body.records ?? 0} registros no servidor` };
  } catch (e) {
    return { ok: false, message: `Sem conexão: ${(e as Error).message}` };
  }
}

let running: Promise<SyncStatus> | null = null;

export function syncNow(): Promise<SyncStatus> {
  if (!running) running = doSync().finally(() => (running = null));
  return running;
}

async function doSync(): Promise<SyncStatus> {
  const local = await getLocalSettings();
  if (!local.syncUrl || !local.syncToken) {
    setStatus({ state: 'off', at: Date.now() });
    return status;
  }
  setStatus({ ...status, state: 'syncing' });
  try {
    const device = await getDeviceId();
    let cursor = await getMeta<number>('syncCursor', 0);
    const pending = await outbox();
    const changes: SyncChange[] = [];
    for (const e of pending) {
      const rec = await get(e.c, e.id);
      if (!rec) continue;
      const { id, updatedAt, deleted, ...data } = rec as unknown as Record<string, unknown> & { id: string; updatedAt: number; deleted?: boolean };
      changes.push({ c: e.c, id, u: updatedAt, d: !!deleted, data });
    }

    let pulled = 0;
    let first = true;
    let more = true;
    while (more) {
      const res = await call('/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ since: cursor, device, changes: first ? changes : [] }),
      });
      const body = (await res.json()) as { cursor: number; changes: SyncChange[]; more?: boolean };
      if (first) await clearOutbox(pending);
      first = false;
      const touched = new Map<CollectionName, string[]>();
      for (const ch of body.changes ?? []) {
        const applied = await applyRemote(ch.c, ch.id, ch.u, ch.data ?? {}, !!ch.d);
        if (applied) {
          pulled++;
          touched.set(ch.c, [...(touched.get(ch.c) ?? []), ch.id]);
        }
      }
      touched.forEach((ids, c) => emit({ c, ids, remote: true }));
      cursor = body.cursor ?? cursor;
      await setMeta('syncCursor', cursor);
      more = !!body.more;
    }

    // Áudios (ElevenLabs) vão separados por serem binários.
    for (const a of await unsyncedAudio()) {
      await call(`/audio/${encodeURIComponent(a.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': a.mime || 'audio/mpeg' },
        body: a.data,
      });
      await markAudioSynced(a.id);
    }

    await setLocalSettings({ lastSyncAt: Date.now(), lastSyncError: '' });
    setStatus({ state: 'ok', at: Date.now(), pushed: changes.length, pulled });
  } catch (e) {
    const msg = (e as Error).message || String(e);
    await setLocalSettings({ lastSyncError: msg });
    setStatus({ state: 'error', at: Date.now(), error: msg });
  }
  return status;
}

/** Busca um áudio no servidor se ele ainda não existir neste aparelho. */
export async function ensureAudio(id: string): Promise<Blob | null> {
  const localAudio = await getAudio(id);
  if (localAudio) return localAudio.data;
  try {
    const res = await call(`/audio/${encodeURIComponent(id)}`);
    const blob = await res.blob();
    await putAudio({ id, mime: blob.type || 'audio/mpeg', data: blob, synced: true, createdAt: Date.now() });
    return blob;
  } catch {
    return null;
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
let interval: ReturnType<typeof setInterval> | null = null;

/** Inicia sincronização automática: após mudanças (3s) e a cada minuto. */
export function startAutoSync(periodMs = 60_000) {
  setLocalChangeHook(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), 3000);
  });
  if (!interval) interval = setInterval(() => void syncNow(), periodMs);
  void syncNow();
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void syncNow();
    });
  }
  if (typeof window !== 'undefined') window.addEventListener('online', () => void syncNow());
}
