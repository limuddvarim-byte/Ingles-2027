// Aba "Frases": lista, estatísticas do dia, áudio, prompts e flashcards.
import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { buildPrompt, type PromptKind } from '../core/prompts';
import { pendingPhrases, todayStats } from '../core/stats';
import type { Phrase } from '../core/types';
import { platform } from '../platform';
import { audioIsFresh, generateAll, generateAudio, playPhrase } from '../services/eleven';
import { addPhrase, discardPhrase, highlightsOf, learnPhrase, restorePhrase, updatePhrase } from '../services/phrases';
import { useStore } from '../state/store';
import { FlashcardModal } from './flashcard';
import { Icon } from '../ui/Icon';
import { Empty, Modal, Spinner, useAsync, useMenu, type MenuItem } from '../ui/kit';
import { RichEditor, type RichEditorHandle } from '../ui/RichEditor';
import { RichPhrase } from '../ui/RichPhrase';

export function TodayStrip() {
  const phrases = useStore((s) => s.phrases);
  const t = useMemo(() => todayStats(phrases), [phrases]);
  const pct = t.rate.pct === null ? 0 : Math.min(100, t.rate.pct);
  return (
    <div className="stat-strip">
      <div className="mini-stat">
        <div className="ms-ico" style={{ background: 'var(--g-phrases)' }}>
          <Icon name="plus" size={20} stroke={2.6} />
        </div>
        <div>
          <b>{t.added}</b>
          <span>Frases adicionadas (para aprender) hoje</span>
        </div>
        <i className="bar" style={{ width: `${Math.min(100, t.added * 10)}%`, background: 'var(--g-phrases)' }} />
      </div>
      <div className="mini-stat">
        <div className="ms-ico" style={{ background: 'var(--g-stats)' }}>
          <Icon name="graduation" size={20} stroke={2.4} />
        </div>
        <div>
          <b>{t.learned}</b>
          <span>Frases aprendidas hoje</span>
        </div>
        <i className="bar" style={{ width: `${Math.min(100, t.learned * 10)}%`, background: 'var(--g-stats)' }} />
      </div>
      <div className="mini-stat" title={t.rate.description}>
        <div className="ms-ico" style={{ background: t.rate.color, boxShadow: `0 8px 20px -8px ${t.rate.color}` }}>
          <Icon name="target" size={20} stroke={2.4} />
        </div>
        <div>
          <b style={{ color: t.rate.color }}>{t.rate.label}</b>
          <span>
            Média de aprendizado<span className="hide-narrow"> · {t.rate.description}</span>
          </span>
        </div>
        <i className="bar" style={{ width: `${pct}%`, background: t.rate.color }} />
      </div>
    </div>
  );
}

