import { useEffect, useState } from 'react';
import { SERVICE_MAP } from '../core/defaults';
import type { StreamingService } from '../core/types';
import { useStore } from '../state/store';

export function useResolvedTheme(): 'light' | 'amoled' {
  const theme = useStore((s) => s.shared.theme);
  const [sys, setSys] = useState(() => (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'amoled' : 'light'));
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const h = () => setSys(mq.matches ? 'amoled' : 'light');
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return theme === 'auto' ? (sys as 'light' | 'amoled') : theme;
}

/** Aplica tema, cor das frases e fontes no <html>. */
export function useApplyTheme() {
  const shared = useStore((s) => s.shared);
  const resolved = useResolvedTheme();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.dataset.phrase = shared.phraseColor;
    root.style.setProperty('--ui-font', `'${shared.uiFont}', system-ui, sans-serif`);
    root.style.setProperty('--phrase-font', `'${shared.phraseFont}', system-ui, sans-serif`);
    root.style.setProperty('--phrase-size', `${shared.phraseSize}px`);
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', resolved === 'amoled' ? '#000000' : '#f4f3fa');
    if (__PLATFORM__ === 'android') {
      import('@capacitor/status-bar')
        .then(({ StatusBar, Style }) => {
          void StatusBar.setBackgroundColor({ color: resolved === 'amoled' ? '#000000' : '#f4f3fa' });
          void StatusBar.setStyle({ style: resolved === 'amoled' ? Style.Dark : Style.Light });
        })
        .catch(() => undefined);
    }
  }, [resolved, shared.phraseColor, shared.uiFont, shared.phraseFont, shared.phraseSize]);
}

export function useChartColors() {
  const t = useResolvedTheme();
  const dark = t === 'amoled';
  return {
    // direção Terminal: neutro + turquesa (cor só onde é categoria, ex.: serviços)
    added: dark ? '#6b6b75' : '#a1a1aa',
    learned: dark ? '#14d2c8' : '#0d9488',
    accent: dark ? '#14d2c8' : '#0d9488',
    service: (s: StreamingService) => (dark ? SERVICE_MAP[s].chartDark : SERVICE_MAP[s].chart),
    seq: dark ? '#14d2c8' : '#0d9488',
  };
}
