// Banco local (IndexedDB) — funciona em páginas e no service worker da extensão.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CollectionMap, CollectionName, LocalSettings, SharedSettings } from './types';
import { DEFAULT_LOCAL, DEFAULT_SHARED } from './defaults';

export interface AudioEntry {
  id: string;
  mime: string;
  data: Blob;
  synced: boolean;
  createdAt: number;
}

interface OutboxEntry {
  key: string;
  c: CollectionName;
  id: string;
  u: number;
}

interface InglesDB extends DBSchema {
  phrases: { key: string; value: CollectionMap['phrases'] };
  launcher: { key: string; value: CollectionMap['launcher'] };
  watch: { key: string; value: CollectionMap['watch'] };
  draft: { key: string; value: CollectionMap['draft'] };
  settings: { key: string; value: CollectionMap['settings'] };
  outbox: { key: string; value: OutboxEntry };
  audio: { key: string; value: AudioEntry };
  meta: { key: string; value: unknown };
}

export const COLLECTIONS: CollectionName[] = ['phrases', 'launcher', 'watch', 'draft', 'settings'];

let dbPromise: Promise<IDBPDatabase<InglesDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<InglesDB>> {
  if (!dbPromise) {
    dbPromise = openDB<InglesDB>('ingles', 1, {
      upgrade(db) {
        for (const c of COLLECTIONS) db.createObjectStore(c, { keyPath: 'id' });
        db.createObjectStore('outbox', { keyPath: 'key' });
        db.createObjectStore('audio', { keyPath: 'id' });
        db.createObjectStore('meta');
      },
    });
  }
  return dbPromise;
}

/** Somente para testes. */
export function __resetDB() {
  dbPromise = null;
}

// ---------------------------------------------------------- notificações

export type ChangeEvent = { c: CollectionName | 'meta' | 'audio'; ids: string[]; remote?: boolean };
type Listener = (e: ChangeEvent) => void;
const listeners = new Set<Listener>();
let channel: BroadcastChannel | null = null;
try {
  channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ingles-db') : null;
  channel?.addEventListener('message', (ev) => listeners.forEach((l) => l(ev.data as ChangeEvent)));
} catch {
  channel = null;
}

export function onChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function emit(e: ChangeEvent) {
  listeners.forEach((l) => l(e));
  try {
    channel?.postMessage(e);
  } catch {
    /* ignora */
  }
}

let localChangeHook: (() => void) | null = null;
/** O motor de sync registra aqui para agendar envio após mudanças locais. */
export function setLocalChangeHook(fn: (() => void) | null) {
  localChangeHook = fn;
}

// ---------------------------------------------------------- CRUD

export async function all<C extends CollectionName>(c: C, includeDeleted = false): Promise<CollectionMap[C][]> {
  const db = await getDB();
  const rows = (await db.getAll(c)) as CollectionMap[C][];
  return includeDeleted ? rows : rows.filter((r) => !r.deleted);
}

export async function get<C extends CollectionName>(c: C, id: string): Promise<CollectionMap[C] | undefined> {
  const db = await getDB();
  return (await db.get(c, id)) as CollectionMap[C] | undefined;
}

/** Salva localmente, marca para sincronizar e avisa a interface. */
export async function put<C extends CollectionName>(c: C, rec: CollectionMap[C], opts: { touch?: boolean } = {}): Promise<CollectionMap[C]> {
  const db = await getDB();
  const value = { ...rec, updatedAt: opts.touch === false ? rec.updatedAt : Math.max(Date.now(), (rec.updatedAt ?? 0) + 1) } as CollectionMap[C];
  const tx = db.transaction([c, 'outbox'], 'readwrite');
  await tx.objectStore(c).put(value as never);
  await tx.objectStore('outbox').put({ key: `${c}:${value.id}`, c, id: value.id, u: value.updatedAt });
  await tx.done;
  emit({ c, ids: [value.id] });
  localChangeHook?.();
  return value;
}

