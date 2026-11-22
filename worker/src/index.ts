// Servidor de sincronização da tríade "Inglês" — Cloudflare Worker + D1.
// Rotas: GET /health · POST /sync · GET|PUT /audio/:id · GET /update
export interface Env {
  DB: D1Database;
  SYNC_TOKEN: string;
  /** opcional: repositório para a rota /update (padrão: limuddvarim-byte/Ingles-2027) */
  REPO?: string;
}

interface Change {
  c: string;
  id: string;
  u: number;
  d?: boolean;
  data?: unknown;
}

const COLLECTIONS = new Set(['phrases', 'launcher', 'watch', 'draft', 'settings']);
const PAGE = 500;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });

/** Comparação em tempo constante do token. */
function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function nextClock(db: D1Database, n: number): Promise<number> {
  const row = await db.prepare("UPDATE meta SET v = v + ?1 WHERE k = 'clock' RETURNING v").bind(n).first<{ v: number }>();
  return row?.v ?? n;
}

export async function handleSync(db: D1Database, body: { since?: number; changes?: Change[] }) {
  const since = Number(body.since) || 0;
  const changes = (body.changes ?? []).filter((ch) => ch && COLLECTIONS.has(ch.c) && typeof ch.id === 'string' && ch.id.length < 200 && Number.isFinite(ch.u));
  if (changes.length) {
    const top = await nextClock(db, changes.length);
    let ts = top - changes.length;
    const stmts = changes.map((ch) =>
      db
        .prepare(
          `INSERT INTO records (c, id, u, d, data, ts) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
           ON CONFLICT (c, id) DO UPDATE SET u = excluded.u, d = excluded.d, data = excluded.data, ts = excluded.ts
           WHERE excluded.u > records.u`,
        )
        .bind(ch.c, ch.id, ch.u, ch.d ? 1 : 0, JSON.stringify(ch.data ?? {}), ++ts),
    );
    await db.batch(stmts);
  }
  const rows = await db
    .prepare('SELECT c, id, u, d, data, ts FROM records WHERE ts > ?1 ORDER BY ts ASC LIMIT ?2')
    .bind(since, PAGE + 1)
    .all<{ c: string; id: string; u: number; d: number; data: string; ts: number }>();
  const list = rows.results ?? [];
  const more = list.length > PAGE;
  const page = more ? list.slice(0, PAGE) : list;
  const clock = await db.prepare("SELECT v FROM meta WHERE k = 'clock'").first<{ v: number }>();
  return {
    cursor: page.length ? page[page.length - 1].ts : Math.max(since, more ? since : clock?.v ?? since),
    more,
    changes: page.map((r) => ({ c: r.c, id: r.id, u: r.u, d: !!r.d, data: JSON.parse(r.data) })),
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(req.url);

    // Link de atualização (público): repassa a última release do GitHub no mesmo formato.
    if (url.pathname === '/update') {
      const repo = env.REPO || 'limuddvarim-byte/Ingles-2027';
      const r = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { 'User-Agent': 'ingles-sync', Accept: 'application/vnd.github+json' }, cf: { cacheTtl: 300 } } as RequestInit);
      return new Response(r.body, { status: r.status, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    const auth = req.headers.get('Authorization') ?? '';
    if (!env.SYNC_TOKEN || !safeEqual(auth.replace(/^Bearer\s+/i, ''), env.SYNC_TOKEN)) return json({ error: 'unauthorized' }, 401);

    try {
      if (url.pathname === '/health') {
        const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM records').first<{ n: number }>();
        return json({ ok: true, records: n?.n ?? 0 });
      }
      if (url.pathname === '/sync' && req.method === 'POST') {
        const body = (await req.json()) as { since?: number; changes?: Change[] };
        return json(await handleSync(env.DB, body));
      }
      const m = url.pathname.match(/^\/audio\/([\w.-]{1,120})$/);
      if (m) {
        const id = m[1];
        if (req.method === 'PUT') {
          const buf = await req.arrayBuffer();
          if (buf.byteLength > 1_900_000) return json({ error: 'áudio grande demais' }, 413);
          await env.DB.prepare('INSERT OR REPLACE INTO audio (id, mime, data, created) VALUES (?1, ?2, ?3, ?4)')
            .bind(id, req.headers.get('Content-Type') || 'audio/mpeg', buf, Date.now())
            .run();
          return json({ ok: true });
        }
        const row = await env.DB.prepare('SELECT mime, data FROM audio WHERE id = ?1').bind(id).first<{ mime: string; data: ArrayBuffer }>();
        if (!row) return json({ error: 'not found' }, 404);
        return new Response(new Uint8Array(row.data as ArrayBuffer), { headers: { 'Content-Type': row.mime, 'Cache-Control': 'private, max-age=31536000', ...cors } });
      }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: String((e as Error).message ?? e) }, 500);
    }
  },
};