export function PhrasesSection({ compactHeader = false }: { compactHeader?: boolean }) {
  const phrases = useStore((s) => s.phrases);
  const shared = useStore((s) => s.shared);
  const toast = useStore((s) => s.toast);
  const seedEditor = useStore((s) => s.seedEditor);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'noaudio' | 'noback'>('all');
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);
  const [quick, setQuick] = useState(false);
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

  const missingAudio = pending.filter((p) => !audioIsFresh(p, shared.elevenVoiceId)).length;

  const runBatch = async () => {
    if (!shared.elevenApiKey || !shared.elevenVoiceId) {
      toast('Configure a chave e a voz do ElevenLabs em Ajustes → Voz', 'error');
      return;
    }
    const r = await generateAll(pending, (done, total) => setBatch({ done, total }));
    setBatch(null);
    if (r.errors.length) toast(r.errors[0], 'error');
    else toast(r.total ? `Áudio gerado para ${r.total} frase${r.total > 1 ? 's' : ''} 🎧` : 'Todas as frases já têm áudio', 'success');
  };

  return (
    <section>
      {!compactHeader && (
        <div className="row between wrap" style={{ margin: '28px 0 14px' }}>
          <div>
            <div className="eyebrow" style={{ '--accent': 'var(--g-phrases)' } as CSSProperties}>
              <Icon name="quote" size={14} /> Frases
            </div>
            <h2 style={{ margin: 0, fontSize: 22, letterSpacing: '-.02em' }}>
              Para aprender <span className="muted" style={{ fontWeight: 600 }}>· {pending.length}</span>
            </h2>
          </div>
        </div>
      )}
      <TodayStrip />

      <div className="toolbar-sticky mt">
        <div className="row wrap">
          <div className="search">
            <Icon name="search" size={17} />
            <input className="input" placeholder="Buscar frase ou tradução…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="select" style={{ width: 'auto' }} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">Todas</option>
            <option value="noaudio">Sem áudio</option>
            <option value="noback">Sem verso</option>
          </select>
          <button className="btn" onClick={runBatch} disabled={!!batch} title="Gerar áudio do ElevenLabs para todas as frases de uma vez" style={{ '--accent': 'var(--g-editor)' } as CSSProperties}>
            {batch ? <Spinner /> : <Icon name="headphones" size={17} />}
            {batch ? `${batch.done}/${batch.total}` : `Áudio p/ todas${missingAudio ? ` (${missingAudio})` : ''}`}
          </button>
          <button className="btn primary" style={{ '--accent': 'var(--g-phrases)', '--accent-glow': 'rgba(20,210,200,.6)' } as CSSProperties} onClick={() => setQuick(true)}>
            <Icon name="plus" size={17} stroke={2.6} /> Nova frase
          </button>
        </div>
        {batch && batch.total > 0 && (
          <div className="progress" style={{ marginTop: 10 }}>
            <i style={{ width: `${(batch.done / batch.total) * 100}%`, background: 'var(--g-editor)' }} />
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <div className="card">
          <Empty
            icon="quote"
            accent="var(--g-phrases)"
            title={pending.length ? 'Nada encontrado' : 'Nenhuma frase ainda'}
            text={pending.length ? 'Tente outra busca ou filtro.' : 'Adicione frases que você encontrar em séries, vídeos e posts. Ao apagar uma frase, ela conta como aprendida.'}
            action={
              !pending.length && (
                <button className="btn primary" onClick={() => seedEditor('')} style={{ '--accent': 'var(--g-phrases)' } as CSSProperties}>
                  <Icon name="pen" size={16} /> Abrir editor
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="phrase-list">
          {list.map((p, i) => (
            <PhraseCard key={p.id} phrase={p} index={i} />
          ))}
        </div>
      )}
      {quick && <QuickAdd onClose={() => setQuick(false)} />}
    </section>
  );
}

function QuickAdd({ onClose }: { onClose: () => void }) {
  const ref = useRef<RichEditorHandle>(null);
  const toast = useStore((s) => s.toast);
  const [html, setHtml] = useState('');
  const save = async (again: boolean) => {
    const p = await addPhrase(ref.current?.getHTML() ?? '');
    if (!p) return toast('Escreva uma frase primeiro', 'error');
    toast('Frase adicionada ✨', 'success');
    if (again) {
      ref.current?.clear();
      ref.current?.focus();
    } else onClose();
  };
  return (
    <Modal
      title="Nova frase"
      icon="plus"
      accent="var(--g-phrases)"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={() => save(true)} disabled={!html}>
            Salvar e adicionar outra
          </button>
          <button className="btn primary" onClick={() => save(false)} disabled={!html}>
            <Icon name="check" size={16} /> Adicionar
          </button>
        </>
      }
    >
      <RichEditor ref={ref} value="" onChange={setHtml} autofocus onSubmit={() => save(false)} />
      <p className="hint" style={{ marginTop: 10 }}>
        Selecione um trecho para destacar (negrito, cor, sublinhado) ou criar uma <b>seta com explicação</b>. Os prompts das IAs dão ênfase ao trecho destacado. <span className="kbd">Ctrl</span>+<span className="kbd">Enter</span> salva.
      </p>
    </Modal>
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
        navigator.vibrate?.(18);
        onLong(el);
      }, 550);
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

