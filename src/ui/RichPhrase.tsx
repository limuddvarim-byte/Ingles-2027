// Renderiza a frase com formatação, palavras clicáveis (copiam ao clicar)
// e setas sob os termos que abrem a explicação escrita pelo usuário.
import { Fragment, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { sanitizeHtml } from '../core/richtext';
import { platform } from '../platform';
import { useStore } from '../state/store';
import { Icon } from './Icon';

const TAGS: Record<string, string> = { P: 'p', STRONG: 'strong', B: 'strong', EM: 'em', I: 'em', U: 'u', S: 's', SPAN: 'span', MARK: 'mark' };

function styleOf(el: HTMLElement): CSSProperties | undefined {
  const s = el.getAttribute('style');
  if (!s) return undefined;
  const out: Record<string, string> = {};
  s.split(';').forEach((d) => {
    const i = d.indexOf(':');
    if (i < 0) return;
    const k = d.slice(0, i).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[k] = d.slice(i + 1).trim();
  });
  return out as CSSProperties;
}

export function RichPhrase({ html, copyable = true, className = '' }: { html: string; copyable?: boolean; className?: string }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toast = useStore((s) => s.toast);

  const { tree, notes } = useMemo(() => {
    const doc = new DOMParser().parseFromString(`<div id="r">${sanitizeHtml(html)}</div>`, 'text/html');
    const root = doc.getElementById('r')!;
    const notes: { term: string; note: string }[] = [];
    let key = 0;

    const words = (text: string): ReactNode[] =>
      text.split(/(\s+)/).map((part) => {
        if (!part) return null;
        if (/^\s+$/.test(part)) return part;
        return (
          <span key={key++} className="w" data-word={part.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '') || part}>
            {part}
          </span>
        );
      });

    const walk = (n: Node): ReactNode => {
      if (n.nodeType === Node.TEXT_NODE) return copyable ? <Fragment key={key++}>{words(n.textContent ?? '')}</Fragment> : n.textContent;
      if (n.nodeType !== Node.ELEMENT_NODE) return null;
      const el = n as HTMLElement;
      if (el.tagName === 'BR') return <br key={key++} />;
      const children = Array.from(el.childNodes).map(walk);
      if (el.hasAttribute('data-note')) {
        const idx = notes.length;
        notes.push({ term: el.textContent ?? '', note: el.getAttribute('data-note') ?? '' });
        return (
          <span key={key++} className="term" style={styleOf(el)}>
            {children}
            <button
              type="button"
              className="term-arrow"
              title="Ver explicação"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((o) => {
                  const n2 = new Set(o);
                  if (n2.has(idx)) n2.delete(idx);
                  else n2.add(idx);
                  return n2;
                });
              }}
            >
              <Icon name="arrowDown" size={15} stroke={2.6} />
            </button>
          </span>
        );
      }
      const Tag = (TAGS[el.tagName] ?? 'span') as 'span';
      return (
        <Tag key={key++} style={styleOf(el)}>
          {children}
        </Tag>
      );
    };
    return { tree: Array.from(root.childNodes).map(walk), notes };
  }, [html, copyable]);

  const onClick = async (e: React.MouseEvent) => {
    if (!copyable) return;
    const t = (e.target as HTMLElement).closest('.w') as HTMLElement | null;
    if (!t) return;
    const word = t.dataset.word ?? t.textContent ?? '';
    await platform.copy(word);
    t.classList.remove('copied');
    void t.offsetWidth;
    t.classList.add('copied');
    toast(`“${word}” copiado`, 'success');
  };

  return (
    <div className={`phrase ${notes.length ? 'has-terms' : ''} ${className}`} onClick={onClick}>
      {tree}
      {notes.map((n, i) =>
        open.has(i) ? (
          <span key={`n${i}`} className="note-pop">
            <b>{n.term}</b> — {n.note || <i className="muted">sem explicação</i>}
          </span>
        ) : null,
      )}
    </div>
  );
}
