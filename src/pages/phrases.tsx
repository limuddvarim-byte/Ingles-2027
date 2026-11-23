// Aba "Frases": só frases. Estatísticas do dia, editor recolhível e a lista.
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPrompt, type PromptKind } from '../core/prompts';
import { pendingPhrases, todayStats } from '../core/stats';
import type { Phrase } from '../core/types';
import { platform } from '../platform';
import { audioIsFresh, generateAll, generateAudio, playPhrase } from '../services/eleven';
import { addPhrase, discardPhrase, highlightsOf, learnPhrase, restorePhrase, updatePhrase } from '../services/phrases';
import { useStore } from '../state/store';
import { FlashcardModal } from './flashcard';
import { Icon } from '../ui/Icon';
import { Empty, Modal, PageHead, Spinner, useAsync, useMenu, type MenuItem } from '../ui/kit';
import { RichEditor, type RichEditorHandle } from '../ui/RichEditor';
import { RichPhrase } from '../ui/RichPhrase';
import { UpdateBanner } from '../ui/UpdateBanner';

/** As três estatísticas simples do dia. */
export function TodayStrip() {
  const phrases = useStore((s) => s.phrases);
  const t = useMemo(() => todayStats(phrases), [phrases]);
  return (
    <div className="today">
      <div className="t">
        <b>{t.added ? `+${t.added}` : '0'}</b>
        <span>Frases adicionadas (para aprender) hoje</span>
      </div>
      <div className="t">
        <b>{t.learned}</b>
        <span>Frases aprendidas hoje</span>
      </div>
      <div className="t" title={t.rate.description}>
        <b style={{ color: t.rate.tone === 'none' ? undefined : t.rate.color }}>{t.rate.label}</b>
        <span>Média de aprendizado</span>
      </div>
    </div>
  );
}

