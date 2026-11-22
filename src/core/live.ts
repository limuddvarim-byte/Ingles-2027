// "Assistindo agora": sinais ao vivo de reprodução (extensão / app Android).
import type { StreamingService } from './types';

type LiveMap = Partial<Record<StreamingService, number>>;
let live: LiveMap = {};
const subs = new Set<(m: LiveMap) => void>();
let ch: BroadcastChannel | null = null;
try {
  ch = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ingles-live') : null;
  ch?.addEventListener('message', (e) => {
    const d = e.data as { service: StreamingService; at: number };
    if (d?.service) setLocal(d.service, d.at);
  });
} catch {
  ch = null;
}

function setLocal(service: StreamingService, at: number) {
  live = { ...live, [service]: at };
  subs.forEach((s) => s(live));
}

export function markLive(service: StreamingService, at = Date.now()) {
  setLocal(service, at);
  try {
    ch?.postMessage({ service, at });
  } catch {
    /* ignora */
  }
}

export function subscribeLive(fn: (m: LiveMap) => void) {
  subs.add(fn);
  fn(live);
  return () => {
    subs.delete(fn);
  };
}

export const isLive = (m: LiveMap, s: StreamingService, now = Date.now()) => !!m[s] && now - (m[s] ?? 0) < 20_000;
