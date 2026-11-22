import { get, put, uid } from '../core/db';
import { extractHighlights, htmlToText, sanitizeHtml, textToHtml } from '../core/richtext';
import type { Phrase } from '../core/types';

export function newPhrase(html: string, back = ''): Phrase {
  const clean = sanitizeHtml(html);
  const now = Date.now();
  return { id: uid(), html: clean, text: htmlToText(clean), back: sanitizeHtml(back), audio: null, anki: null, createdAt: now, updatedAt: now, learnedAt: null };
}

export async function addPhrase(html: string, back = ''): Promise<Phrase | null> {
  const p = newPhrase(html, back);
  if (!p.text.trim()) return null;
  return put('phrases', p);
}

export async function addPlainPhrases(texts: string[]): Promise<number> {
  let n = 0;
  for (const t of texts) if (await addPhrase(textToHtml(t))) n++;
  return n;
}

export async function updatePhrase(p: Phrase, patch: Partial<Phrase>): Promise<Phrase> {
  const next = { ...p, ...patch };
  if (patch.html !== undefined) {
    next.html = sanitizeHtml(patch.html);
    next.text = htmlToText(next.html);
  }
  if (patch.back !== undefined) next.back = sanitizeHtml(patch.back);
  return put('phrases', next);
}

/** Apagar da lista = aprendida (conta nas estatísticas). */
export async function learnPhrase(p: Phrase) {
  return put('phrases', { ...p, learnedAt: Date.now(), removed: false });
}

/** Apagar sem contar como aprendida. */
export async function discardPhrase(p: Phrase) {
  return put('phrases', { ...p, learnedAt: Date.now(), removed: true });
}

export async function restorePhrase(id: string) {
  const p = await get('phrases', id);
  if (p) await put('phrases', { ...p, learnedAt: null, removed: false });
}

export const highlightsOf = (p: Pick<Phrase, 'html'>) => extractHighlights(p.html);
