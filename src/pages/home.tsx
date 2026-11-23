// Página inicial: launcher bonito (software e app) + aba Frases.
import { useMemo, useState, type CSSProperties } from 'react';
import { put, putMany, remove, uid } from '../core/db';
import { SERVICES } from '../core/defaults';
import { pendingPhrases, todayStats, watchTotals } from '../core/stats';
import { dayKey, formatDuration } from '../core/time';
import type { CloneKind, IconSpec, LauncherItem, StreamingService } from '../core/types';
import { platform } from '../platform';
import { useStore } from '../state/store';
import { BRAND_IDS, TileIcon } from '../ui/BrandIcon';
import { Icon, ICON_NAMES } from '../ui/Icon';
import { Modal, Segmented, Switch } from '../ui/kit';
import { PhrasesSection } from './phrases';

export function HomePage() {
  return (
    <div className="page">
      <KpiStrip />
      {platform.features.launcher && <AppsStrip />}
      <PhrasesSection hideStats />
    </div>
  );
}

/** Números do dia: adicionadas, aprendidas, média, tempo assistido e fila. */
export function KpiStrip() {
  const phrases = useStore((s) => s.phrases);
  const watch = useStore((s) => s.watch);
  const goal = useStore((s) => s.shared.dailyGoalMinutes);
  const today = dayKey();
  const t = useMemo(() => todayStats(phrases), [phrases]);
  const watched = useMemo(() => watchTotals(watch, (d) => d === today).total, [watch, today]);
  const pending = useMemo(() => pendingPhrases(phrases).length, [phrases]);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="kpis">
      <div>
        <span>Frases adicionadas (para aprender) hoje</span>
        <b>{t.added ? `+${pad(t.added)}` : '00'}</b>
      </div>
      <div>
        <span>Frases aprendidas hoje</span>
        <b>{pad(t.learned)}</b>
      </div>
      <div title={t.rate.description}>
        <span>Média de aprendizado</span>
        <b style={{ color: t.rate.tone === 'none' ? undefined : t.rate.color }}>{t.rate.label}</b>
        <small>{t.rate.description.toLowerCase()}</small>
      </div>
      <div>
        <span>Inglês assistido hoje</span>
        <b>{formatDuration(watched).replace(' ', '')}</b>
        <small>meta {goal} min · {goal ? Math.min(100, Math.round((watched / 60 / goal) * 100)) : 0}%</small>
      </div>
      <div>
        <span>Na fila</span>
        <b>{pad(pending)}</b>
      </div>
    </div>
  );
}

