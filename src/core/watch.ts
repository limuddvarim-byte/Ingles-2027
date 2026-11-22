// Registro de tempo assistido (automático pela extensão ou manual).
import { get, getDeviceId, put, uid } from './db';
import { dayKey } from './time';
import type { StreamingService, WatchRecord } from './types';

/** Soma segundos ao contador automático deste aparelho para o dia/serviço. */
export async function addWatchSeconds(service: StreamingService, seconds: number, at = Date.now()): Promise<WatchRecord | null> {
  if (!(seconds > 0) || seconds > 3600) return null;
  const device = await getDeviceId();
  const day = dayKey(at);
  const id = `auto:${device}:${day}:${service}`;
  const cur = await get('watch', id);
  const rec: WatchRecord = {
    id,
    service,
    day,
    seconds: Math.round(((cur && !cur.deleted ? cur.seconds : 0) + seconds) * 100) / 100,
    source: 'auto',
    device,
    updatedAt: Date.now(),
  };
  return put('watch', rec);
}

export async function addManualWatch(service: StreamingService, minutes: number, day = dayKey(), note = ''): Promise<WatchRecord> {
  return put('watch', {
    id: `manual:${uid()}`,
    service,
    day,
    seconds: Math.round(minutes * 60),
    source: 'manual',
    note,
    updatedAt: Date.now(),
  });
}

/** Define o total absoluto do contador deste aparelho (usado pelo app Android). */
export async function setWatchTotal(service: StreamingService, day: string, seconds: number): Promise<void> {
  const device = await getDeviceId();
  const id = `auto:${device}:${day}:${service}`;
  const cur = await get('watch', id);
  const rounded = Math.round(seconds);
  if (cur && !cur.deleted && Math.round(cur.seconds) >= rounded) return;
  await put('watch', { id, service, day, seconds: rounded, source: 'auto', device, updatedAt: Date.now() });
}
