// Utilidades de data — tudo em horário local do aparelho.

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(ts: number | Date = Date.now()): string {
  const d = ts instanceof Date ? ts : new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function monthKey(ts: number | Date = Date.now()): string {
  const d = ts instanceof Date ? ts : new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(key: string, n: number): string {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export function addMonths(mkey: string, n: number): string {
  const [y, m] = mkey.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthKey(d);
}

export function daysInMonth(mkey: string): string[] {
  const [y, m] = mkey.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const out: string[] = [];
  for (let i = 1; i <= last; i++) out.push(`${y}-${pad(m)}-${pad(i)}`);
  return out;
}

export function lastNDays(n: number, end: string = dayKey()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function monthLabel(mkey: string, short = false): string {
  const [y, m] = mkey.split('-').map(Number);
  const name = MONTHS[m - 1];
  return short ? `${MONTHS_SHORT[m - 1]}/${String(y).slice(2)}` : `${name[0].toUpperCase()}${name.slice(1)} de ${y}`;
}

export function dayLabel(key: string): string {
  const d = parseDay(key);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** 3725 -> "1h 02min"; 59 -> "59s"; 600 -> "10min" */
export function formatDuration(seconds: number, withSeconds = false): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${pad(m)}min`;
  if (m > 0) return withSeconds ? `${m}min ${pad(sec)}s` : `${m}min`;
  return `${sec}s`;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}
