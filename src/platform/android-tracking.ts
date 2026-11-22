// Ponte entre a contagem nativa (notificações de mídia + acessibilidade) e o banco da tríade.
import { registerPlugin } from '@capacitor/core';
import { markLive } from '../core/live';
import type { SharedSettings, StreamingService } from '../core/types';
import { setWatchTotal } from '../core/watch';
import { useStore } from '../state/store';

interface TrackingNative {
  trackingTotals(): Promise<{ totals: { day: string; service: StreamingService; seconds: number }[]; live: { service: StreamingService; at: number }[] }>;
  trackingConfig(o: { paused: string[]; allPaused: boolean }): Promise<void>;
  trackingStatus(): Promise<{ notification: boolean; accessibility: boolean }>;
  openNotificationAccess(): Promise<void>;
  openAccessibility(): Promise<void>;
}

export const Tracking = registerPlugin<TrackingNative>('Ingles');

async function pull() {
  try {
    const r = await Tracking.trackingTotals();
    for (const t of r.totals) await setWatchTotal(t.service, t.day, t.seconds);
    for (const l of r.live) markLive(l.service, l.at);
  } catch {
    /* plugin indisponível (navegador) */
  }
}

function pushConfig(s: SharedSettings) {
  const paused = Object.entries(s.trackingPaused)
    .filter(([, v]) => v)
    .map(([k]) => k);
  void Tracking.trackingConfig({ paused, allPaused: s.trackingAllPaused }).catch(() => undefined);
}

export function startAndroidTracking() {
  void pull();
  setInterval(pull, 15_000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && pull());
  pushConfig(useStore.getState().shared);
  useStore.subscribe((st, prev) => {
    if (st.shared.trackingPaused !== prev.shared.trackingPaused || st.shared.trackingAllPaused !== prev.shared.trackingAllPaused) pushConfig(st.shared);
  });
}
