import { useEffect, useState, type CSSProperties } from 'react';
import logo from './assets/logo.png';
import { platform } from './platform';
import type { UpdateInfo } from './platform/types';
import { useStore, type Page } from './state/store';
import { Icon, type IconName } from './ui/Icon';
import { Toasts } from './ui/kit';
import { useApplyTheme } from './ui/theme';
import { HomePage } from './pages/home';
import { EditorPage } from './pages/editor';
import { StatsPage } from './pages/stats';
import { StreamingPage } from './pages/streaming';
import { SettingsPage } from './pages/settings';
import { PhrasesSection } from './pages/phrases';
import { PageHead } from './ui/kit';

interface NavItem {
  page: Page;
  label: string;
  short: string;
  icon: IconName;
  gradient: string;
  glow: string;
}

const NAV: NavItem[] = [
  { page: 'home', label: 'Início', short: 'Início', icon: 'home', gradient: 'var(--g-home)', glow: 'rgba(139,92,246,.6)' },
  { page: 'editor', label: 'Editor', short: 'Editor', icon: 'pen', gradient: 'var(--g-editor)', glow: 'rgba(236,72,153,.55)' },
  { page: 'stats', label: 'Estatísticas', short: 'Stats', icon: 'chart', gradient: 'var(--g-stats)', glow: 'rgba(34,197,94,.55)' },
  { page: 'streaming', label: 'Streaming', short: 'Streaming', icon: 'tv', gradient: 'var(--g-stream)', glow: 'rgba(249,115,22,.55)' },
  { page: 'settings', label: 'Ajustes', short: 'Ajustes', icon: 'settings', gradient: 'var(--g-settings)', glow: 'rgba(99,102,241,.55)' },
];

const isPopup = typeof location !== 'undefined' && new URLSearchParams(location.search).has('popup');

function navFor(): NavItem[] {
  if (platform.kind === 'extension') {
    return NAV.map((n) => (n.page === 'home' ? { ...n, label: 'Frases', short: 'Frases', icon: 'quote' as IconName, gradient: 'var(--g-phrases)', glow: 'rgba(20,210,200,.6)' } : n));
  }
  return NAV;
}

function ExtensionPhrases() {
  return (
    <div className="page" style={{ '--accent': 'var(--g-phrases)', '--accent-glow': 'rgba(20,210,200,.6)' } as CSSProperties}>
      <PageHead eyebrow="Frases" icon="quote" title={<span>Frases <span className="grad-text">para aprender</span></span>} sub="Toque numa palavra para copiar. Pressione a frase para apagar." />
      <PhrasesSection compactHeader />
    </div>
  );
}

function SyncDot() {
  const sync = useStore((s) => s.sync);
  const go = useStore((s) => s.go);
  const color = sync.state === 'ok' ? '#22c55e' : sync.state === 'error' ? '#f43f5e' : sync.state === 'syncing' ? '#14d2c8' : '#8b88a5';
  const label = sync.state === 'ok' ? 'Sincronizado' : sync.state === 'error' ? 'Erro na sincronização' : sync.state === 'syncing' ? 'Sincronizando…' : 'Sincronização desligada';
  return (
    <button className="icon-btn" title={label} onClick={() => go('settings')} style={{ color }}>
      <Icon name={sync.state === 'off' ? 'cloudOff' : sync.state === 'syncing' ? 'refresh' : 'cloud'} size={18} className={sync.state === 'syncing' ? 'spin' : ''} />
    </button>
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
    <div className="page" style={{ paddingBottom: 0, paddingTop: 16 }}>
      <div className="banner" style={{ marginBottom: 0 }}>
        <Icon name="rocket" size={22} />
        <div className="grow">
          <b>Nova versão {info.version} disponível</b>
          <div className="small" style={{ opacity: 0.85 }}>{info.ready ? 'Baixada — reinicie para aplicar.' : info.progress ? `Baixando… ${Math.round(info.progress)}%` : 'Atualize sem perder nada.'}</div>
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

  return (
    <>
      <div className="aurora">
        <i />
        <i />
        <i />
      </div>
      <div className="shell" style={{ '--accent': active.gradient, '--accent-glow': active.glow } as CSSProperties}>
        <aside className="sidebar">
          <div className="brand">
            <img src={logo} alt="" />
            <div>
              <b>Inglês</b>
              <small>{platform.label}</small>
            </div>
          </div>
          {nav.map((n) => (
            <button key={n.page} className={`nav-item ${page === n.page ? 'active' : ''}`} style={{ '--accent': n.gradient, '--accent-glow': n.glow } as CSSProperties} onClick={() => go(n.page)}>
              <span className="nav-ico">
                <Icon name={n.icon} size={18} />
              </span>
              {n.label}
            </button>
          ))}
          <div className="spacer" />
          <div className="row" style={{ padding: '0 6px' }}>
            <SyncDot />
            <span className="tiny muted" style={{ fontWeight: 700 }}>
              Software · App · Extensão
            </span>
          </div>
        </aside>
        <header className="topbar">
          <img src={logo} alt="" />
          <span className="title grad-text" style={{ background: 'var(--brand)', WebkitBackgroundClip: 'text' }}>
            Inglês
          </span>
          <span className="spacer" />
          <SyncDot />
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
        <nav className="bottombar">
          {nav.map((n) => (
            <button key={n.page} className={page === n.page ? 'active' : ''} style={{ '--accent': n.gradient, '--accent-glow': n.glow } as CSSProperties} onClick={() => go(n.page)}>
              <Icon name={n.icon} size={20} />
              {n.short}
            </button>
          ))}
        </nav>
      </div>
      <Toasts />
    </>
  );
}
