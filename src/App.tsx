import { useEffect, useState, type CSSProperties } from 'react';
import logo from './assets/logo.png';
import { platform } from './platform';
import type { UpdateInfo } from './platform/types';
import { useStore, type Page } from './state/store';
import { Icon, type IconName } from './ui/Icon';
import { PageHead, Toasts } from './ui/kit';
import { useApplyTheme } from './ui/theme';
import { HomePage } from './pages/home';
import { EditorPage } from './pages/editor';
import { StatsPage } from './pages/stats';
import { StreamingPage } from './pages/streaming';
import { SettingsPage } from './pages/settings';
import { PhrasesSection, QuickAdd } from './pages/phrases';

interface NavItem {
  page: Page;
  label: string;
  icon: IconName;
  gradient: string;
  glow: string;
  line: string;
}

const NAV: NavItem[] = [
  { page: 'home', label: 'Início', icon: 'home', gradient: 'var(--g-home)', glow: 'rgba(255,61,203,.65)', line: 'rgba(255,61,203,.55)' },
  { page: 'editor', label: 'Editor', icon: 'pen', gradient: 'var(--g-editor)', glow: 'rgba(255,140,60,.6)', line: 'rgba(255,140,60,.55)' },
  { page: 'stats', label: 'Stats', icon: 'chart', gradient: 'var(--g-stats)', glow: 'rgba(120,255,120,.5)', line: 'rgba(182,255,59,.5)' },
  { page: 'streaming', label: 'Stream', icon: 'tv', gradient: 'var(--g-stream)', glow: 'rgba(255,90,90,.6)', line: 'rgba(255,176,32,.55)' },
  { page: 'settings', label: 'Ajustes', icon: 'settings', gradient: 'var(--g-settings)', glow: 'rgba(110,110,255,.65)', line: 'rgba(139,92,255,.55)' },
];

const isPopup = typeof location !== 'undefined' && new URLSearchParams(location.search).has('popup');

function navFor(): NavItem[] {
  if (platform.kind === 'extension') {
    return NAV.map((n) => (n.page === 'home' ? { ...n, label: 'Frases', icon: 'quote' as IconName, gradient: 'var(--g-phrases)', glow: 'rgba(20,240,216,.6)', line: 'rgba(20,240,216,.5)' } : n));
  }
  return NAV;
}

function ExtensionPhrases() {
  return (
    <div className="page">
      <PageHead eyebrow="Frases" title={<span>Frases <span className="grad-text">para aprender</span></span>} sub="Toque na frase para copiar. Pressione para apagar." />
      <PhrasesSection compactHeader />
    </div>
  );
}

function SyncHud() {
  const sync = useStore((s) => s.sync);
  const go = useStore((s) => s.go);
  const color = sync.state === 'ok' ? '#b6ff3b' : sync.state === 'error' ? '#ff4d6d' : sync.state === 'syncing' ? '#14f0d8' : '#6f6c8e';
  const label = sync.state === 'ok' ? 'sync ok' : sync.state === 'error' ? 'sync erro' : sync.state === 'syncing' ? 'sync…' : 'offline';
  return (
    <button className="hud" style={{ color }} onClick={() => go('settings')} title="Sincronização Cloudflare">
      <i />
      <span style={{ color: 'var(--text-2)' }}>{label}</span>
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
  return <span className="hud date">{d} · {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>;
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
    <div className="page" style={{ paddingBottom: 0, paddingTop: 16 }}>
      <div className="banner" style={{ marginBottom: 0 }}>
        <Icon name="rocket" size={22} />
        <div className="grow">
          <b>Nova versão {info.version} disponível</b>
          <div className="small" style={{ opacity: 0.9 }}>{info.ready ? 'Baixada — reinicie para aplicar.' : info.progress ? `Baixando… ${Math.round(info.progress)}%` : 'Atualize sem perder nada.'}</div>
        </div>
        <button className="btn sm" onClick={() => platform.installUpdate(info)}>
          {info.ready ? 'Reiniciar' : 'Atualizar'}
        </button>
        <button className="icon-btn sm" style={{ color: '#fff' }} onClick={() => setHidden(true)}>
          <Icon name="x" size={16} />
        </button>
      </div>
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
  const nav = navFor();
  const active = nav.find((n) => n.page === page) ?? nav[0];

  useEffect(() => {
    document.body.classList.toggle('popup', isPopup);
    const h = (e: Event) => toast((e as CustomEvent).detail as string, 'info');
    window.addEventListener('ingles:toast', h);
    return () => window.removeEventListener('ingles:toast', h);
  }, [toast]);

  useEffect(() => {
    document.querySelector('.main')?.scrollTo({ top: 0 });
  }, [page]);

  const content =
    page === 'home' ? (
      platform.kind === 'extension' ? <ExtensionPhrases /> : <HomePage />
    ) : page === 'editor' ? (
      <EditorPage />
    ) : page === 'stats' ? (
      <StatsPage />
    ) : page === 'streaming' ? (
      <StreamingPage />
    ) : (
      <SettingsPage />
    );

  const dockBtn = (n: NavItem) => (
    <button key={n.page} className={`dock-item ${page === n.page ? 'active' : ''}`} style={{ '--accent': n.gradient, '--accent-glow': n.glow } as CSSProperties} onClick={() => go(n.page)} aria-label={n.label}>
      <Icon name={n.icon} size={21} stroke={2.1} />
      {n.label}
    </button>
  );

  return (
    <>
      <div className="app-bg">
        <div className="beam" />
        <div className="orb" />
        <div className="dots" />
        <div className="grain" />
      </div>
      <div className="shell" style={{ '--accent': active.gradient, '--accent-glow': active.glow, '--accent-line': active.line } as CSSProperties}>
        <header className="topbar">
          <button className="wordmark" onClick={() => go('home')}>
            <img src={logo} alt="" />
            <span>
              <b>INGLÊS</b>
              <small>{platform.label} · tríade</small>
            </span>
          </button>
          <span className="spacer" />
          <Clock />
          <SyncHud />
          {isPopup && (
            <button className="icon-btn" title="Abrir em tela cheia" onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL(`app.html#${page}`) })}>
              <Icon name="external" size={18} />
            </button>
          )}
        </header>
        <main className="main">
          <UpdateBanner />
          {content}
        </main>
        <nav className="dock">
          {nav.slice(0, 2).map(dockBtn)}
          <button className="fab" onClick={() => setQuickAdd(true)} title="Nova frase" aria-label="Nova frase">
            <Icon name="plus" size={26} stroke={2.6} />
          </button>
          {nav.slice(2).map(dockBtn)}
        </nav>
      </div>
      {quickAdd && <QuickAdd onClose={() => setQuickAdd(false)} />}
      <Toasts />
    </>
  );
}
