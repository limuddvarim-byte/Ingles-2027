// Content script dos serviços de streaming:
// 1) conta o tempo enquanto um vídeo está tocando (play/pause) e envia para o background;
// 2) botão "+ Legenda" (e atalho Alt+Shift+S) que copia a legenda inteira da tela para as Frases.
import { serviceFromHost } from '../../src/core/defaults';
import { readSubtitle } from './subtitles';

const service = serviceFromHost(location.hostname, location.pathname);
const TICK = 5000;
let last = Date.now();

function playingVideo(): HTMLVideoElement | null {
  const vids = Array.from(document.querySelectorAll('video'));
  return vids.find((v) => !v.paused && !v.ended && v.readyState > 2 && v.currentTime > 0) ?? null;
}

function tick() {
  const now = Date.now();
  const elapsed = Math.min(now - last, TICK * 2) / 1000;
  last = now;
  const svc = serviceFromHost(location.hostname, location.pathname);
  if (!svc) return;
  if (playingVideo()) {
    chrome.runtime.sendMessage({ type: 'watch:tick', service: svc, seconds: elapsed }).catch(() => undefined);
  }
}
setInterval(tick, TICK);
// play/pause reagem na hora (evita perder o trecho entre ticks)
document.addEventListener('play', () => (last = Date.now()), true);
document.addEventListener('pause', tick, true);

// ---------------------------------------------------------------- legenda

let host: HTMLDivElement | null = null;
let shadow: ShadowRoot | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function ui() {
  if (host) return shadow!;
  host = document.createElement('div');
  host.id = 'ingles-legenda';
  host.style.cssText = 'position:fixed;top:18px;right:18px;z-index:2147483647;pointer-events:none;';
  shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
  <style>
    :host{all:initial}
    .wrap{display:flex;flex-direction:column;align-items:flex-end;gap:8px;font-family:system-ui,'Segoe UI',sans-serif}
    button{pointer-events:auto;display:flex;align-items:center;gap:8px;border:0;cursor:pointer;color:#fff;font-weight:800;font-size:14px;
      padding:10px 14px;border-radius:14px;background:linear-gradient(135deg,#c2389b,#7b3fd0 55%,#2e44b8);
      box-shadow:0 10px 30px rgba(0,0,0,.45);transition:opacity .3s,transform .2s;opacity:0}
    button.show{opacity:.96}
    button:hover{transform:translateY(-2px);opacity:1}
    button kbd{font:600 11px system-ui;background:rgba(255,255,255,.2);padding:2px 6px;border-radius:6px}
    .toast{pointer-events:none;max-width:420px;padding:12px 14px;border-radius:14px;background:rgba(10,10,15,.92);color:#fff;font-size:14px;
      border:1px solid rgba(20,210,200,.5);box-shadow:0 10px 30px rgba(0,0,0,.5);opacity:0;transform:translateY(-6px);transition:all .3s}
    .toast.on{opacity:1;transform:none}
    .toast b{color:#14d2c8}
  </style>
  <div class="wrap">
    <button title="Adicionar a legenda da tela às Frases (Alt+Shift+S)"><span>＋ Legenda</span><kbd>Alt+Shift+S</kbd></button>
    <div class="toast"></div>
  </div>`;
  shadow.querySelector('button')!.addEventListener('click', (e) => {
    e.stopPropagation();
    void capture();
  });
  (document.fullscreenElement ?? document.body).appendChild(host);
  return shadow;
}

function showButton() {
  if (!document.querySelector('video')) return;
  const s = ui();
  const b = s.querySelector('button')!;
  b.classList.add('show');
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => b.classList.remove('show'), 2500);
}

function toast(html: string) {
  const s = ui();
  const t = s.querySelector('.toast') as HTMLDivElement;
  t.innerHTML = html;
  t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 3200);
}

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

async function capture() {
  const text = readSubtitle(serviceFromHost(location.hostname, location.pathname));
  if (!text) {
    toast('Nenhuma legenda visível agora. Ative as legendas em inglês e tente quando ela aparecer.');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* sem foco — segue */
  }
  const r = await chrome.runtime.sendMessage({ type: 'subtitle:add', text, service, url: location.href }).catch(() => null);
  toast(r?.ok ? `<b>Adicionada às Frases:</b><br>${esc(text)}` : 'Não foi possível salvar. Recarregue a página.');
}

document.addEventListener('mousemove', showButton, { passive: true });
document.addEventListener('fullscreenchange', () => {
  if (host) (document.fullscreenElement && document.fullscreenElement.tagName !== 'VIDEO' ? document.fullscreenElement : document.body).appendChild(host);
});
document.addEventListener(
  'keydown',
  (e) => {
    if (e.altKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
      e.preventDefault();
      e.stopPropagation();
      void capture();
    }
  },
  true,
);
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'subtitle:capture') void capture();
});
