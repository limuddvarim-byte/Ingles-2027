// Flashcard: frente = frase do editor, verso (opcional) = tradução PT-BR ou definição em inglês.
// Envia para o Anki (AnkiConnect no PC → AnkiWeb, ou AnkiDroid no celular) com o áudio do ElevenLabs.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { buildPrompt, type PromptKind } from '../core/prompts';
import { escapeHtml } from '../core/richtext';
import type { Phrase } from '../core/types';
import { platform } from '../platform';
import { blobToBase64 } from '../platform/ankiconnect';
import type { AnkiDeck } from '../platform/types';
import { audioBlob, audioIsFresh, generateAudio, playPhrase } from '../services/eleven';
import { highlightsOf, updatePhrase } from '../services/phrases';
import { useStore } from '../state/store';
import { Icon } from '../ui/Icon';
import { Modal, Spinner, useAsync } from '../ui/kit';
import { RichEditor, type RichEditorHandle } from '../ui/RichEditor';
import { RichPhrase } from '../ui/RichPhrase';

/** Converte a resposta (markdown simples das IAs) em HTML. */
export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r/g, '').split('\n');
  const out: string[] = [];
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    let h = escapeHtml(l.replace(/^#{1,6}\s*/, '').replace(/^[-*•]\s+/, '• '));
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>');
    out.push(`<p>${h}</p>`);
  }
  return out.join('');
}

