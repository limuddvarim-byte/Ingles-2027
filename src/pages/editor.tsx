// Editor de texto da tríade: compositor de frases + rascunho sincronizado (recebe o texto do OCR).
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { put } from '../core/db';
import { htmlToText, splitSentences, textToHtml } from '../core/richtext';
import { platform } from '../platform';
import { addPhrase, addPlainPhrases } from '../services/phrases';
import { useStore } from '../state/store';
import { Icon } from '../ui/Icon';
import { Modal, PageHead, Spinner, useAsync } from '../ui/kit';
import { RichEditor, type RichEditorHandle } from '../ui/RichEditor';

export function EditorPage() {
  const seed = useStore((s) => s.editorSeed);
  const draft = useStore((s) => s.draft);
  const toast = useStore((s) => s.toast);
  const front = useRef<RichEditorHandle>(null);
  const backRef = useRef<RichEditorHandle>(null);
  const draftRef = useRef<RichEditorHandle>(null);
  const [frontHtml, setFrontHtml] = useState(seed?.html ?? '');
  const [withBack, setWithBack] = useState(false);
  const [split, setSplit] = useState<string[] | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { busy, run } = useAsync();

  useEffect(() => {
    if (seed?.html) front.current?.setHTML(seed.html);
  }, [seed?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async () => {
    const p = await addPhrase(front.current?.getHTML() ?? '', withBack ? backRef.current?.getHTML() ?? '' : '');
    if (!p) return toast('Escreva uma frase primeiro', 'error');
    front.current?.clear();
    backRef.current?.clear();
    toast('Frase adicionada à lista ✨', 'success');
  };

  const saveDraft = (html: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void put('draft', { id: 'main', html, updatedAt: Date.now() }), 700);
  };

  const appendToDraft = (html: string) => {
    const cur = draftRef.current?.getHTML() ?? '';
    const next = cur + html;
    draftRef.current?.setHTML(next);
    void put('draft', { id: 'main', html: next, updatedAt: Date.now() });
  };

  const addSelection = async () => {
    const html = draftRef.current?.selectionHTML() ?? '';
    if (!html.trim()) return toast('Selecione um trecho do rascunho', 'error');
    const p = await addPhrase(html);
    if (p) toast('Trecho adicionado às frases', 'success');
  };

  const sendSelectionToComposer = () => {
    const html = draftRef.current?.selectionHTML() ?? '';
    if (!html.trim()) return toast('Selecione um trecho do rascunho', 'error');
    front.current?.setHTML(html);
    front.current?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const ocr = (source: 'camera' | 'gallery') =>
    run(source, async () => {
      const text = await platform.ocr!(source);
      if (!text.trim()) return toast('Nenhum texto encontrado na imagem', 'error');
      appendToDraft(textToHtml(text));
      toast('Texto extraído e enviado ao rascunho 📸', 'success');
    });

  return (
    <div className="page" style={{ '--accent': 'var(--g-editor)', '--accent-glow': 'rgba(236,72,153,.55)' } as CSSProperties}>
      <PageHead eyebrow="Editor" icon="pen" title={<span>Crie frases <span className="grad-text">do seu jeito</span></span>} sub="Negrito, itálico, sublinhado colorido, cor por palavra e setas com explicação." />

      <div className="card glow-border">
        <div className="card-title">
          <span className="chip-ico">
            <Icon name="plus" size={16} stroke={2.6} />
          </span>
          Nova frase
          <span className="right row">
            <label className="row small" style={{ gap: 8, fontWeight: 700, cursor: 'pointer' }}>
              <input type="checkbox" checked={withBack} onChange={(e) => setWithBack(e.target.checked)} /> Adicionar verso
            </label>
          </span>
        </div>
        <RichEditor ref={front} value={frontHtml} onChange={setFrontHtml} onSubmit={add} />
        {withBack && (
          <div className="mt">
            <div className="label" style={{ marginBottom: 6 }}>
              Verso (tradução PT-BR ou definição em inglês)
            </div>
            <RichEditor ref={backRef} variant="compact" placeholder="Opcional — use os prompts no flashcard para gerar com IA" />
          </div>
        )}
        <div className="row between mt wrap">
          <span className="hint">
            Selecione um trecho e use <b>Seta</b> para explicar um termo. <span className="kbd">Ctrl</span>+<span className="kbd">Enter</span> adiciona.
          </span>
          <button className="btn primary lg" onClick={add} disabled={!frontHtml}>
            <Icon name="check" size={18} stroke={2.6} /> Adicionar às frases
          </button>
        </div>
      </div>

      <div className="card mt-lg" style={{ '--accent': 'var(--g-phrases)' } as CSSProperties}>
        <div className="card-title">
          <span className="chip-ico">
            <Icon name="cloud" size={16} />
          </span>
          Rascunho
          <span className="pill t">sincronizado na tríade</span>
          <span className="right row wrap">
            {platform.features.ocr && (
              <>
                <button className="btn sm primary" onClick={() => ocr('camera')} disabled={!!busy}>
                  {busy === 'camera' ? <Spinner /> : <Icon name="camera" size={15} />} Câmera
                </button>
                <button className="btn sm primary" onClick={() => ocr('gallery')} disabled={!!busy}>
                  {busy === 'gallery' ? <Spinner /> : <Icon name="image" size={15} />} Galeria
                </button>
              </>
            )}
          </span>
        </div>
        {platform.features.ocr && (
          <p className="hint" style={{ margin: '-4px 0 12px' }}>
            <Icon name="scan" size={13} /> Leia texto de prints e fotos (Google ML Kit, no aparelho). O texto cai aqui e aparece no PC e na extensão.
          </p>
        )}
        <RichEditor
          ref={draftRef}
          variant="draft"
          value={draft?.html ?? ''}
          onChange={saveDraft}
          placeholder="Cole textos, legendas, letras de música… depois selecione trechos para virar frases."
          right={
            <>
              <button className="btn sm" onMouseDown={(e) => e.preventDefault()} onClick={sendSelectionToComposer} title="Levar seleção para Nova frase">
                <Icon name="arrowDown" size={15} style={{ transform: 'rotate(180deg)' }} /> Editar
              </button>
              <button className="btn sm primary" onMouseDown={(e) => e.preventDefault()} onClick={addSelection}>
                <Icon name="plus" size={15} /> Seleção
              </button>
            </>
          }
        />
        <div className="row between mt wrap">
          <span className="hint">Dica: selecione e toque em “+ Seleção” para manter a formatação.</span>
          <div className="row">
            <button
              className="btn sm"
              onClick={() => {
                const s = splitSentences(htmlToText(draftRef.current?.getHTML() ?? ''));
                if (!s.length) return toast('O rascunho está vazio', 'error');
                setSplit(s);
              }}
            >
              <Icon name="list" size={15} /> Separar em frases
            </button>
            <button
              className="btn sm ghost"
              onClick={() => {
                draftRef.current?.clear();
                void put('draft', { id: 'main', html: '', updatedAt: Date.now() });
              }}
            >
              <Icon name="trash" size={15} /> Limpar
            </button>
          </div>
        </div>
      </div>
      {split && <SplitModal sentences={split} onClose={() => setSplit(null)} />}
    </div>
  );
}

function SplitModal({ sentences, onClose }: { sentences: string[]; onClose: () => void }) {
  const [sel, setSel] = useState<Set<number>>(new Set());
  const toast = useStore((s) => s.toast);
  const add = async () => {
    const n = await addPlainPhrases(sentences.filter((_, i) => sel.has(i)));
    toast(`${n} frase${n === 1 ? '' : 's'} adicionada${n === 1 ? '' : 's'}`, 'success');
    onClose();
  };
  return (
    <Modal
      title="Escolha as frases"
      icon="list"
      accent="var(--g-phrases)"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={() => setSel(sel.size === sentences.length ? new Set() : new Set(sentences.map((_, i) => i)))}>
            {sel.size === sentences.length ? 'Desmarcar todas' : 'Marcar todas'}
          </button>
          <button className="btn primary" disabled={!sel.size} onClick={add}>
            <Icon name="plus" size={16} /> Adicionar {sel.size || ''}
          </button>
        </>
      }
    >
      <div className="col" style={{ gap: 8 }}>
        {sentences.map((s, i) => (
          <label key={i} className="card pad-sm row" style={{ cursor: 'pointer', borderColor: sel.has(i) ? 'var(--turquoise)' : undefined, alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              checked={sel.has(i)}
              onChange={() => {
                const n = new Set(sel);
                if (n.has(i)) n.delete(i);
                else n.add(i);
                setSel(n);
              }}
              style={{ marginTop: 5 }}
            />
            <span className="phrase" style={{ fontSize: 17 }}>
              {s}
            </span>
          </label>
        ))}
      </div>
    </Modal>
  );
}
