// Matemática das estatísticas de frases e de tempo de streaming.
import type { Phrase, StreamingService, WatchRecord } from './types';
import { addDays, dayKey, daysInMonth, monthKey, parseDay } from './time';

export interface RateInfo {
  /** Porcentagem aprendidas/adicionadas (pode passar de 100). null = sem dados. */
  pct: number | null;
  label: string;
  tone: 'none' | 'low' | 'mid' | 'good' | 'great';
  color: string;
  description: string;
}

/**
 * Média de aprendizado = frases aprendidas ÷ frases adicionadas × 100.
 * Acima de 100% significa que você aprendeu mais do que adicionou (limpando a fila).
 */
export function learningRate(added: number, learned: number): RateInfo {
  if (added <= 0 && learned <= 0) {
    return { pct: null, label: '—', tone: 'none', color: '#8B8FA8', description: 'Sem movimento ainda' };
  }
  const pct = added <= 0 ? 100 + learned * 10 : Math.round((learned / added) * 100);
  const label = added <= 0 ? `+${learned}` : `${pct}%`;
  if (pct >= 100)
    return { pct, label, tone: 'great', color: '#14D2C8', description: 'Excelente! Fila diminuindo' };
  if (pct >= 67) return { pct, label, tone: 'good', color: '#22C55E', description: 'Ótimo ritmo' };
  if (pct >= 34) return { pct, label, tone: 'mid', color: '#F5A524', description: 'No caminho' };
  return { pct, label, tone: 'low', color: '#F43F5E', description: 'Acumulando frases' };
}

/** Frases descartadas por digitação incorreta somem de TODAS as contagens (nem adicionadas, nem aprendidas). */
const isCountable = (p: Phrase) => !p.deleted && !p.removed;

export interface DayCount {
  day: string;
  added: number;
  learned: number;
}

export function countsByDay(phrases: Phrase[]): Map<string, DayCount> {
  const map = new Map<string, DayCount>();
  const get = (day: string) => {
    let v = map.get(day);
    if (!v) map.set(day, (v = { day, added: 0, learned: 0 }));
    return v;
  };
  for (const p of phrases) {
    if (!isCountable(p)) continue;
    get(dayKey(p.createdAt)).added++;
    if (p.learnedAt) get(dayKey(p.learnedAt)).learned++;
  }
  return map;
}

export function todayStats(phrases: Phrase[], today = dayKey()) {
  const c = countsByDay(phrases).get(today) ?? { day: today, added: 0, learned: 0 };
  return { ...c, rate: learningRate(c.added, c.learned) };
}

export function pendingPhrases(phrases: Phrase[]): Phrase[] {
  return phrases
    .filter((p) => !p.deleted && !p.learnedAt && !p.removed)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export interface MonthPhraseStats {
  month: string;
  days: DayCount[];
  added: number;
  learned: number;
  rate: RateInfo;
  bestDay: DayCount | null;
  activeDays: number;
  avgAddedPerDay: number;
  avgLearnedPerDay: number;
  /** Fila pendente acumulada ao fim de cada dia do mês. */
  backlog: { day: string; value: number }[];
}

export function monthPhraseStats(phrases: Phrase[], month = monthKey(), today = dayKey()): MonthPhraseStats {
  const byDay = countsByDay(phrases);
  const days = daysInMonth(month).map((d) => byDay.get(d) ?? { day: d, added: 0, learned: 0 });
  const added = days.reduce((s, d) => s + d.added, 0);
  const learned = days.reduce((s, d) => s + d.learned, 0);
  const elapsed = days.filter((d) => d.day <= today).length || days.length;
  let bestDay: DayCount | null = null;
  for (const d of days) if (d.learned > 0 && (!bestDay || d.learned > bestDay.learned)) bestDay = d;

  const backlog = days
    .filter((d) => d.day <= today)
    .map((d) => ({ day: d.day, value: backlogAt(phrases, endOfDay(d.day)) }));

  return {
    month,
    days,
    added,
    learned,
    rate: learningRate(added, learned),
    bestDay,
    activeDays: days.filter((d) => d.added + d.learned > 0).length,
    avgAddedPerDay: added / elapsed,
    avgLearnedPerDay: learned / elapsed,
    backlog,
  };
}

function endOfDay(day: string): number {
  const d = parseDay(day);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Quantas frases estavam na fila (para aprender) em um instante. */
export function backlogAt(phrases: Phrase[], ts: number): number {
  let n = 0;
  for (const p of phrases) {
    if (!isCountable(p) || p.createdAt > ts) continue;
    if (p.learnedAt === null || p.learnedAt > ts) n++;
  }
  return n;
}

/** Dias seguidos (até hoje) em que pelo menos uma frase foi aprendida. */
export function learningStreak(phrases: Phrase[], today = dayKey()): { current: number; best: number } {
  const days = new Set<string>();
  for (const p of phrases) if (!p.deleted && p.learnedAt && !p.removed) days.add(dayKey(p.learnedAt));
  let current = 0;
  let cursor = today;
  if (!days.has(cursor)) cursor = addDays(cursor, -1); // hoje ainda não conta como quebra
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev = '';
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current) };
}