export async function putMany<C extends CollectionName>(c: C, recs: CollectionMap[C][]): Promise<void> {
  if (!recs.length) return;
  const db = await getDB();
  const tx = db.transaction([c, 'outbox'], 'readwrite');
  let now = Date.now();
  for (const rec of recs) {
    const value = { ...rec, updatedAt: Math.max(now++, (rec.updatedAt ?? 0) + 1) };
    await tx.objectStore(c).put(value as never);
    await tx.objectStore('outbox').put({ key: `${c}:${value.id}`, c, id: value.id, u: value.updatedAt });
  }
  await tx.done;
  emit({ c, ids: recs.map((r) => r.id) });
  localChangeHook?.();
}

/** Exclusão definitiva (vira tombstone para sincronizar). */
export async function remove(c: CollectionName, id: string): Promise<void> {
  const cur = await get(c, id);
  if (!cur) return;
  await put(c, { ...cur, deleted: true } as never);
}

// ---------------------------------------------------------- meta

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const db = await getDB();
  const v = (await db.get('meta', key)) as T | undefined;
  return v === undefined ? fallback : v;
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put('meta', value as unknown, key);
  emit({ c: 'meta', ids: [key] });
}

export async function getDeviceId(): Promise<string> {
  let id = await getMeta<string>('deviceId', '');
  if (!id) {
    id = `dev-${uid().slice(0, 12)}`;
    await setMeta('deviceId', id);
  }
  return id;
}

export async function getLocalSettings(): Promise<LocalSettings> {
  const v = await getMeta<Partial<LocalSettings>>('local', {});
  return { ...DEFAULT_LOCAL, ...v };
}

export async function setLocalSettings(patch: Partial<LocalSettings>): Promise<LocalSettings> {
  const next = { ...(await getLocalSettings()), ...patch };
  await setMeta('local', next);
  return next;
}

export async function getSharedSettings(): Promise<SharedSettings> {
  const rec = await get('settings', 'shared');
  return { ...DEFAULT_SHARED, ...(rec?.value ?? {}), trackingPaused: { ...(rec?.value?.trackingPaused ?? {}) } };
}

export async function setSharedSettings(patch: Partial<SharedSettings>): Promise<SharedSettings> {
  const cur = await getSharedSettings();
  const value = { ...cur, ...patch };
  await put('settings', { id: 'shared', updatedAt: Date.now(), value });
  return value;
}

// ---------------------------------------------------------- outbox (sync)

export async function outbox(): Promise<OutboxEntry[]> {
  const db = await getDB();
  return db.getAll('outbox');
}

export async function clearOutbox(entries: OutboxEntry[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('outbox', 'readwrite');
  for (const e of entries) {
    const cur = await tx.store.get(e.key);
    // só limpa se não houve outra edição durante o envio
    if (cur && cur.u === e.u) await tx.store.delete(e.key);
  }
  await tx.done;
}

/** Aplica um registro vindo do servidor (Last-Write-Wins por registro). */
export async function applyRemote(c: CollectionName, id: string, u: number, data: unknown, deleted: boolean): Promise<boolean> {
  const db = await getDB();
  const tx = db.transaction([c, 'outbox'], 'readwrite');
  const local = (await tx.objectStore(c).get(id)) as { updatedAt: number } | undefined;
  if (local && local.updatedAt >= u) {
    await tx.done;
    return false;
  }
  const value = deleted ? { ...(local ?? {}), ...(data as object), id, updatedAt: u, deleted: true } : { ...(data as object), id, updatedAt: u };
  await tx.objectStore(c).put(value as never);
  const ob = await tx.objectStore('outbox').get(`${c}:${id}`);
  if (ob && ob.u <= u) await tx.objectStore('outbox').delete(`${c}:${id}`);
  await tx.done;
  return true;
}

// ---------------------------------------------------------- áudio

export async function putAudio(entry: AudioEntry): Promise<void> {
  const db = await getDB();
  await db.put('audio', entry);
  emit({ c: 'audio', ids: [entry.id] });
  localChangeHook?.();
}

export async function getAudio(id: string): Promise<AudioEntry | undefined> {
  const db = await getDB();
  return db.get('audio', id);
}

export async function unsyncedAudio(): Promise<AudioEntry[]> {
  const db = await getDB();
  return (await db.getAll('audio')).filter((a) => !a.synced);
}

export async function markAudioSynced(id: string): Promise<void> {
  const db = await getDB();
  const a = await db.get('audio', id);
  if (a) await db.put('audio', { ...a, synced: true });
}

export async function deleteAudio(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('audio', id);
}

// ---------------------------------------------------------- util

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
