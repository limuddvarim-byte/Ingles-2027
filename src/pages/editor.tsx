// Rascunho sincronizado da tríade (recebe o texto do OCR do Android).
import { useEffect, useRef, useState } from 'react';
import { put } from '../core/db';
import { htmlToText, splitSentences, textToHtml } from '../core/richtext';
import { platform } from '../platform';
import { addPhrase, addPlainPhrases } from '../services/phrases';
import { useStore } from '../state/store';
import { Icon } from '../ui/Icon';
import { Modal, PageHead, Spinner, useAsync } from '../ui/kit';
import { RichEditor, type RichEditorHandle } from '../ui/RichEditor';

export function DraftPage() {
  const draft = useStore((s) => s.draft);
  const toast = useStore((s) => s.toast);
  const go = useStore((s) => s.go);
  const seedEditor = useStore((s) => s.seedEditor);
  const draftRef = useRef<RichEditorHandle>(null);
  const [split, setSplit] = useState<string[] | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { busy, run } = useAsync();

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

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

  const editSelection = () => {
    const html = draftRef.current?.selectionHTML() ?? '';
    if (!html.trim()) return toast('Selecione um trecho do rascunho', 'error');
    seedEditor(html);
  };

  const ocr = (source: 'camera' | 'gallery') =>
    run(source, async () => {
      const text = await platform.ocr!(source);
      if (!text.trim()) return toast('Nenhum texto encontrado na imagem', 'error');
      appendToDraft(textToHtml(text));
      toast('Texto extraído para o rascunho', 'success');
    });

  return (
    <div className="page">
      <button className="btn ghost sm back" onClick={() => go('phrases')}>
        <Icon name="chevronLeft" size={16} /> Frases
      </button>
      <PageHead
        icon="pen"
        title="Rascunho"
        sub={platform.features.ocr ? 'Cole textos ou leia fotos e prints. Selecione um trecho para virar frase.' : 'Cole textos, legendas e letras. Selecione um trecho para virar frase. Sincroniza com o celular (OCR).'}
        right={
          platform.features.ocr ? (
            <>
              <button className="btn" onClick={() => ocr('camera')} disabled={!!busy}>
                {busy === 'camera' ? <Spinner /> : <Icon name="camera" size={16} />} Câmera
              </button>
              <button className="btn" onClick={() => ocr('gallery')} disabled={!!busy}>
                {busy === 'gallery' ? <Spinner /> : <Icon name="image" size={16} />} Galeria
              </button>
            </>
          ) : undefined
        }
      />

      <div className="card draft-card">
        <RichEditor
          ref={draftRef}
          variant="draft"
          value={draft?.html ?? ''}
          onChange={saveDraft}
          placeholder="Cole aqui um texto, legenda ou letra de música…"
          right={
            <>
              <button className="btn sm" onMouseDown={(e) => e.preventDefault()} onClick={editSelection} title="Abrir a seleção no editor de frase">
                <Icon name="pen" size={15} /> Editar
              </button>
              <button className="btn sm primary" onMouseDown={(e) => e.preventDefault()} onClick={addSelection}>
                <Icon name="plus" size={15} /> Seleção
              </button>
            </>
          }
        />
      </div>
      <div className="row between mt wrap">
        <span className="hint">Selecione e toque em “+ Seleção” para manter a formatação.</span>
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
      side
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
          <label key={i} className="card pad-sm row" style={{ cursor: 'pointer', borderColor: sel.has(i) ? 'var(--a)' : undefined, alignItems: 'flex-start' }}>
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