export interface LearnTimeStats {
  avgDays: number | null;
  fastestHours: number | null;
  medianDays: number | null;
}

export function learnTimeStats(phrases: Phrase[]): LearnTimeStats {
  const spans = phrases
    .filter((p) => !p.deleted && p.learnedAt && !p.removed)
    .map((p) => (p.learnedAt! - p.createdAt) / 3_600_000)
    .filter((h) => h >= 0)
    .sort((a, b) => a - b);
  if (!spans.length) return { avgDays: null, fastestHours: null, medianDays: null };
  const avg = spans.reduce((s, v) => s + v, 0) / spans.length;
  const mid = spans.length % 2 ? spans[(spans.length - 1) / 2] : (spans[spans.length / 2 - 1] + spans[spans.length / 2]) / 2;
  return { avgDays: avg / 24, fastestHours: spans[0], medianDays: mid / 24 };
}

/** Distribuição por dia da semana (0 = domingo). */
export function weekdayDistribution(phrases: Phrase[]): { added: number[]; learned: number[] } {
  const added = Array(7).fill(0);
  const learned = Array(7).fill(0);
  for (const p of phrases) {
    if (!isCountable(p)) continue;
    added[new Date(p.createdAt).getDay()]++;
    if (p.learnedAt) learned[new Date(p.learnedAt).getDay()]++;
  }
  return { added, learned };
}

export function monthlyHistory(phrases: Phrase[], months: string[]) {
  return months.map((m) => {
    const s = monthPhraseStats(phrases, m);
    return { month: m, added: s.added, learned: s.learned, rate: s.rate };
  });
}

// ---------------------------------------------------------------- streaming

export function watchByDay(records: WatchRecord[]): Map<string, Partial<Record<StreamingService, number>>> {
  const map = new Map<string, Partial<Record<StreamingService, number>>>();
  for (const r of records) {
    if (r.deleted || r.seconds <= 0) continue;
    let v = map.get(r.day);
    if (!v) map.set(r.day, (v = {}));
    v[r.service] = (v[r.service] ?? 0) + r.seconds;
  }
  return map;
}

export function sumServices(v: Partial<Record<StreamingService, number>> | undefined): number {
  if (!v) return 0;
  return Object.values(v).reduce((s, n) => s + (n ?? 0), 0);
}

export function watchTotals(records: WatchRecord[], filter: (day: string) => boolean) {
  const per: Partial<Record<StreamingService, number>> = {};
  let total = 0;
  for (const r of records) {
    if (r.deleted || r.seconds <= 0 || !filter(r.day)) continue;
    per[r.service] = (per[r.service] ?? 0) + r.seconds;
    total += r.seconds;
  }
  return { total, per };
}

export function watchStreak(records: WatchRecord[], today = dayKey()): number {
  const map = watchByDay(records);
  let n = 0;
  let cursor = today;
  if (!sumServices(map.get(cursor))) cursor = addDays(cursor, -1);
  while (sumServices(map.get(cursor)) > 0) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}