export function FlashcardModal({ phrase, onClose }: { phrase: Phrase; onClose: () => void }) {
  const toast = useStore((s) => s.toast);
  const shared = useStore((s) => s.shared);
  const setShared = useStore((s) => s.setShared);
  const backRef = useRef<RichEditorHandle>(null);
  const [back, setBack] = useState(phrase.back);
  const [flipped, setFlipped] = useState(false);
  const [decks, setDecks] = useState<AnkiDeck[] | null>(null);
  const [deck, setDeck] = useState(shared.ankiDeck || 'Inglês');
  const [newDeck, setNewDeck] = useState('');
  const [ankiMsg, setAnkiMsg] = useState('');
  const { busy, run } = useAsync();
  const [current, setCurrent] = useState(phrase);
  const hasHl = highlightsOf(phrase).length > 0;

  const loadDecks = () =>
    run('decks', async () => {
      const a = await platform.anki.available();
      setAnkiMsg(a.message);
      if (!a.ok) {
        setDecks([]);
        return;
      }
      const d = await platform.anki.decks();
      setDecks(d);
      if (d.length && !d.some((x) => x.name === deck)) setDeck(d[0].name);
    });

  useEffect(() => {
    void loadDecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveBack = async () => {
    const html = backRef.current?.getHTML() ?? back;
    const p = await updatePhrase(current, { back: html });
    setCurrent(p);
    return p;
  };

  const prompt = async (kind: PromptKind) => {
    const text = buildPrompt(kind, { text: phrase.text, highlights: highlightsOf(phrase) });
    await platform.openAIs(text);
    toast('Prompt copiado e aberto nas IAs. Depois toque em “Colar resposta”.', 'success');
  };

  const paste = async () => {
    const t = await platform.readClipboard();
    if (!t.trim()) return toast('A área de transferência está vazia', 'error');
    const html = markdownToHtml(t);
    const cur = backRef.current?.getHTML() ?? '';
    backRef.current?.setHTML(cur + html);
    setBack(cur + html);
    toast('Resposta colada no verso', 'success');
  };

  const audio = () =>
    run('audio', async () => {
      let p = current;
      if (!audioIsFresh(p, shared.elevenVoiceId)) {
        p = await generateAudio(p);
        setCurrent(p);
      }
      await playPhrase(p);
    });

  const createDeck = () =>
    run('create', async () => {
      const name = newDeck.trim();
      if (!name) return;
      await platform.anki.createDeck(name);
      setNewDeck('');
      setDeck(name);
      setDecks((d) => [...(d ?? []), { id: name, name }].sort((a, b) => a.name.localeCompare(b.name)));
      toast(`Baralho “${name}” criado`, 'success');
    });

  const send = () =>
    run('send', async () => {
      const p = await saveBack();
      const blob = await audioBlob(p);
      await platform.anki.addNote({
        deck,
        front: p.html,
        back: p.back,
        audio: blob ? { filename: `ingles-${p.id.slice(0, 8)}.mp3`, base64: await blobToBase64(blob) } : null,
        tags: ['ingles'],
      });
      await updatePhrase(p, { anki: { deck, sentAt: Date.now() } });
      if (deck !== shared.ankiDeck) void setShared({ ankiDeck: deck });
      toast(`Card enviado para “${deck}” ${blob ? 'com áudio 🎧' : ''}`, 'success');
      onClose();
    });

  return (
    <Modal
      wide
      title="Flashcard"
      icon="layers"
      accent="var(--g-settings)"
      onClose={onClose}
      footer={
        <>
          <button
            className="btn"
            onClick={async () => {
              await saveBack();
              toast('Verso salvo', 'success');
              onClose();
            }}
          >
            Salvar verso
          </button>
          <button className="btn primary" onClick={send} disabled={!!busy || !decks?.length}>
            {busy === 'send' ? <Spinner /> : <Icon name="send" size={16} />} Enviar para o Anki
          </button>
        </>
      }
    >
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="col">
          <div className={`flip ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)} style={{ cursor: 'pointer' }}>
            <div className="flip-inner">
              <div className="flip-face flip-front">
                <span className="face-label">Frente</span>
                <RichPhrase html={phrase.html} copyable={false} />
              </div>
              <div className="flip-face flip-back">
                <span className="face-label">Verso</span>
                {back ? <div dangerouslySetInnerHTML={{ __html: back }} style={{ textAlign: 'left', width: '100%' }} /> : <span className="muted">Verso vazio (opcional)</span>}
              </div>
            </div>
          </div>
          <div className="row between">
            <button className="btn sm ghost" onClick={() => setFlipped(!flipped)}>
              <Icon name="flip" size={15} /> Virar card
            </button>
            <button className="btn sm" onClick={audio} disabled={busy === 'audio'}>
              {busy === 'audio' ? <Spinner /> : <Icon name="volume" size={15} />}
              {audioIsFresh(current, shared.elevenVoiceId) ? 'Ouvir áudio' : 'Gerar áudio da frente'}
            </button>
          </div>

          <div className="label mt">Prompts automáticos {hasHl && <span className="pill t">ênfase no destaque</span>}</div>
          <PromptButton kind="translate" onClick={() => prompt('translate')} />
          <PromptButton kind="define" onClick={() => prompt('define')} />
        </div>

        <div className="col">
          <div className="row between">
            <div className="label">Verso (opcional)</div>
            <button className="btn sm" onClick={paste}>
              <Icon name="clipboard" size={15} /> Colar resposta
            </button>
          </div>
          <RichEditor ref={backRef} value={back} onChange={setBack} variant="compact" placeholder="Tradução em PT-BR ou definição em inglês…" />
          <div className="card pad-sm" style={{ background: 'var(--surface-2)' }}>
            <div className="row between">
              <div className="label">
                <Icon name="layers" size={14} /> {platform.anki.describe()}
              </div>
              <button className="icon-btn sm" onClick={loadDecks} title="Recarregar baralhos">
                {busy === 'decks' ? <Spinner /> : <Icon name="refresh" size={15} />}
              </button>
            </div>
            {decks && decks.length > 0 ? (
              <>
                <select className="select mt" value={deck} onChange={(e) => setDeck(e.target.value)}>
                  {decks.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <div className="row mt">
                  <input className="input" placeholder="Criar novo baralho…" value={newDeck} onChange={(e) => setNewDeck(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createDeck()} />
                  <button className="btn" onClick={createDeck} disabled={!newDeck.trim()}>
                    <Icon name="plus" size={16} />
                  </button>
                </div>
              </>
            ) : (
              <p className="small muted" style={{ margin: '8px 0 0' }}>
                {decks === null ? 'Conectando…' : ankiMsg || 'Anki indisponível'}
                {platform.kind !== 'android' && decks !== null && (
                  <>
                    <br />
                    Abra o Anki no computador com o add-on <b>AnkiConnect</b> (código 2055492159).
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function PromptButton({ kind, onClick }: { kind: PromptKind; onClick: () => void }) {
  const t = kind === 'translate';
  return (
    <button className="ai-btn" onClick={onClick}>
      <span className="ai-ico" style={{ background: t ? 'var(--g-phrases)' : 'var(--g-editor)' }}>
        <Icon name={t ? 'languages' : 'book'} size={19} />
      </span>
      <span>
        <b>{t ? 'Tradução PT-BR' : 'Definição em inglês'}</b>
        <span>{t ? 'Com a estrutura do inglês' : '15 exemplos de uso'}</span>
      </span>
      <span className="ai-logos">
        <i style={{ background: 'linear-gradient(135deg,#4F8BF9,#B46CF0)' }}>G</i>
        <i style={{ background: '#10A37F' }}>C</i>
        <i style={{ background: '#D97757' } as CSSProperties}>A</i>
      </span>
    </button>
  );
}