export function PhraseCard({ phrase, index = 0 }: { phrase: Phrase; index?: number }) {
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
    }, 260);
  };

  const deleteItems: MenuItem[] = [
    { section: 'Apagar' },
    { label: 'Apagar frase (foi aprendida)', icon: 'graduation', onClick: () => leave(() => learnPhrase(phrase), 'Frase aprendida! 🎉 +1 nas estatísticas') },
    { label: 'Apagar frase (Digitação incorreta)', icon: 'trash', danger: true, onClick: () => leave(() => discardPhrase(phrase), 'Frase descartada (não conta como aprendida)') },
  ];

  const prompt = async (kind: PromptKind) => {
    const text = buildPrompt(kind, { text: phrase.text, highlights: highlightsOf(phrase) });
    const r = await platform.openAIs(text);
    toast(r === 'opened' ? 'Prompt copiado e enviado para Gemini, ChatGPT e Claude' : 'Prompt copiado', 'success');
  };

  const promptItems = (): MenuItem[] => {
    const hl = highlightsOf(phrase).length > 0;
    return [
      { section: hl ? 'Prompts (ênfase no destaque)' : 'Prompts para as IAs' },
      { label: 'Tradução PT-BR (estrutura do inglês)', icon: 'languages', onClick: () => void prompt('translate') },
      { label: 'Definição em inglês', icon: 'book', onClick: () => void prompt('define') },
    ];
  };

  const longPress = useLongPress((el) => menu.open(el.querySelector('.phrase-actions .del') as HTMLElement ?? el, deleteItems));

  const audio = () =>
    run('audio', async () => {
      if (phrase.audio && fresh) {
        if (!(await playPhrase(phrase))) toast('Áudio ainda não baixado neste aparelho', 'error');
        return;
      }
      const p = await generateAudio(phrase);
      await playPhrase(p);
    });

  return (
    <div className={`phrase-card ${leaving ? 'leaving' : ''}`} style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }} {...longPress}>
      <RichPhrase html={phrase.html} />
      {showBack && phrase.back && <div className="phrase-back" dangerouslySetInnerHTML={{ __html: phrase.back }} />}
      <div className="phrase-actions">
        <div className="phrase-meta">
          {phrase.audio && <span className={`pill ${fresh ? 't' : ''}`}><Icon name="volume" size={11} /> {fresh ? 'áudio' : 'áudio antigo'}</span>}
          {phrase.back && <span className="pill t"><Icon name="flip" size={11} /> verso</span>}
          {phrase.anki && <span className="pill"><Icon name="layers" size={11} /> anki</span>}
        </div>
        <span className="spacer" />
        <button className="icon-btn sm" title={fresh ? 'Ouvir' : 'Gerar áudio (ElevenLabs)'} onClick={audio}>
          {busy === 'audio' ? <Spinner /> : <Icon name="volume" size={17} />}
        </button>
        {phrase.back && (
          <button className={`icon-btn sm ${showBack ? 'on' : ''}`} title="Mostrar verso" onClick={() => setShowBack(!showBack)} style={{ '--accent': 'var(--g-phrases)' } as CSSProperties}>
            <Icon name="eye" size={17} />
          </button>
        )}
        <button className="icon-btn sm" title="Prompts para IAs" onClick={(e) => menu.open(e.currentTarget, promptItems())}>
          <Icon name="sparkles" size={17} />
        </button>
        <button className="icon-btn sm" title="Flashcard / Anki" onClick={() => setCard(true)}>
          <Icon name="layers" size={17} />
        </button>
        <button className="icon-btn sm" title="Editar" onClick={() => setEdit(true)}>
          <Icon name="pen" size={16} />
        </button>
        <button className="icon-btn sm del" title="Apagar" onClick={(e) => menu.open(e.currentTarget, deleteItems)}>
          <Icon name="trash" size={16} />
        </button>
        <button className="learn-btn" title="Apagar frase (foi aprendida)" onClick={() => leave(() => learnPhrase(phrase), 'Frase aprendida! 🎉 +1 nas estatísticas')}>
          <Icon name="check" size={15} stroke={3} /> Aprendi
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
      icon="pen"
      accent="var(--g-editor)"
      onClose={onClose}
      footer={
        <button className="btn primary" onClick={save}>
          <Icon name="check" size={16} /> Salvar
        </button>
      }
    >
      <RichEditor ref={ref} value={phrase.html} autofocus onSubmit={save} />
    </Modal>
  );
}
