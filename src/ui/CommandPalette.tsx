// Paleta de comandos (Ctrl+K): abrir app, ir para uma aba, buscar/copiar frase, ações rápidas.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { pendingPhrases } from '../core/stats';
import { syncNow } from '../core/sync';
import { platform } from '../platform';
import { useStore, type Page } from '../state/store';
import { TileIcon } from './BrandIcon';
import { Icon } from './Icon';

interface Cmd {
  id: string;
  group: string;
  title: string;
  hint?: string;
  icon: ReactNode;
  run: () => void | Promise<void>;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const launcher = useStore((s) => s.launcher);
  const phrases = useStore((s) => s.phrases);
  const go = useStore((s) => s.go);
  const toast = useStore((s) => s.toast);
  const setQuickAdd = useStore((s) => s.setQuickAdd);
  const setShared = useStore((s) => s.setShared);
  const theme = useStore((s) => s.shared.theme);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const all = useMemo<Cmd[]>(() => {
    const cmds: Cmd[] = [];
    if (platform.features.launcher) {
      for (const it of launcher.filter((i) => !i.hidden)) {
        cmds.push({
          id: `app:${it.id}`,
          group: 'Apps',
          title: it.name,
          hint: it.urls.length > 1 ? `${it.urls.length} páginas` : 'abrir',
          icon: <TileIcon icon={it.icon} colors={it.colors} size={26} />,
          run: () => platform.openLauncherItem(it).catch((e) => toast((e as Error).message, 'error')),
        });
      }
    }
    const pages: [Page, string, string][] = [
      ['home', platform.kind === 'extension' ? 'Frases' : 'Frases (início)', 'F'],
      ['editor', 'Editor', 'E'],
      ['stats', 'Estatísticas', 'S'],
      ['streaming', 'Streaming', 'T'],
      ['settings', 'Ajustes', 'A'],
    ];
    for (const [p, title, key] of pages) cmds.push({ id: `go:${p}`, group: 'Ir para', title, hint: key, icon: <Icon name="chevronRight" size={16} />, run: () => go(p) });
    cmds.push({ id: 'new', group: 'Ações', title: 'Nova frase', hint: 'N', icon: <Icon name="plus" size={16} />, run: () => setQuickAdd(true) });
    cmds.push({ id: 'sync', group: 'Ações', title: 'Sincronizar agora', icon: <Icon name="refresh" size={16} />, run: () => void syncNow() });
    cmds.push({ id: 'theme', group: 'Ações', title: theme === 'light' ? 'Tema AMOLED (preto)' : 'Tema claro', icon: <Icon name={theme === 'light' ? 'moon' : 'sun'} size={16} />, run: () => setShared({ theme: theme === 'light' ? 'amoled' : 'light' }) });
    for (const p of pendingPhrases(phrases)) {
      cmds.push({
        id: `ph:${p.id}`,
        group: 'Frases (Enter copia)',
        title: p.text.replace(/\n/g, ' '),
        icon: <Icon name="quote" size={14} />,
        run: async () => {
          await platform.copy(p.text.replace(/\n+/g, ' '));
          toast('Frase copiada', 'success');
        },
      });
    }
    return cmds;
  }, [launcher, phrases, theme, go, toast, setQuickAdd, setShared]);

  const filtered = useMemo(() => {
    const t = norm(q.trim());
    const list = t ? all.filter((c) => norm(c.title).includes(t) || norm(c.group).includes(t)) : all.filter((c) => !c.id.startsWith('ph:')).concat(all.filter((c) => c.id.startsWith('ph:')).slice(0, 6));
    return list.slice(0, 60);
  }, [all, q]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const exec = (c: Cmd | undefined) => {
    if (!c) return;
    onClose();
    void c.run();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(filtered.length - 1, s + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      exec(filtered[sel]);
    } else if (e.key === 'Escape') onClose();
  };

  let lastGroup = '';
  return createPortal(
    <div className="overlay pal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette-box" onKeyDown={onKey}>
        <input autoFocus placeholder="› abrir app, ir para aba, buscar frase, comando…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="palette-list" ref={listRef}>
          {filtered.length === 0 && <div className="grp">nada encontrado</div>}
          {filtered.map((c, i) => {
            const head = c.group !== lastGroup ? <div className="grp">{c.group}</div> : null;
            lastGroup = c.group;
            return (
              <div key={c.id}>
                {head}
                <button className={i === sel ? 'sel' : ''} onMouseEnter={() => setSel(i)} onClick={() => exec(c)}>
                  <span className="pi">{c.icon}</span>
                  <span className="pt">{c.title}</span>
                  {c.hint && <span className="pk">{c.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
