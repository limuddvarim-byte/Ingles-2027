import { describe, expect, it } from 'vitest';
import { backlogAt, learningRate, learningStreak, learnTimeStats, monthPhraseStats, pendingPhrases, todayStats, watchStreak, watchTotals } from '../src/core/stats';
import { addDays, dayKey, daysInMonth, formatDuration, monthKey, parseDay } from '../src/core/time';
import type { Phrase, WatchRecord } from '../src/core/types';

const at = (day: string, h = 12) => { const d = parseDay(day); d.setHours(h); return d.getTime(); };
const ph = (id: string, created: string, learned?: string, extra: Partial<Phrase> = {}): Phrase => ({
  id, html: '', text: id, back: '', audio: null, anki: null, createdAt: at(created), updatedAt: 1, learnedAt: learned ? at(learned, 15) : null, ...extra,
});

describe('learningRate', () => {
  it('sem dados', () => expect(learningRate(0, 0).pct).toBeNull());
  it('faixas de cor', () => {
    expect(learningRate(10, 2).tone).toBe('low');
    expect(learningRate(10, 5).tone).toBe('mid');
    expect(learningRate(10, 8).tone).toBe('good');
    expect(learningRate(10, 10).tone).toBe('great');
    expect(learningRate(4, 6).label).toBe('150%');
  });
  it('aprendeu sem adicionar', () => {
    const r = learningRate(0, 3);
    expect(r.tone).toBe('great');
    expect(r.label).toBe('+3');
  });
});

describe('estatísticas de frases', () => {
  const today = '2026-11-20';
  const phrases = [
    ph('a', '2026-11-20'),
    ph('b', '2026-11-20', '2026-11-20'),
    ph('c', '2026-11-18', '2026-11-20'),
    ph('d', '2026-11-19', '2026-11-19'),
    ph('e', '2026-11-18', '2026-11-18'),
    ph('f', '2026-11-10', undefined, { removed: true, learnedAt: at('2026-11-12') }),
    ph('g', '2026-11-10', undefined, { deleted: true }),
    ph('h', '2026-10-30', '2026-11-02'),
  ];
  it('hoje', () => {
    const t = todayStats(phrases, today);
    expect(t.added).toBe(2);
    expect(t.learned).toBe(2);
    expect(t.rate.pct).toBe(100);
  });
  it('removidas não contam como aprendidas; excluídas não contam', () => {
    const m = monthPhraseStats(phrases, '2026-11', today);
    expect(m.added).toBe(6); // a b c d e f (g excluída, h é de outubro)
    expect(m.learned).toBe(5); // b c d e h
    expect(m.days).toHaveLength(30);
    expect(m.bestDay?.day).toBe('2026-11-20');
  });
  it('pendentes', () => {
    expect(pendingPhrases(phrases).map((p) => p.id)).toEqual(['a']);
  });
  it('fila acumulada', () => {
    expect(backlogAt(phrases, at('2026-11-18', 23))).toBe(1); // só c
    expect(backlogAt(phrases, at('2026-11-20', 23))).toBe(1); // só a
  });
  it('sequência de dias aprendendo', () => {
    const s = learningStreak(phrases, today);
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
  });
  it('tempo médio para aprender', () => {
    const t = learnTimeStats([ph('x', '2026-11-01', '2026-11-03'), ph('y', '2026-11-01', '2026-11-01')]);
    expect(t.fastestHours).toBe(3);
    expect(t.avgDays).toBeCloseTo((51 + 3) / 2 / 24, 5);
  });
});

describe('tempo de streaming', () => {
  const w = (day: string, service: WatchRecord['service'], seconds: number, extra: Partial<WatchRecord> = {}): WatchRecord => ({ id: `${day}${service}${seconds}`, day, service, seconds, source: 'auto', updatedAt: 1, ...extra });
  const recs = [w('2026-11-20', 'netflix', 600), w('2026-11-20', 'youtube', 300), w('2026-11-19', 'netflix', 60), w('2026-11-17', 'disney', 100), w('2026-11-20', 'prime', 999, { deleted: true })];
  it('totais por serviço', () => {
    const t = watchTotals(recs, (d) => d === '2026-11-20');
    expect(t.total).toBe(900);
    expect(t.per.netflix).toBe(600);
    expect(t.per.prime).toBeUndefined();
  });
  it('sequência', () => expect(watchStreak(recs, '2026-11-20')).toBe(2));
});

describe('time', () => {
  it('helpers', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysInMonth('2024-02')).toHaveLength(29);
    expect(monthKey(parseDay('2026-03-05'))).toBe('2026-03');
    expect(dayKey(parseDay('2026-03-05'))).toBe('2026-03-05');
    expect(formatDuration(3725)).toBe('1h 02min');
    expect(formatDuration(600)).toBe('10min');
    expect(formatDuration(42)).toBe('42s');
  });
});