/** Editor de nova frase. No PC fica recolhido numa linha; no celular abre numa gaveta acima do teclado. */
function ComposerBody({ onDone, autofocus }: { onDone?: () => void; autofocus?: boolean }) {
  const ref = useRef<RichEditorHandle>(null);
  const backRef = useRef<RichEditorHandle>(null);
  const toast = useStore((s) => s.toast);
  const seed = useStore((s) => s.editorSeed);
  const [html, setHtml] = useState(seed?.html ?? '');
  const [withBack, setWithBack] = useState(false);

  useEffect(() => {
    if (seed?.html) ref.current?.setHTML(seed.html);
  }, [seed?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const p = await addPhrase(ref.current?.getHTML() ?? '', withBack ? backRef.current?.getHTML() ?? '' : '');
    if (!p) return toast('Escreva uma frase primeiro', 'error');
    ref.current?.clear();
    backRef.current?.clear();
    setWithBack(false);
    toast('Frase adicionada', 'success');
    onDone?.();
  };

  return (
    <>
      <RichEditor ref={ref} value={html} onChange={setHtml} autofocus={autofocus} onSubmit={save} placeholder="Escreva ou cole uma frase em inglês…" />
      {withBack && (
        <div className="back-ed">
          <RichEditor ref={backRef} variant="compact" placeholder="Verso (opcional): tradução ou definição" />
        </div>
      )}
      <div className="foot">
        <button className="btn sm ghost" onClick={() => setWithBack(!withBack)}>
          <Icon name={withBack ? 'x' : 'plus'} size={14} /> Verso
        </button>
        <span className="hint hide-narrow">Selecione um trecho para destacar ou criar uma seta · Ctrl+Enter salva</span>
        <span className="sp" />
        {onDone && (
          <button className="btn sm ghost" onClick={onDone}>
            Cancelar
          </button>
        )}
        <button className="btn sm primary" onClick={save} disabled={!html}>
          Adicionar frase
        </button>
      </div>
    </>
  );
}

const isMobile = () => window.matchMedia('(max-width: 760px)').matches || document.body.classList.contains('popup');

function InlineComposer() {
  const [open, setOpen] = useState(false);
  const seed = useStore((s) => s.editorSeed);
  useEffect(() => {
    if (seed?.html && !isMobile()) setOpen(true);
  }, [seed?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && !(t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName)) && !document.querySelector('.overlay')) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return (
    <div className={`composer inline ${open ? 'open' : ''}`}>
      {open ? (
        <ComposerBody autofocus onDone={() => setOpen(false)} />
      ) : (
        <button className="closed" onClick={() => setOpen(true)}>
          <span className="plus">
            <Icon name="plus" size={16} stroke={2.4} />
          </span>
          Escreva uma nova frase…
          <span className="kbd">N</span>
        </button>
      )}
    </div>
  );
}

export function PhrasesPage() {
  const phrases = useStore((s) => s.phrases);
  const shared = useStore((s) => s.shared);
  const toast = useStore((s) => s.toast);
  const go = useStore((s) => s.go);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'noaudio' | 'noback'>('all');
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);
  const [sheet, setSheet] = useState(false);
  const seed = useStore((s) => s.editorSeed);
  useEffect(() => {
    if (seed?.html && isMobile()) setSheet(true);
  }, [seed?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const pending = useMemo(() => pendingPhrases(phrases), [phrases]);
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return pending.filter((p) => {
      if (term && !p.text.toLowerCase().includes(term) && !p.back.toLowerCase().includes(term)) return false;
      if (filter === 'noaudio') return !audioIsFresh(p, shared.elevenVoiceId);
      if (filter === 'noback') return !p.back;
      return true;
    });
  }, [pending, q, filter, shared.elevenVoiceId]);

  const runBatch = async () => {
    if (!shared.elevenApiKey || !shared.elevenVoiceId) {
      toast('Configure a chave e a voz do ElevenLabs em Ajustes', 'error');
      return;
    }
    const r = await generateAll(pending, (done, total) => setBatch({ done, total }));
    setBatch(null);
    if (r.errors.length) toast(r.errors[0], 'error');
    else toast(r.total ? `Áudio gerado para ${r.total} frase${r.total > 1 ? 's' : ''}` : 'Todas as frases já têm áudio', 'success');
  };

  return (
    <div className="page">
      <UpdateBanner />
      <PageHead
        eyebrow="Frases"
        title="Frases"
        sub={`${pending.length} para aprender · toque numa frase para copiar`}
        right={
          <button className="btn" onClick={() => go('draft')}>
            <Icon name="pen" size={15} /> Rascunho{platform.features.ocr ? ' e OCR' : ''}
          </button>
        }
      />
      <TodayStrip />
      <InlineComposer />

      <div className="listh">
        <span className="lbl">Para aprender</span>
        <span className="sp" />
        <div className="search">
          <Icon name="search" size={15} />
          <input className="input" placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="segmented">
          {(
            [
              ['all', 'Todas'],
              ['noaudio', 'Sem áudio'],
              ['noback', 'Sem verso'],
            ] as const
          ).map(([v, l]) => (
            <button key={v} className={filter === v ? 'on' : ''} onClick={() => setFilter(v)}>
              {l}
            </button>
          ))}
        </div>
        <button className="btn sm" onClick={runBatch} disabled={!!batch} title="Gerar o áudio (ElevenLabs) de todas as frases de uma vez">
          {batch ? <Spinner size={14} /> : <Icon name="volume" size={15} />}
          {batch ? `${batch.done}/${batch.total}` : 'Áudio p/ todas'}
        </button>
      </div>
      {batch && batch.total > 0 && (
        <div className="progress" style={{ margin: '-2px 0 12px' }}>
          <i style={{ width: `${(batch.done / batch.total) * 100}%`, background: 'var(--a)' }} />
        </div>
      )}

      {list.length === 0 ? (
        <div className="plist">
          <Empty
            icon="book"
            title={pending.length ? 'Nada encontrado' : 'Nenhuma frase ainda'}
            text={pending.length ? 'Tente outra busca ou filtro.' : 'Escreva uma frase acima ou capture legendas com a extensão. Marque o círculo quando aprender.'}
          />
        </div>
      ) : (
        <div className="plist">
          {list.map((p) => (
            <PhraseItem key={p.id} phrase={p} />
          ))}
        </div>
      )}

      <button className="fab" onClick={() => setSheet(true)} aria-label="Nova frase">
        <Icon name="plus" size={26} stroke={2.4} />
      </button>
      {sheet && (
        <Modal title="Nova frase" onClose={() => setSheet(false)}>
          <div className="composer open" style={{ margin: 0 }}>
            <ComposerBody autofocus onDone={() => setSheet(false)} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function useLongPress(onLong: (el: HTMLElement) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if ((e.target as HTMLElement).closest('button')) return;
      const el = e.currentTarget;
      start.current = { x: e.clientX, y: e.clientY };
      cancel();
      timer.current = setTimeout(() => {
        navigator.vibrate?.(15);
        onLong(el);
      }, 520);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) cancel();
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();
      onLong(e.currentTarget);
    },
  };
}

function ago(ts: number): string {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

export function PhraseItem({ phrase }: { phrase: Phrase }) {
  const toast = useStore((s) => s.toast);
  const voiceId = useStore((s) => s.shared.elevenVoiceId);
  const [leaving, setLeaving] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [card, setCard] = useState(false);
  const [edit, setEdit] = useState(false);
  const menu = useMenu();
  const { busy, run } = useAsync();
  const fresh = audioIsFresh(phrase, voiceId);

  const leave = (fn: () => Promise<unknown>, msg: string) => {
    setLeaving(true);
    setTimeout(async () => {
      await fn();
      toast(msg, 'success', { label: 'Desfazer', run: () => void restorePhrase(phrase.id) });
    }, 220);
  };
  const learned = () => leave(() => learnPhrase(phrase), 'Frase aprendida');
  const typo = () => leave(() => discardPhrase(phrase), 'Frase descartada — não conta nas estatísticas');

  const prompt = async (kind: PromptKind) => {
    const text = buildPrompt(kind, { text: phrase.text, highlights: highlightsOf(phrase) });
    const r = await platform.openAIs(text);
    toast(r === 'opened' ? 'Prompt copiado e aberto no Gemini, ChatGPT e Claude' : 'Prompt copiado', 'success');
  };

  const audio = () =>
    run('audio', async () => {
      if (phrase.audio && fresh) {
        if (!(await playPhrase(phrase))) toast('Áudio ainda não baixado neste aparelho', 'error');
        return;
      }
      const p = await generateAudio(phrase);
      await playPhrase(p);
    });

  const allItems = (): MenuItem[] => [
    { label: fresh ? 'Ouvir' : 'Gerar e ouvir áudio', icon: 'volume', onClick: audio },
    { label: 'Tradução PT-BR (IAs)', icon: 'languages', onClick: () => void prompt('translate') },
    { label: 'Definição em inglês (IAs)', icon: 'sparkles', onClick: () => void prompt('define') },
    { label: 'Flashcard e Anki', icon: 'layers', onClick: () => setCard(true) },
    ...(phrase.back ? [{ label: showBack ? 'Esconder verso' : 'Ver verso', icon: 'eye' as const, onClick: () => setShowBack(!showBack) }] : []),
    { label: 'Editar', icon: 'pen', onClick: () => setEdit(true) },
    { section: 'Apagar' },
    { label: 'Apagar frase (foi aprendida)', icon: 'check', onClick: learned },
    { label: 'Apagar frase (Digitação incorreta)', icon: 'trash', danger: true, onClick: typo },
  ];

  const longPress = useLongPress((el) => menu.open(el, allItems()));

  return (
    <div className={`pitem ${leaving ? 'leaving' : ''}`} {...longPress}>
      <button className="check" onClick={learned} title="Aprendi (apaga e conta nas estatísticas)" aria-label="Aprendi">
        <Icon name="check" size={14} stroke={3} />
      </button>
      <div className="ptext">
        <RichPhrase html={phrase.html} />
        <div className="pmeta">
          <span>{ago(phrase.createdAt)}</span>
          {phrase.audio && <span className={fresh ? 'tag' : ''}>áudio</span>}
          {phrase.back && (
            <button className="tag" style={{ border: 0, background: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }} onClick={() => setShowBack(!showBack)}>
              verso
            </button>
          )}
          {phrase.anki && <span>anki</span>}
        </div>
        {showBack && phrase.back && <div className="phrase-back" dangerouslySetInnerHTML={{ __html: phrase.back }} />}
      </div>
      <div className="pacts">
        <button className="icon-btn sm" title={fresh ? 'Ouvir' : 'Gerar áudio (ElevenLabs)'} onClick={audio}>
          {busy === 'audio' ? <Spinner size={14} /> : <Icon name="volume" size={16} />}
        </button>
        <button
          className="icon-btn sm"
          title="Perguntar às IAs"
          onClick={(e) =>
            menu.open(e.currentTarget, [
              { section: highlightsOf(phrase).length ? 'IAs · ênfase no destaque' : 'Perguntar às IAs' },
              { label: 'Tradução PT-BR', icon: 'languages', onClick: () => void prompt('translate') },
              { label: 'Definição em inglês', icon: 'book', onClick: () => void prompt('define') },
            ])
          }
        >
          <Icon name="sparkles" size={16} />
        </button>
        <button className="icon-btn sm" title="Flashcard e Anki" onClick={() => setCard(true)}>
          <Icon name="layers" size={16} />
        </button>
        <button className="icon-btn sm" title="Mais" onClick={(e) => menu.open(e.currentTarget, allItems())}>
          <Icon name="more" size={16} />
        </button>
      </div>
      {menu.node}
      {card && <FlashcardModal phrase={phrase} onClose={() => setCard(false)} />}
      {edit && <EditPhrase phrase={phrase} onClose={() => setEdit(false)} />}
    </div>
  );
}

function EditPhrase({ phrase, onClose }: { phrase: Phrase; onClose: () => void }) {
  const ref = useRef<RichEditorHandle>(null);
  const toast = useStore((s) => s.toast);
  const save = async () => {
    const html = ref.current?.getHTML() ?? '';
    if (!html) return toast('A frase não pode ficar vazia', 'error');
    await updatePhrase(phrase, { html });
    toast('Frase atualizada', 'success');
    onClose();
  };
  return (
    <Modal
      title="Editar frase"
      onClose={onClose}
      footer={
        <button className="btn primary" onClick={save}>
          Salvar
        </button>
      }
    >
      <RichEditor ref={ref} value={phrase.html} autofocus onSubmit={save} />
    </Modal>
  );
}
