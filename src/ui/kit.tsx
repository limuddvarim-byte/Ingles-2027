import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../state/store';
import { Icon, type IconName } from './Icon';

export function Modal({ title, icon, accent, onClose, children, footer, wide }: { title: ReactNode; icon?: IconName; accent?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const back = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', k);
    window.addEventListener('ingles:back', back);
    return () => {
      window.removeEventListener('keydown', k);
      window.removeEventListener('ingles:back', back);
    };
  }, [onClose]);
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} style={accent ? ({ '--accent': accent } as CSSProperties) : undefined} role="dialog">
        <div className="modal-head">
          {icon && (
            <span className="chip-ico" style={{ width: 34, height: 34, borderRadius: 11, display: 'grid', placeItems: 'center', color: '#fff', background: 'var(--accent)' }}>
              <Icon name={icon} size={17} />
            </span>
          )}
          <h3 style={{ flex: 1 }}>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on} aria-label={label} />;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode; icon?: IconName }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} size={15} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone ?? ''}`}>
          <Icon name={t.tone === 'error' ? 'alert' : t.tone === 'success' ? 'check' : 'info'} size={18} className="ti" />
          <span style={{ flex: 1 }}>{t.text}</span>
          {t.action && (
            <button
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export interface MenuItem {
  label?: string;
  icon?: IconName;
  onClick?: () => void;
  danger?: boolean;
  section?: string;
}

export function Menu({ anchor, items, onClose }: { anchor: HTMLElement; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -999, left: -999 });
  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const m = ref.current!.getBoundingClientRect();
    let top = r.bottom + 6;
    if (top + m.height > window.innerHeight - 10) top = Math.max(10, r.top - m.height - 6);
    let left = r.right - m.width;
    if (left < 10) left = Math.min(r.left, window.innerWidth - m.width - 10);
    setPos({ top, left });
  }, [anchor]);
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && !anchor.contains(e.target as Node) && onClose();
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    setTimeout(() => document.addEventListener('mousedown', h), 0);
    window.addEventListener('keydown', k);
    window.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('mousedown', h);
      window.removeEventListener('keydown', k);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [anchor, onClose]);
  return createPortal(
    <div className="menu" ref={ref} style={pos}>
      {items.map((it, i) =>
        it.section ? (
          <div key={i} className="menu-label">
            {it.section}
          </div>
        ) : (
          <button
            key={i}
            className={it.danger ? 'danger' : ''}
            onClick={() => {
              onClose();
              it.onClick?.();
            }}
          >
            {it.icon && <Icon name={it.icon} size={17} />}
            {it.label}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}

export function useMenu() {
  const [state, setState] = useState<{ anchor: HTMLElement; items: MenuItem[] } | null>(null);
  return {
    open: (anchor: HTMLElement, items: MenuItem[]) => setState({ anchor, items }),
    node: state ? <Menu anchor={state.anchor} items={state.items} onClose={() => setState(null)} /> : null,
  };
}

/** Anel de progresso com gradiente. */
export function Ring({ value, size = 120, stroke = 12, colors = ['#14d2c8', '#7b3fd0'], children, track }: { value: number; size?: number; stroke?: number; colors?: [string, string]; children?: ReactNode; track?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const id = useRef(`rg${Math.random().toString(36).slice(2)}`).current;
  return (
    <div className="rate-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="progress-ring" style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={colors[0]} />
            <stop offset="1" stopColor={colors[1]} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track ?? 'var(--surface-3)'} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} />
      </svg>
      <div className="center">{children}</div>
    </div>
  );
}

export function Empty({ icon, title, text, action, accent }: { icon: IconName; title: string; text?: ReactNode; action?: ReactNode; accent?: string }) {
  return (
    <div className="empty" style={accent ? ({ '--accent': accent } as CSSProperties) : undefined}>
      <div className="empty-ico">
        <Icon name={icon} size={34} />
      </div>
      <h3>{title}</h3>
      {text && <div>{text}</div>}
      {action && <div className="mt">{action}</div>}
    </div>
  );
}

export function PageHead({ eyebrow, title, sub, right, icon }: { eyebrow: string; title: ReactNode; sub?: ReactNode; right?: ReactNode; icon?: IconName }) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">
          {icon && <Icon name={icon} size={14} style={{ color: 'var(--turquoise)' }} />}
          {eyebrow}
        </div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {right && <div className="row wrap">{right}</div>}
    </div>
  );
}

/** Ação assíncrona com estado de carregando + toast de erro. */
export function useAsync() {
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useStore((s) => s.toast);
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message || 'Algo deu errado', 'error');
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <Icon name="refresh" size={size} className="spin" />;
}
