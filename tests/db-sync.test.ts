import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import * as db from '../src/core/db';
import { syncNow } from '../src/core/sync';
import { addManualWatch, addWatchSeconds } from '../src/core/watch';
import type { Phrase, SyncChange } from '../src/core/types';

// Servidor falso que imita o Worker (LWW + cursor).
function fakeServer() {
  const rows = new Map<string, SyncChange & { ts: number }>();
  let clock = 1000;
  const audio = new Map<string, Blob>();
  const handler = async (url: string, init: RequestInit = {}) => {
    const path = new URL(url).pathname;
    if ((init.headers as Record<string, string>)?.Authorization !== 'Bearer tok') return new Response('no', { status: 401 });
    if (path === '/sync') {
      const body = JSON.parse(String(init.body));
      for (const ch of body.changes as SyncChange[]) {
        const key = `${ch.c}:${ch.id}`;
        const cur = rows.get(key);
        if (!cur || cur.u < ch.u) rows.set(key, { ...ch, ts: ++clock });
      }
      const out = [...rows.values()].filter((r) => r.ts > body.since).sort((a, b) => a.ts - b.ts);
      return Response.json({ cursor: clock, changes: out.map(({ ts, ...r }) => r), more: false });
    }
    if (path.startsWith('/audio/')) {
      const id = decodeURIComponent(path.slice(7));
      if (init.method === 'PUT') { audio.set(id, init.body as Blob); return new Response('ok'); }
      const b = audio.get(id);
      return b ? new Response(b) : new Response('nf', { status: 404 });
    }
    return new Response('nf', { status: 404 });
  };
  return { rows, audio, handler };
}

const phrase = (id: string, text: string): Phrase => ({ id, html: `<p>${text}</p>`, text, back: '', audio: null, anki: null, createdAt: Date.now(), updatedAt: 0, learnedAt: null });

async function freshDevice() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new IDBFactory();
  db.__resetDB();
  await db.setLocalSettings({ syncUrl: 'https://sync.test', syncToken: 'tok' });
}

describe('banco local + sincronização', () => {
  let server: ReturnType<typeof fakeServer>;
  beforeEach(() => {
    server = fakeServer();
    vi.stubGlobal('fetch', (u: string, i: RequestInit) => server.handler(u, i));
  });

  it('put marca outbox e sync envia/limpa', async () => {
    await freshDevice();
    await db.put('phrases', phrase('p1', 'hello'));
    expect((await db.outbox()).length).toBe(1);
    const st = await syncNow();
    expect(st.state).toBe('ok');
    expect(server.rows.size).toBe(1);
    expect((await db.outbox()).length).toBe(0);
  });

  it('dois aparelhos convergem (LWW) e exclusões propagam', async () => {
    await freshDevice();
    await db.put('phrases', phrase('p1', 'A'));
    await db.put('phrases', phrase('p2', 'B'));
    await syncNow();

    await freshDevice(); // aparelho 2
    await syncNow();
    expect((await db.all('phrases')).map((p) => p.text).sort()).toEqual(['A', 'B']);
    const p1 = (await db.get('phrases', 'p1'))!;
    await new Promise((r) => setTimeout(r, 5));
    await db.put('phrases', { ...p1, text: 'A2' });
    await db.remove('phrases', 'p2');
    await syncNow();
    expect((server.rows.get('phrases:p1')!.data as Phrase).text).toBe('A2');
    expect(server.rows.get('phrases:p2')!.d).toBe(true);
  });

  it('registro remoto mais antigo não sobrescreve edição local', async () => {
    await freshDevice();
    const ok = await db.applyRemote('phrases', 'x', 10, { text: 'old' }, false);
    expect(ok).toBe(true);
    await db.put('phrases', { ...(await db.get('phrases', 'x'))!, text: 'new' });
    expect(await db.applyRemote('phrases', 'x', 11, { text: 'remote' }, false)).toBe(false);
    expect((await db.get('phrases', 'x'))!.text).toBe('new');
  });

  it('token errado vira erro amigável', async () => {
    await freshDevice();
    await db.setLocalSettings({ syncToken: 'bad' });
    const st = await syncNow();
    expect(st.state).toBe('error');
    expect(st.error).toContain('Token');
  });

  it('sem servidor configurado fica desligado', async () => {
    await freshDevice();
    await db.setLocalSettings({ syncUrl: '' });
    expect((await syncNow()).state).toBe('off');
  });

  it('contador de streaming acumula por dia/serviço', async () => {
    await freshDevice();
    await addWatchSeconds('netflix', 5);
    await addWatchSeconds('netflix', 7.5);
    await addWatchSeconds('youtube', 3);
    expect(await addWatchSeconds('youtube', -1)).toBeNull();
    expect(await addWatchSeconds('youtube', 99999)).toBeNull();
    const all = await db.all('watch');
    expect(all).toHaveLength(2);
    expect(all.find((w) => w.service === 'netflix')!.seconds).toBe(12.5);
    const m = await addManualWatch('disney', 30, '2026-01-01');
    expect(m.seconds).toBe(1800);
  });

  it('áudio sincroniza separado', async () => {
    await freshDevice();
    await db.putAudio({ id: 'a1', mime: 'audio/mpeg', data: new Blob(['x']), synced: false, createdAt: 1 });
    await syncNow();
    expect(server.audio.has('a1')).toBe(true);
    expect((await db.unsyncedAudio()).length).toBe(0);
  });

  it('configurações compartilhadas mesclam com padrões', async () => {
    await freshDevice();
    const s = await db.setSharedSettings({ theme: 'light', trackingPaused: { netflix: true } });
    expect(s.theme).toBe('light');
    expect((await db.getSharedSettings()).trackingPaused.netflix).toBe(true);
    expect((await db.getSharedSettings()).phraseSize).toBeGreaterThan(10);
  });
});
