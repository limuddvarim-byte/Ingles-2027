// Service worker da extensão: soma o tempo de streaming, salva legendas/seleções como frases,
// sincroniza com o Cloudflare e se recarrega quando o software atualiza a pasta da extensão.
import { getSharedSettings, put, uid } from '../../src/core/db';
import { markLive } from '../../src/core/live';
import { escapeHtml } from '../../src/core/richtext';
import { setLocalChangeHook } from '../../src/core/db';
import { syncNow } from '../../src/core/sync';
import type { Phrase, StreamingService } from '../../src/core/types';
import { addWatchSeconds } from '../../src/core/watch';

async function addTextPhrase(text: string): Promise<Phrase | null> {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!lines.length) return null;
  const now = Date.now();
  return put('phrases', {
    id: uid(),
    html: lines.map((l) => `<p>${escapeHtml(l)}</p>`).join(''),
    text: lines.join('\n'),
    back: '',
    audio: null,
    anki: null,
    createdAt: now,
    updatedAt: now,
    learnedAt: null,
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  (async () => {
    if (msg?.type === 'watch:tick') {
      const s = await getSharedSettings();
      const svc = msg.service as StreamingService;
      if (s.trackingAllPaused || s.trackingPaused[svc]) return reply({ ok: false, paused: true });
      await addWatchSeconds(svc, Number(msg.seconds) || 0);
      markLive(svc);
      await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      await chrome.action.setBadgeText({ text: '●' });
      setTimeout(() => void chrome.action.setBadgeText({ text: '' }), 12_000);
      return reply({ ok: true });
    }
    if (msg?.type === 'subtitle:add') {
      const p = await addTextPhrase(String(msg.text ?? ''));
      return reply({ ok: !!p });
    }
    reply({ ok: false });
  })().catch((e) => reply({ ok: false, error: String(e) }));
  return true; // resposta assíncrona
});

// Selecionou um texto em qualquer site → botão direito → "Adicionar às Frases"
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'ingles-add', title: 'Adicionar “%s” às Frases do Inglês', contexts: ['selection'] });
  chrome.alarms.create('sync', { periodInMinutes: 1 });
  chrome.alarms.create('self-update', { periodInMinutes: 15 });
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('sync', { periodInMinutes: 1 });
  chrome.alarms.create('self-update', { periodInMinutes: 15 });
  void selfUpdate();
});
chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'ingles-add' && info.selectionText) await addTextPhrase(info.selectionText);
});

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'capture-subtitle') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'subtitle:capture' }).catch(() => undefined);
});

// Sincronização (o service worker dorme — os alarms o acordam).
let t: ReturnType<typeof setTimeout> | null = null;
setLocalChangeHook(() => {
  if (t) clearTimeout(t);
  t = setTimeout(() => void syncNow(), 4000);
});
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'sync') void syncNow();
  if (a.name === 'self-update') void selfUpdate();
});

/** Instalada pela pasta mantida pelo software: se os arquivos no disco mudaram de versão, recarrega. */
async function selfUpdate() {
  try {
    const res = await fetch(chrome.runtime.getURL('manifest.json'), { cache: 'no-store' });
    const disk = (await res.json()).version as string;
    if (disk && disk !== chrome.runtime.getManifest().version) chrome.runtime.reload();
  } catch {
    /* ignora */
  }
}
