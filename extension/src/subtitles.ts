// Leitura da legenda que está na tela em cada serviço de streaming.

/** querySelectorAll que também entra em shadow DOM (Apple TV, etc.). */
export function deepQueryAll(selector: string, root: Document | ShadowRoot | Element = document): Element[] {
  const out: Element[] = [];
  const visit = (node: Document | ShadowRoot | Element) => {
    out.push(...Array.from(node.querySelectorAll(selector)));
    node.querySelectorAll('*').forEach((el) => {
      if ((el as HTMLElement).shadowRoot) visit((el as HTMLElement).shadowRoot!);
    });
  };
  visit(root);
  return out;
}

const SELECTORS: Record<string, string[]> = {
  netflix: ['.player-timedtext-text-container', '.player-timedtext'],
  disney: ['.dss-subtitle-renderer-cue-window', '.hive-subtitle-renderer-line', '[class*="subtitle-renderer-cue"]'],
  hbomax: ['[data-testid="CueBoxRowTextCue"]', '[class*="CaptionWindow"]', '[class*="TextCue"]'],
  prime: ['.atvwebplayersdk-captions-text'],
  youtube: ['.ytp-caption-segment'],
  crunchyroll: ['.vjs-text-track-cue', '[data-testid="vilos-subtitles"]', '#velocity-subtitles'],
  appletv: ['.subtitles', '[class*="subtitle"]', '[class*="caption"]'],
  realworld: ['[class*="caption"]'],
};

const GENERIC = ['[class*="subtitle" i]', '[class*="caption" i]', '[class*="timedtext" i]', '[class*="cue" i]'];

function visible(el: Element): boolean {
  const r = (el as HTMLElement).getBoundingClientRect?.();
  if (!r || r.width === 0 || r.height === 0) return false;
  const st = getComputedStyle(el as HTMLElement);
  return st.visibility !== 'hidden' && st.display !== 'none' && Number(st.opacity) > 0.05;
}

function clean(t: string): string {
  return t
    .replace(/\[[^\]]*\]|\([^)]*\)|♪/g, ' ')
    .split('\n')
    .map((l) => l.replace(/^[-–—]\s*/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

function fromTextTracks(): string {
  const parts: string[] = [];
  document.querySelectorAll('video').forEach((v) => {
    for (const track of Array.from(v.textTracks ?? [])) {
      if (track.mode === 'disabled' || !track.activeCues) continue;
      for (const cue of Array.from(track.activeCues)) {
        const t = (cue as VTTCue).text ?? '';
        if (t) parts.push(t.replace(/<[^>]+>/g, ''));
      }
    }
  });
  return parts.join('\n');
}

/** Retorna a legenda inteira visível agora (ou '' se não encontrar). */
export function readSubtitle(service: string | null): string {
  const sels = [...(service ? SELECTORS[service] ?? [] : []), ...GENERIC];
  for (const sel of sels) {
    const els = deepQueryAll(sel).filter(visible);
    // ignora contêineres enormes (menus, descrições)
    const texts = els.map((e) => (e as HTMLElement).innerText ?? e.textContent ?? '').filter((t) => t.trim() && t.length < 400);
    if (texts.length) {
      // remove trechos repetidos (contêiner + filhos)
      const uniq = texts.filter((t, i) => !texts.some((o, j) => j !== i && o.length > t.length && o.includes(t)));
      const out = clean([...new Set(uniq)].join('\n'));
      if (out) return out;
    }
  }
  return clean(fromTextTracks());
}