function AppsStrip() {
  const items = useStore((s) => s.launcher);
  const toast = useStore((s) => s.toast);
  const [editing, setEditing] = useState(false);
  const [modal, setModal] = useState<LauncherItem | 'new' | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const visible = items.filter((i) => !i.hidden);

  const open = async (item: LauncherItem) => {
    if (editing) return setModal(item);
    try {
      await platform.openLauncherItem(item);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const reorder = async (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const list = [...visible];
    const from = list.findIndex((i) => i.id === fromId);
    const to = list.findIndex((i) => i.id === toId);
    const [m] = list.splice(from, 1);
    list.splice(to, 0, m);
    await putMany('launcher', list.map((i, order) => ({ ...i, order })));
  };

  return (
    <>
      <div className="apps">
        <span className="lbl">apps</span>
        {visible.map((item) => (
          <button
            key={item.id}
            className={`app ${editing ? 'editing' : ''} ${drag === item.id ? 'dragging' : ''} ${over === item.id ? 'drop-target' : ''}`}
            onClick={() => open(item)}
            draggable={editing}
            onDragStart={() => setDrag(item.id)}
            onDragEnd={() => {
              setDrag(null);
              setOver(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(item.id);
            }}
            onDrop={() => drag && reorder(drag, item.id)}
            title={platform.kind === 'desktop' ? `${item.name} — abre no Chrome Estudos` : item.name}
          >
            {editing && (
              <span
                className="x"
                onClick={(e) => {
                  e.stopPropagation();
                  void remove('launcher', item.id);
                  toast(`“${item.name}” removido`, 'info');
                }}
              >
                <Icon name="x" size={11} stroke={3} />
              </span>
            )}
            <span className="ico">
              <TileIcon icon={item.icon} colors={item.colors} size={50} />
            </span>
            <span className="nm">{item.name.toLowerCase()}</span>
            {item.urls.length > 1 && <span className="count">×{item.urls.length}</span>}
          </button>
        ))}
        <button className="app add" onClick={() => setModal('new')} title="Adicionar atalho">
          <span className="ico">
            <Icon name="plus" size={18} />
          </span>
          <span className="nm">novo</span>
        </button>
        <button className={`app add ${editing ? 'editing' : ''}`} onClick={() => setEditing(!editing)} title="Editar, reordenar e remover atalhos">
          <span className="ico">
            <Icon name={editing ? 'check' : 'pen'} size={16} />
          </span>
          <span className="nm">{editing ? 'ok' : 'editar'}</span>
        </button>
      </div>
      {modal && <LauncherModal item={modal === 'new' ? null : modal} count={items.length} onClose={() => setModal(null)} />}
    </>
  );
}

const GRADIENTS: [string, string][] = [
  ['#A855F7', '#6366F1'],
  ['#14D2C8', '#3B82F6'],
  ['#EC4899', '#F97316'],
  ['#22C55E', '#14B8A6'],
  ['#F97316', '#EF4444'],
  ['#FACC15', '#F97316'],
  ['#6366F1', '#D946EF'],
  ['#0EA5E9', '#22D3EE'],
  ['#F43F5E', '#A855F7'],
  ['#1F2937', '#0B0B10'],
];
const EMOJIS = ['🎬', '📺', '🍿', '🎧', '📚', '🧠', '🇺🇸', '🇬🇧', '🗽', '🎮', '🎵', '📰', '🎙️', '✍️', '💬', '🌎', '⭐', '🔥', '🚀', '☕'];

function LauncherModal({ item, count, onClose }: { item: LauncherItem | null; count: number; onClose: () => void }) {
  const toast = useStore((s) => s.toast);
  const [name, setName] = useState(item?.name ?? '');
  const [urls, setUrls] = useState<string[]>(item?.urls.length ? item.urls : ['']);
  const [icon, setIcon] = useState<IconSpec>(item?.icon ?? { kind: 'preset', value: 'globe' });
  const [colors, setColors] = useState<[string, string]>(item?.colors ?? GRADIENTS[0]);
  const [service, setService] = useState<StreamingService | ''>(item?.service ?? '');
  const [clone, setClone] = useState<CloneKind>(item?.clone ?? null);
  const [pkg, setPkg] = useState(item?.androidPackage ?? '');
  const [tab, setTab] = useState<'preset' | 'icons' | 'emoji' | 'image'>(icon.kind === 'emoji' ? 'emoji' : icon.kind === 'image' ? 'image' : icon.kind === 'preset' && !BRAND_IDS.includes(icon.value) ? 'icons' : 'preset');

  const norm = (u: string) => {
    const t = u.trim();
    if (!t) return '';
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
  };

  const save = async () => {
    const clean = urls.map(norm).filter(Boolean);
    if (!name.trim() || !clean.length) return toast('Dê um nome e pelo menos uma página', 'error');
    const rec: LauncherItem = {
      id: item?.id ?? uid(),
      name: name.trim(),
      urls: clean,
      icon,
      colors,
      order: item?.order ?? count,
      service: service || null,
      clone,
      androidPackage: pkg.trim() || null,
      builtin: item?.builtin ?? null,
      updatedAt: Date.now(),
    };
    await put('launcher', rec);
    toast(item ? 'Atalho atualizado' : 'Atalho criado ✨', 'success');
    onClose();
  };

  const upload = (f: File | undefined) => {
    if (!f) return;
    const img = new Image();
    const r = new FileReader();
    r.onload = () => {
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = 192;
        const ctx = c.getContext('2d')!;
        const s = Math.max(192 / img.width, 192 / img.height);
        ctx.drawImage(img, (192 - img.width * s) / 2, (192 - img.height * s) / 2, img.width * s, img.height * s);
        setIcon({ kind: 'image', value: c.toDataURL('image/png') });
      };
      img.src = r.result as string;
    };
    r.readAsDataURL(f);
  };

  const domain = (() => {
    try {
      return new URL(norm(urls[0] ?? '')).hostname;
    } catch {
      return '';
    }
  })();

  return (
    <Modal
      wide
      title={item ? 'Editar atalho' : 'Novo atalho'}
      icon="rocket"
      accent="var(--g-home)"
      onClose={onClose}
      footer={
        <button className="btn primary" onClick={save}>
          <Icon name="check" size={16} /> Salvar atalho
        </button>
      }
    >
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="col" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 16 }}>
            <span className="tile-icon" style={{ width: 84, height: 84, '--tile-glow': colors[0] } as CSSProperties}>
              <TileIcon icon={icon} colors={colors} size={84} />
            </span>
            <div className="field" style={{ flex: 1 }}>
              <label>Nome</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Podcasts" autoFocus />
            </div>
          </div>
          <div className="field">
            <label>Páginas (várias = abrem juntas em abas)</label>
            {urls.map((u, i) => (
              <div className="row" key={i}>
                <input className="input" value={u} placeholder="https://…" onChange={(e) => setUrls(urls.map((x, j) => (j === i ? e.target.value : x)))} />
                {urls.length > 1 && (
                  <button className="icon-btn" onClick={() => setUrls(urls.filter((_, j) => j !== i))}>
                    <Icon name="x" size={16} />
                  </button>
                )}
              </div>
            ))}
            <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setUrls([...urls, ''])}>
              <Icon name="plus" size={15} /> Adicionar outra página
            </button>
          </div>
          <div className="field">
            <label>Conta como streaming (estatísticas)</label>
            <select className="select" value={service} onChange={(e) => setService(e.target.value as StreamingService | '')}>
              <option value="">Nenhum</option>
              {SERVICES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="set-row" style={{ padding: '6px 0' }}>
            <div className="set-text">
              <b>Versão clonada no celular</b>
              <span>Abre isolado dentro do app, em inglês (conta separada)</span>
            </div>
            <Switch on={!!clone} onChange={(v) => setClone(v ? 'realworld' : null)} />
          </div>
          {!clone && (
            <div className="field">
              <label>App Android (pacote, opcional)</label>
              <input className="input" value={pkg} onChange={(e) => setPkg(e.target.value)} placeholder="ex.: com.netflix.mediaclient" />
            </div>
          )}
        </div>

        <div className="col" style={{ gap: 12 }}>
          <div className="label">Ícone</div>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'preset', label: 'Marcas' },
              { value: 'icons', label: 'Ícones' },
              { value: 'emoji', label: 'Emoji' },
              { value: 'image', label: 'Imagem' },
            ]}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(48px,1fr))', gap: 8, maxHeight: 220, overflow: 'auto', padding: 2 }}>
            {tab === 'preset' &&
              BRAND_IDS.map((b) => (
                <button key={b} className="tile-icon" style={{ width: 48, height: 48, borderRadius: 15, border: 0, padding: 0, outline: icon.kind === 'preset' && icon.value === b ? '3px solid var(--turquoise)' : undefined }} onClick={() => setIcon({ kind: 'preset', value: b })}>
                  <TileIcon icon={{ kind: 'preset', value: b }} colors={colors} size={48} />
                </button>
              ))}
            {tab === 'icons' &&
              ICON_NAMES.map((n) => (
                <button key={n} className="icon-btn" style={{ width: 48, height: 48, background: icon.kind === 'preset' && icon.value === n ? 'var(--accent)' : 'var(--surface-3)', color: icon.kind === 'preset' && icon.value === n ? '#fff' : undefined }} onClick={() => setIcon({ kind: 'preset', value: n })}>
                  <Icon name={n} size={20} />
                </button>
              ))}
            {tab === 'emoji' &&
              EMOJIS.map((e) => (
                <button key={e} className="icon-btn" style={{ width: 48, height: 48, fontSize: 24, background: icon.kind === 'emoji' && icon.value === e ? 'var(--accent)' : 'var(--surface-3)' }} onClick={() => setIcon({ kind: 'emoji', value: e })}>
                  {e}
                </button>
              ))}
          </div>
          {tab === 'image' && (
            <div className="col">
              <label className="btn">
                <Icon name="upload" size={16} /> Enviar imagem (PNG/JPG)
                <input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
              </label>
              {domain && (
                <button className="btn" onClick={() => setIcon({ kind: 'favicon', value: domain })}>
                  <Icon name="globe" size={16} /> Usar ícone do site ({domain})
                </button>
              )}
            </div>
          )}
          <div className="label mt">Cores do bloco</div>
          <div className="row wrap" style={{ gap: 8 }}>
            {GRADIENTS.map((g) => (
              <button key={g.join()} onClick={() => setColors(g)} style={{ width: 36, height: 36, borderRadius: 12, border: colors.join() === g.join() ? '3px solid var(--text)' : '0', background: `linear-gradient(145deg, ${g[0]}, ${g[1]})` }} />
            ))}
            <label style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--surface-3)', display: 'grid', placeItems: 'center', position: 'relative', cursor: 'pointer' }} title="Cor personalizada">
              <Icon name="palette" size={16} />
              <input type="color" value={colors[0]} onChange={(e) => setColors([e.target.value, colors[1]])} style={{ position: 'absolute', inset: 0, opacity: 0 }} />
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
}
