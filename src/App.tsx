import { useEffect, useState } from 'react';
import logo from './assets/logo.png';
import { platform } from './platform';
import type { UpdateInfo } from './platform/types';
import { useStore, type Page } from './state/store';
import { CommandPalette } from './ui/CommandPalette';
import { Icon, type IconName } from './ui/Icon';
import { Toasts } from './ui/kit';
import { useApplyTheme } from './ui/theme';
import { HomePage } from './pages/home';
import { EditorPage } from './pages/editor';
import { StatsPage } from './pages/stats';
import { StreamingPage } from './pages/streaming';
import { SettingsPage } from './pages/settings';
import { QuickAdd } from './pages/phrases';

interface NavItem {
  page: Page;
  key: string;
  rest: string;
  icon: IconName;
}

const NAV: NavItem[] = [
  { page: 'home', key: 'F', rest: 'rases', icon: 'quote' },
  { page: 'editor', key: 'E', rest: 'ditor', icon: 'pen' },
  { page: 'stats', key: 'S', rest: 'tats', icon: 'chart' },
  { page: 'streaming', key: 'T', rest: 'v', icon: 'tv' },
  { page: 'settings', key: 'A', rest: 'justes', icon: 'settings' },
];

const isPopup = typeof location !== 'undefined' && new URLSearchParams(location.search).has('popup');

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

function SyncStatus() {
  const sync = useStore((s) => s.sync);
  const go = useStore((s) => s.go);
  const cls = sync.state === 'ok' ? 'ok' : sync.state === 'error' ? 'err' : sync.state === 'syncing' ? 'ok' : 'off';
  const label = sync.state === 'ok' ? 'sync' : sync.state === 'error' ? 'erro sync' : sync.state === 'syncing' ? 'sync…' : 'offline';
  return (
    <button className={`status ${cls}`} onClick={() => go('settings')} title="Sincronização (Cloudflare)">
      <i />
      {label}
    </button>
  );
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  const d = now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '');
  return (
    <span className="status clock">
      {d} {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}

function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    platform.onUpdate?.((u) => setInfo(u));
    const t = setTimeout(() => {
      platform
        .checkUpdate()
        .then((u) => u.available && setInfo(u))
        .catch(() => undefined);
    }, 4000);
    return () => clearTimeout(t);
  }, []);
  if (!info?.available || hidden) return null;
  return (
    <div className="banner">
      <span className="acc">●</span>
      <div className="grow">
        nova versão <b>{info.version}</b> {info.ready ? '— baixada, reinicie para aplicar' : info.progress ? `— baixando ${Math.round(info.progress)}%` : 'disponível'}
      </div>
      <button className="btn sm primary" onClick={() => platform.installUpdate(info)}>
        {info.ready ? 'reiniciar' : 'atualizar'}
      </button>
      <button className="icon-btn sm" onClick={() => setHidden(true)}>
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}

export function App() {
  useApplyTheme();
  const page = useStore((s) => s.page);
  const go = useStore((s) => s.go);
  const toast = useStore((s) => s.toast);
  const quickAdd = useStore((s) => s.quickAdd);
  const setQuickAdd = useStore((s) => s.setQuickAdd);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('popup', isPopup);
    const h = (e: Event) => toast((e as CustomEvent).detail as string, 'info');
    window.addEventListener('ingles:toast', h);
    return () => window.removeEventListener('ingles:toast', h);
  }, [toast]);

  // Atalhos: Ctrl+K paleta · F/E/S/T/A abas · N nova frase · / paleta
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e) || document.querySelector('.overlay')) return;
      const k = e.key.toUpperCase();
      const item = NAV.find((n) => n.key === k);
      if (item) {
        e.preventDefault();
        go(item.page);
      } else if (k === 'N') {
        e.preventDefault();
        setQuickAdd(true);
      } else if (e.key === '/') {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, setQuickAdd]);

  useEffect(() => {
    document.querySelector('.main')?.scrollTo({ top: 0 });
  }, [page]);

  const content =
    page === 'home' ? <HomePage /> : page === 'editor' ? <EditorPage /> : page === 'stats' ? <StatsPage /> : page === 'streaming' ? <StreamingPage /> : <SettingsPage />;

  return (
    <>
      <div className="shell">
        <header className="topbar">
          <button className="wordmark" onClick={() => go('home')}>
            <img src={logo} alt="" />
            <span>
              INGLÊS<span className="sl">//</span>
            </span>
          </button>
          <button className="cmdk" onClick={() => setPalette(true)} title="Ctrl+K">
            <Icon name="search" size={15} />
            <span className="grow">{platform.features.launcher ? 'abrir app, buscar frase, comando…' : 'buscar frase, comando…'}</span>
            <span className="kbd">Ctrl K</span>
          </button>
          <span className="spacer" />
          <Clock />
          <SyncStatus />
          {isPopup && (
            <button className="icon-btn" title="Abrir em tela cheia" onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL(`app.html#${page}`) })}>
              <Icon name="external" size={16} />
            </button>
          )}
        </header>
        <main className="main">
          <UpdateBanner />
          {content}
        </main>
        <nav className="bottombar">
          {NAV.slice(0, 2).map((n) => (
            <NavBtn key={n.page} n={n} on={page === n.page} go={go} />
          ))}
          <button className="newbtn" onClick={() => setQuickAdd(true)} title="Nova frase (N)">
            <Icon name="plus" size={16} stroke={2.6} />
            <span className="full">[N] nova frase</span>
          </button>
          {NAV.slice(2).map((n) => (
            <NavBtn key={n.page} n={n} on={page === n.page} go={go} />
          ))}
          <span className="spacer" />
        </nav>
      </div>
      {quickAdd && <QuickAdd onClose={() => setQuickAdd(false)} />}
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
      <Toasts />
    </>
  );
}

function NavBtn({ n, on, go }: { n: NavItem; on: boolean; go: (p: Page) => void }) {
  return (
    <button className={`nav ${on ? 'on' : ''}`} onClick={() => go(n.page)}>
      <Icon name={n.icon} size={19} className="ic" />
      <span className="key">
        <b>[{n.key}]</b>
        {n.rest}
      </span>
      <span className="ic">{n.key + n.rest}</span>
    </button>
  );
}
