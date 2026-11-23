// Aba "Frases": lista, estatísticas do dia, áudio, prompts e flashcards.
import { useMemo, useRef, useState } from 'react';
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
  return (
    <div className="kpis" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
      <div>
        <span>Frases adicionadas (para aprender) hoje</span>
        <b>{String(t.added).padStart(2, '0')}</b>
      </div>
      <div>
        <span>Frases aprendidas hoje</span>
        <b>{String(t.learned).padStart(2, '0')}</b>
      </div>
      <div title={t.rate.description}>
        <span>Média de aprendizado</span>
        <b style={{ color: t.rate.tone === 'none' ? undefined : t.rate.color }}>{t.rate.label}</b>
      </div>
    </div>
  );
}

export function PhrasesSection({ compactHeader = false, hideStats = false, index = '02' }: { compactHeader?: boolean; hideStats?: boolean; index?: string }) {
  const phrases = useStore((s) => s.phrases);
  const shared = useStore((s) => s.shared);
  const toast = useStore((s) => s.toast);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'noaudio' | 'noback'>('all');
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);
  const setQuick = useStore((s) => s.setQuickAdd);
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
        <div className="section-head">
          <span>
            frases · <b>{pending.length}</b> na fila
          </span>
          <span className="spacer" />
          <span className="hide-narrow">toque na frase = copiar · pressione = apagar</span>
        </div>
      )}
      {!hideStats && <TodayStrip />}

      <div className="ptool">
        <div className="search">
          <Icon name="search" size={15} />
          <input className="input" placeholder="buscar frase ou tradução…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="select" style={{ width: 'auto' }} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">todas</option>
          <option value="noaudio">sem áudio</option>
          <option value="noback">sem verso</option>
        </select>
        <button className="btn" onClick={runBatch} disabled={!!batch} title="Gerar áudio do ElevenLabs para todas as frases de uma vez">
          {batch ? <Spinner size={14} /> : <Icon name="headphones" size={15} />}
          {batch ? `${batch.done}/${batch.total}` : `áudio p/ todas${missingAudio ? ` (${missingAudio})` : ''}`}
        </button>
        <button className="btn primary" onClick={() => setQuick(true)}>
          <Icon name="plus" size={15} stroke={2.6} /> nova frase
        </button>
        {batch && batch.total > 0 && (
          <div className="progress" style={{ flexBasis: '100%', marginTop: 4 }}>
            <i style={{ width: `${(batch.done / batch.total) * 100}%`, background: 'var(--a)' }} />
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <Empty
          icon="quote"
          title={pending.length ? 'nada encontrado' : 'nenhuma frase ainda'}
          text={pending.length ? 'Tente outra busca ou filtro.' : 'Adicione frases de séries, vídeos e posts. Apagar como “aprendida” conta nas estatísticas.'}
          action={
            !pending.length && (
              <button className="btn primary" onClick={() => setQuick(true)}>
                <Icon name="plus" size={15} /> nova frase
              </button>
            )
          }
        />
      ) : (
        <div className="ptable">
          <div className="prow-head">
            <span>id</span>
            <span>quando</span>
            <span>frase</span>
            <span>status</span>
            <span style={{ textAlign: 'right' }}>ações</span>
          </div>
          {list.map((p) => (
            <PhraseRow key={p.id} phrase={p} />
          ))}
        </div>
      )}
    </section>
  );
}

export function QuickAdd({ onClose }: { onClose: () => void }) {
  const ref = useRef<RichEditorHandle>(null);
  const toast = useStore((s) => s.toast);
  const [html, setHtml] = useState('');
  const save = async (again: boolean) => {
    const p = await addPhrase(ref.current?.getHTML() ?? '');
    if (!p) return toast('Escreva uma frase primeiro', 'error');
    toast('Frase adicionada', 'success');
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

function ago(ts: number): string {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

export function PhraseRow({ phrase }: { phrase: Phrase }) {
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
    { label: 'Apagar frase (foi aprendida)', icon: 'graduation', onClick: () => leave(() => learnPhrase(phrase), 'Frase aprendida — +1 nas estatísticas') },
    { label: 'Apagar frase (Digitação incorreta)', icon: 'trash', danger: true, onClick: () => leave(() => discardPhrase(phrase), 'Frase descartada — saiu das adicionadas e não conta como aprendida') },
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

  const longPress = useLongPress((el) => menu.open((el.querySelector('.acts .del') as HTMLElement) ?? el, deleteItems));

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
    <div className={`prow ${leaving ? 'leaving' : ''}`} {...longPress}>
      <span className="id">#{phrase.id.replace(/-/g, '').slice(0, 3)}</span>
      <span className="when">{ago(phrase.createdAt)}</span>
      <div style={{ minWidth: 0 }}>
        <div className="meta-m">
          <span>#{phrase.id.replace(/-/g, '').slice(0, 3)}</span>
          <span>{ago(phrase.createdAt)}</span>
          {phrase.audio && <span className={fresh ? 'on' : ''}>♪ áudio</span>}
          {phrase.back && <span className="on">verso</span>}
          {phrase.anki && <span>anki</span>}
        </div>
        <RichPhrase html={phrase.html} />
      </div>
      <span className="st">
        {phrase.audio && <span className={fresh ? 'on' : ''} title={fresh ? 'com áudio' : 'áudio desatualizado'}>♪</span>}
        {phrase.back && <span className="on">verso</span>}
        {phrase.anki && <span>anki</span>}
        {!phrase.audio && !phrase.back && !phrase.anki && <span>—</span>}
      </span>
      <div className="acts">
        <button className="icon-btn sm" title={fresh ? 'Ouvir' : 'Gerar áudio (ElevenLabs)'} onClick={audio}>
          {busy === 'audio' ? <Spinner size={14} /> : <Icon name="volume" size={16} />}
        </button>
        {phrase.back && (
          <button className={`icon-btn sm ${showBack ? 'on' : ''}`} title="Mostrar verso" onClick={() => setShowBack(!showBack)}>
            <Icon name="eye" size={16} />
          </button>
        )}
        <button className="icon-btn sm" title="Prompts para as IAs (tradução / definição)" onClick={(e) => menu.open(e.currentTarget, promptItems())}>
          <Icon name="sparkles" size={16} />
        </button>
        <button className="icon-btn sm" title="Flashcard / Anki" onClick={() => setCard(true)}>
          <Icon name="layers" size={16} />
        </button>
        <button className="icon-btn sm" title="Editar" onClick={() => setEdit(true)}>
          <Icon name="pen" size={15} />
        </button>
        <button className="icon-btn sm del" title="Apagar" onClick={(e) => menu.open(e.currentTarget, deleteItems)}>
          <Icon name="trash" size={15} />
        </button>
        <button className="learn-btn" title="Apagar frase (foi aprendida)" onClick={() => leave(() => learnPhrase(phrase), 'Frase aprendida — +1 nas estatísticas')}>
          <Icon name="check" size={13} stroke={3} /> aprendi
        </button>
      </div>
      {showBack && phrase.back && <div className="back-line phrase-back" dangerouslySetInnerHTML={{ __html: phrase.back }} />}
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
