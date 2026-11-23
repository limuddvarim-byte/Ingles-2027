import { useEffect, useMemo } from 'react';
import logo from './assets/logo.png';
import { pendingPhrases } from './core/stats';
import { platform } from './platform';
import { useStore, type Page } from './state/store';
import { Icon, type IconName } from './ui/Icon';
import { Toasts } from './ui/kit';
import { useApplyTheme } from './ui/theme';
import { HomePage } from './pages/home';
import { PhrasesPage } from './pages/phrases';
import { DraftPage } from './pages/editor';
import { StatsPage } from './pages/stats';
import { SettingsPage } from './pages/settings';

interface NavItem {
  page: Page;
  label: string;
  icon: IconName;
}

const isPopup = typeof location !== 'undefined' && new URLSearchParams(location.search).has('popup');

function navItems(): NavItem[] {
  const items: NavItem[] = [
    { page: 'home', label: 'Início', icon: 'home' },
    { page: 'phrases', label: 'Frases', icon: 'book' },
    { page: 'stats', label: 'Estatísticas', icon: 'chart' },
    { page: 'settings', label: 'Ajustes', icon: 'settings' },
  ];
  // A extensão não tem launcher: começa direto nas frases.
  return platform.features.launcher ? items : items.filter((i) => i.page !== 'home');
}

function SyncLine() {
  const sync = useStore((s) => s.sync);
  const go = useStore((s) => s.go);
  const cls = sync.state === 'ok' ? 'ok' : sync.state === 'error' ? 'err' : sync.state === 'syncing' ? 'run' : '';
  const label = sync.state === 'ok' ? 'Sincronizado' : sync.state === 'error' ? 'Erro ao sincronizar' : sync.state === 'syncing' ? 'Sincronizando…' : 'Sincronização desligada';
  return (
    <button className={`sync ${cls}`} onClick={() => go('settings')} title="Sincronização (Cloudflare)">
      <i />
      {label}
    </button>
  );
}

/** No Android, mede o teclado para as gavetas ficarem sempre acima dele. */
function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    // Altura da janela com o teclado fechado; serve para descontar o quanto o sistema já
    // encolheu a WebView (adjustResize), evitando empurrar o editor duas vezes.
    let base = window.innerHeight;
    let nativeKb = 0;
    const set = (px: number) => root.style.setProperty('--kb', `${px > 60 ? Math.round(px) : 0}px`);
    const update = () => {
      if (!nativeKb && window.innerHeight > base) base = window.innerHeight;
      const shrunk = Math.max(0, base - window.innerHeight);
      if (nativeKb) return set(nativeKb - shrunk);
      if (!vv) return;
      set(window.innerHeight - vv.height - vv.offsetTop);
    };
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    let off: (() => void) | undefined;
    if (platform.kind === 'android') {
      import('@capacitor/keyboard')
        .then(({ Keyboard }) => {
          const a = Keyboard.addListener('keyboardWillShow', (i) => {
            nativeKb = i.keyboardHeight;
            update();
            setTimeout(update, 250);
          });
          const b = Keyboard.addListener('keyboardDidHide', () => {
            nativeKb = 0;
            set(0);
            setTimeout(() => (base = window.innerHeight), 250);
          });
          off = () => {
            void a.then((h) => h.remove());
            void b.then((h) => h.remove());
          };
        })
        .catch(() => undefined);
    }
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      off?.();
    };
  }, []);
}

export function App() {
  useApplyTheme();
  useKeyboardInset();
  const page = useStore((s) => s.page);
  const go = useStore((s) => s.go);
  const toast = useStore((s) => s.toast);
  const phrases = useStore((s) => s.phrases);
  const count = useMemo(() => pendingPhrases(phrases).length, [phrases]);
  const nav = navItems();
  const current: Page = !platform.features.launcher && page === 'home' ? 'phrases' : page;

  useEffect(() => {
    document.body.classList.toggle('popup', isPopup);
    const h = (e: Event) => toast((e as CustomEvent).detail as string, 'info');
    window.addEventListener('ingles:toast', h);
    return () => window.removeEventListener('ingles:toast', h);
  }, [toast]);

  useEffect(() => {
    document.querySelector('.main')?.scrollTo({ top: 0 });
  }, [current]);

  const content =
    current === 'home' ? <HomePage /> : current === 'phrases' ? <PhrasesPage /> : current === 'draft' ? <DraftPage /> : current === 'stats' ? <StatsPage /> : <SettingsPage />;
  const activeTab = current === 'draft' ? 'phrases' : current;

  return (
    <>
      <div className="app">
        <aside className="side">
          <button className="brand" onClick={() => go(platform.features.launcher ? 'home' : 'phrases')}>
            <img src={logo} alt="" />
            Inglês
          </button>
          {nav.map((n) => (
            <button key={n.page} className={`navi ${activeTab === n.page ? 'on' : ''}`} onClick={() => go(n.page)}>
              <Icon name={n.icon} size={19} />
              {n.label}
              {n.page === 'phrases' && count > 0 && <span className="n">{count}</span>}
            </button>
          ))}
          <div className="sp" />
          <SyncLine />
        </aside>
        <main className="main">
          <div className="mtop">
            <img src={logo} alt="" />
            <span className="sp" />
            <SyncLine />
            {isPopup && (
              <button className="icon-btn sm" title="Abrir em tela cheia" onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL(`app.html#${current}`) })}>
                <Icon name="external" size={16} />
              </button>
            )}
          </div>
          <div className="page-wrap">
            {content}
          </div>
        </main>
        <nav className="tabs">
          {nav.map((n) => (
            <button key={n.page} className={activeTab === n.page ? 'on' : ''} onClick={() => go(n.page)}>
              <Icon name={n.icon} size={22} />
              {n.label}
            </button>
          ))}
        </nav>
      </div>
      <Toasts />
    </>
  );
}

