// Dados de demonstração (apenas na versão web com ?demo=1) — usados para conferir a interface.
import { all, putMany } from '../core/db';
import { SERVICES } from '../core/defaults';
import { addDays, dayKey, parseDay } from '../core/time';
import type { Phrase, WatchRecord } from '../core/types';

export async function seedDemo() {
  if ((await all('phrases')).length) return;
  const samples = [
    '<p>I <strong>could use</strong> a cup of <span data-note="Expressão comum: “eu bem que queria / cairia bem”." class="term">coffee</span> right now.</p>',
    '<p>She is <span style="color: #F43F5E">on the fence</span> about moving to Canada.</p>',
    '<p>Don\'t <u style="text-decoration-color: #14D2C8" data-underline-color="#14D2C8">beat around the bush</u>, just tell me.</p>',
    '<p>We\'re running out of time.</p>',
    '<p>He <em>bailed on</em> us at the last minute.</p>',
    '<p>That movie was <strong><span style="color: #F5A524">a total letdown</span></strong>.</p>',
    '<p>I\'ll <span data-note="Phrasal verb: “dar uma passada”." class="term">swing by</span> your place later.</p>',
  ];
  const now = Date.now();
  const phrases: Phrase[] = [];
  let k = 0;
  for (let d = 60; d >= 0; d--) {
    const n = (d * 7) % 4;
    for (let i = 0; i < n; i++) {
      const created = parseDay(addDays(dayKey(), -d)).getTime() + 9 * 3600e3 + i * 600e3;
      const learned = d > 2 && (k % 3 !== 0) ? created + ((k % 5) + 1) * 86400e3 : null;
      phrases.push({ id: `demo-${k}`, html: samples[k % samples.length], text: '', back: k % 2 ? '<p>Tradução de exemplo</p>' : '', audio: null, anki: null, createdAt: created, updatedAt: now, learnedAt: learned && learned < now ? learned : null, removed: k % 11 === 0 });
      k++;
    }
  }
  phrases.slice(-6).forEach((p, i) => {
    p.learnedAt = null;
    p.removed = false;
    p.html = samples[i];
    p.createdAt = now - i * 3600e3;
  });
  const { htmlToText } = await import('../core/richtext');
  phrases.forEach((p) => (p.text = htmlToText(p.html)));
  await putMany('phrases', phrases);
  const watch: WatchRecord[] = [];
  for (let d = 90; d >= 0; d--) {
    SERVICES.forEach((s, i) => {
      if ((d + i) % 3 === 0 || (d % 5 === i % 5)) watch.push({ id: `w-${d}-${s.id}`, service: s.id, day: addDays(dayKey(), -d), seconds: (((d * 13 + i * 29) % 50) + 8) * 60, source: 'auto', updatedAt: now });
    });
  }
  await putMany('watch', watch);
}
