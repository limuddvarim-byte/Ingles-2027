// Integração com o Anki no computador via AnkiConnect (add-on 2055492159).
// Depois de adicionar, o Anki sincroniza com o AnkiWeb automaticamente.
import type { AnkiDeck, AnkiNote, HttpRequest, HttpResponse, Platform } from './types';

export const MODEL_NAME = 'Inglês (Tríade)';
export const MODEL_FIELDS = ['Frente', 'Verso', 'Audio', 'Notas'];
export const MODEL_CSS = `.card{font-family:"Outfit","Segoe UI",sans-serif;font-size:26px;text-align:center;color:#111;background:#fff;line-height:1.5}
.nightMode .card,.night_mode .card{color:#fff;background:#000}
.term{border-bottom:2px dashed #14D2C8}
.notes{margin-top:18px;font-size:16px;text-align:left;opacity:.85}
.notes b{color:#14D2C8}
hr#answer{border:0;height:2px;background:linear-gradient(90deg,#B23A9B,#2B3FA0);margin:18px 0}`;
export const FRONT_TMPL = '{{Frente}}<div>{{Audio}}</div>';
export const BACK_TMPL = '{{FrontSide}}<hr id=answer>{{Verso}}{{#Notas}}<div class="notes">{{Notas}}</div>{{/Notas}}';

type Http = (r: HttpRequest) => Promise<HttpResponse>;

export function ankiConnect(http: Http, getUrl: () => Promise<string>): Platform['anki'] {
  async function invoke<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    const url = await getUrl();
    let res: HttpResponse;
    try {
      res = await http({ url, method: 'POST', body: { action, version: 6, params }, responseType: 'json' });
    } catch {
      throw new Error('Anki fechado ou sem o AnkiConnect.');
    }
    const data = res.data as { result: T; error: string | null };
    if (!res.ok || !data) throw new Error('Anki não respondeu. Abra o Anki com o AnkiConnect instalado.');
    if (data.error) throw new Error(`Anki: ${data.error}`);
    return data.result;
  }

  async function ensureModel() {
    const models = await invoke<string[]>('modelNames');
    if (models.includes(MODEL_NAME)) return;
    await invoke('createModel', {
      modelName: MODEL_NAME,
      inOrderFields: MODEL_FIELDS,
      css: MODEL_CSS,
      isCloze: false,
      cardTemplates: [{ Name: 'Inglês', Front: FRONT_TMPL, Back: BACK_TMPL }],
    });
  }

  return {
    describe: () => 'Anki no computador (AnkiConnect) → AnkiWeb',
    async available() {
      try {
        const v = await invoke<number>('version');
        return { ok: true, message: `AnkiConnect v${v} conectado` };
      } catch (e) {
        return { ok: false, message: (e as Error).message };
      }
    },
    async decks(): Promise<AnkiDeck[]> {
      const map = await invoke<Record<string, number>>('deckNamesAndIds');
      return Object.entries(map)
        .map(([name, id]) => ({ id: String(id), name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async createDeck(name: string) {
      await invoke('createDeck', { deck: name });
    },
    async addNote(note: AnkiNote) {
      await ensureModel();
      await invoke('createDeck', { deck: note.deck });
      const { front, notes } = splitNotes(note.front);
      await invoke('addNote', {
        note: {
          deckName: note.deck,
          modelName: MODEL_NAME,
          fields: { Frente: front, Verso: note.back || '', Audio: '', Notas: notes },
          options: { allowDuplicate: false, duplicateScope: 'deck' },
          tags: note.tags ?? ['ingles'],
          audio: note.audio ? [{ data: note.audio.base64, filename: note.audio.filename, fields: ['Audio'] }] : [],
        },
      });
      try {
        await invoke('sync');
      } catch {
        /* sem login no AnkiWeb — o card fica no Anki local */
      }
    },
  };
}

/** Separa as explicações das setas para o campo "Notas" do card. */
export function splitNotes(html: string): { front: string; notes: string } {
  if (typeof DOMParser === 'undefined') return { front: html, notes: '' };
  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html');
  const root = doc.getElementById('r')!;
  const items: string[] = [];
  root.querySelectorAll('span[data-note]').forEach((el) => {
    const note = el.getAttribute('data-note') ?? '';
    if (note.trim()) items.push(`<div><b>${el.textContent ?? ''}</b> — ${escape(note)}</div>`);
    el.removeAttribute('data-note');
  });
  return { front: root.innerHTML, notes: items.join('') };
}

const escape = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  return btoa(bin);
}

export function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
