// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker, { handleSync } from '../src/index';

/** Imitação mínima do D1 sobre SQLite em memória. */
function fakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    first: async <T>() => (db.prepare(sql).get(...(args as never[])) as T) ?? null,
    all: async <T>() => ({ results: db.prepare(sql).all(...(args as never[])) as T[] }),
    run: async () => db.prepare(sql).run(...(args.map((x) => (x instanceof ArrayBuffer ? new Uint8Array(x) : x)) as never[])),
  });
  return { prepare: (sql: string) => stmt(sql), batch: async (s: { run(): Promise<unknown> }[]) => { for (const x of s) await x.run(); return []; } } as unknown as D1Database;
}

describe('Worker de sincronização', () => {
  it('LWW: só aceita versão mais nova e pagina pelo cursor', async () => {
    const db = fakeD1();
    let r = await handleSync(db, { since: 0, changes: [{ c: 'phrases', id: 'a', u: 10, data: { text: 'v1' } }] });
    expect(r.changes).toHaveLength(1);
    const cur = r.cursor;
    r = await handleSync(db, { since: cur, changes: [{ c: 'phrases', id: 'a', u: 5, data: { text: 'velho' } }] });
    const all = await handleSync(db, { since: 0 });
    expect((all.changes[0].data as { text: string }).text).toBe('v1');
    await handleSync(db, { since: cur, changes: [{ c: 'phrases', id: 'a', u: 20, d: true, data: {} }] });
    const after = await handleSync(db, { since: cur });
    expect(after.changes[0].d).toBe(true);
  });

  it('ignora coleções inválidas', async () => {
    const db = fakeD1();
    const r = await handleSync(db, { since: 0, changes: [{ c: 'hack', id: 'x', u: 1, data: {} }] });
    expect(r.changes).toHaveLength(0);
  });

  it('exige token e responde CORS', async () => {
    const env = { DB: fakeD1(), SYNC_TOKEN: 'segredo' };
    const no = await worker.fetch(new Request('https://w/health'), env);
    expect(no.status).toBe(401);
    expect(no.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const ok = await worker.fetch(new Request('https://w/health', { headers: { Authorization: 'Bearer segredo' } }), env);
    expect(await ok.json()).toEqual({ ok: true, records: 0 });
    const opt = await worker.fetch(new Request('https://w/sync', { method: 'OPTIONS' }), env);
    expect(opt.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });

  it('guarda e devolve áudio', async () => {
    const env = { DB: fakeD1(), SYNC_TOKEN: 't' };
    const h = { Authorization: 'Bearer t', 'Content-Type': 'audio/mpeg' };
    await worker.fetch(new Request('https://w/audio/aud-1', { method: 'PUT', headers: h, body: new Uint8Array([1, 2, 3]) }), env);
    const r = await worker.fetch(new Request('https://w/audio/aud-1', { headers: h }), env);
    expect(r.headers.get('Content-Type')).toBe('audio/mpeg');
    expect([...new Uint8Array(await r.arrayBuffer())]).toEqual([1, 2, 3]);
  });
});
