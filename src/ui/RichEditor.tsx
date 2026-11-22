// Editor de texto rico da tríade (TipTap): negrito, itálico, sublinhado (com cor própria),
// cor da fonte por trecho e setas de explicação sob termos.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import { Mark, mergeAttributes } from '@tiptap/core';
import { TEXT_COLORS } from '../core/defaults';
import { Icon } from './Icon';
import { Modal } from './kit';

const ColorUnderline = Underline.extend({
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-underline-color') || el.style.textDecorationColor || null,
        renderHTML: (attrs: { color?: string | null }) => (attrs.color ? { 'data-underline-color': attrs.color, style: `text-decoration-color: ${attrs.color}` } : {}),
      },
    };
  },
});

export const Term = Mark.create({
  name: 'term',
  inclusive: false,
  excludes: '',
  addAttributes() {
    return {
      note: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-note') ?? '',
        renderHTML: (a: { note?: string }) => ({ 'data-note': a.note ?? '' }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-note]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ class: 'term' }, HTMLAttributes), 0];
  },
});

export interface RichEditorHandle {
  editor: Editor | null;
  getHTML(): string;
  setHTML(html: string): void;
  selectionHTML(): string;
  selectionText(): string;
  clear(): void;
  focus(): void;
}

interface Props {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  variant?: 'default' | 'compact' | 'draft';
  right?: ReactNode;
  autofocus?: boolean;
  onSubmit?: () => void;
}

export const RichEditor = forwardRef<RichEditorHandle, Props>(function RichEditor({ value = '', onChange, placeholder = 'Escreva ou cole uma frase em inglês…', variant = 'default', right, autofocus, onSubmit }, ref) {
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, blockquote: false, horizontalRule: false, code: false, bulletList: false, orderedList: false, listItem: false }),
      ColorUnderline,
      TextStyle,
      Color,
      Term,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    autofocus: autofocus ? 'end' : false,
    onUpdate: ({ editor }) => onChange?.(editor.isEmpty ? '' : editor.getHTML()),
    editorProps: {
      handleKeyDown: (_v, e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && submitRef.current) {
          submitRef.current();
          return true;
        }
        return false;
      },
    },
  });

  // valor externo mudou (ex.: sincronização do rascunho)
  useEffect(() => {
    if (!editor) return;
    const cur = editor.isEmpty ? '' : editor.getHTML();
    if (value !== cur && !editor.isFocused) editor.commands.setContent(value || '', false);
  }, [value, editor]);

  useImperativeHandle(
    ref,
    () => ({
      editor,
      getHTML: () => (editor && !editor.isEmpty ? editor.getHTML() : ''),
      setHTML: (h) => editor?.commands.setContent(h, true),
      selectionHTML: () => {
        if (!editor) return '';
        const { from, to } = editor.state.selection;
        if (from === to) return '';
        const slice = editor.state.doc.slice(from, to);
        const div = document.createElement('div');
        const { DOMSerializer } = require_pm();
        div.appendChild(DOMSerializer.fromSchema(editor.schema).serializeFragment(slice.content));
        return div.innerHTML;
      },
      selectionText: () => {
        if (!editor) return '';
        const { from, to } = editor.state.selection;
        return editor.state.doc.textBetween(from, to, '\n');
      },
      clear: () => editor?.commands.clearContent(true),
      focus: () => editor?.commands.focus('end'),
    }),
    [editor],
  );

  return (
    <div className={`editor-shell ${variant}`}>
      {editor && <Toolbar editor={editor} right={right} />}
      <EditorContent editor={editor} />
    </div>
  );
});

// Import síncrono do prosemirror-model (já carregado pelo TipTap).
import * as pmModel from '@tiptap/pm/model';
function require_pm() {
  return pmModel;
}

function Toolbar({ editor, right }: { editor: Editor; right?: ReactNode }) {
  const [, force] = useState(0);
  const [pop, setPop] = useState<'color' | 'uline' | null>(null);
  const [termOpen, setTermOpen] = useState(false);
  useEffect(() => {
    const h = () => force((n) => n + 1);
    editor.on('transaction', h);
    return () => {
      editor.off('transaction', h);
    };
  }, [editor]);
  useEffect(() => {
    if (!pop) return;
    const close = (e: MouseEvent) => !(e.target as HTMLElement).closest('.tool-wrap') && setPop(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [pop]);

  const textColor = (editor.getAttributes('textStyle').color as string) || '';
  const ulColor = (editor.getAttributes('underline').color as string) || '';
  const inTerm = editor.isActive('term');
  const hasSel = !editor.state.selection.empty;

  const btn = (name: Parameters<typeof Icon>[0]['name'], on: boolean, run: () => void, title: string) => (
    <button type="button" className={`tool ${on ? 'on' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={run} title={title}>
      <Icon name={name} size={17} stroke={2.4} />
    </button>
  );

  return (
    <div className="editor-toolbar">
      {btn('bold', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Negrito (Ctrl+B)')}
      {btn('italic', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Itálico (Ctrl+I)')}
      {btn('underline', editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'Sublinhado (Ctrl+U)')}
      <span className="tsep" />
      <div className="tool-wrap" style={{ position: 'relative' }}>
        <button type="button" className="tool" title="Cor da fonte" onMouseDown={(e) => e.preventDefault()} onClick={() => setPop(pop === 'color' ? null : 'color')}>
          <Icon name="type" size={17} stroke={2.4} />
          <Icon name="chevronDown" size={12} />
          <i className="swatch-bar" style={{ background: textColor || 'var(--phrase-color)' }} />
        </button>
        {pop === 'color' && (
          <ColorPop
            title="Cor da fonte do trecho"
            value={textColor}
            onPick={(c) => {
              if (c) editor.chain().focus().setColor(c).run();
              else editor.chain().focus().unsetColor().run();
              setPop(null);
            }}
          />
        )}
      </div>
      <div className="tool-wrap" style={{ position: 'relative' }}>
        <button type="button" className="tool" title="Cor do sublinhado" onMouseDown={(e) => e.preventDefault()} onClick={() => setPop(pop === 'uline' ? null : 'uline')}>
          <Icon name="underline" size={17} stroke={2.4} />
          <Icon name="chevronDown" size={12} />
          <i className="swatch-bar" style={{ background: ulColor || 'var(--text-3)' }} />
        </button>
        {pop === 'uline' && (
          <ColorPop
            title="Cor do sublinhado"
            value={ulColor}
            onPick={(c) => {
              editor.chain().focus().setMark('underline', { color: c || null }).run();
              setPop(null);
            }}
          />
        )}
      </div>
      <span className="tsep" />
      <button
        type="button"
        className={`tool ${inTerm ? 'on' : ''}`}
        title="Seta com explicação do termo selecionado"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (!hasSel && !inTerm) {
            window.dispatchEvent(new CustomEvent('ingles:toast', { detail: 'Selecione o trecho que vai ganhar a seta' }));
            return;
          }
          setTermOpen(true);
        }}
      >
        <Icon name="arrowDown" size={17} stroke={2.6} />
        <span className="hide-sm">Seta</span>
      </button>
      {btn('eraser', false, () => editor.chain().focus().unsetAllMarks().run(), 'Limpar formatação do trecho')}
      <span className="tsep" />
      {btn('undo', false, () => editor.chain().focus().undo().run(), 'Desfazer')}
      {btn('redo', false, () => editor.chain().focus().redo().run(), 'Refazer')}
      {right && <div style={{ marginLeft: 'auto' }} className="row">{right}</div>}
      {termOpen && <TermDialog editor={editor} onClose={() => setTermOpen(false)} />}
    </div>
  );
}

function ColorPop({ title, value, onPick }: { title: string; value: string; onPick: (c: string) => void }) {
  return (
    <div className="popover" onMouseDown={(e) => e.preventDefault()}>
      <div className="tiny muted" style={{ fontWeight: 800, marginBottom: 6 }}>{title}</div>
      <div className="palette">
        {TEXT_COLORS.map((c) => (
          <button key={c} type="button" className={value.toLowerCase() === c.toLowerCase() ? 'on' : ''} style={{ background: c }} onClick={() => onPick(c)} title={c} />
        ))}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" className="btn sm" onClick={() => onPick('')}>
          Padrão
        </button>
        <label className="btn sm" style={{ position: 'relative', overflow: 'hidden' }}>
          <Icon name="palette" size={14} /> Outra
          <input type="color" defaultValue={value || '#14d2c8'} onChange={(e) => onPick(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
        </label>
      </div>
    </div>
  );
}

function TermDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const existing = editor.isActive('term') ? ((editor.getAttributes('term').note as string) ?? '') : '';
  const [note, setNote] = useState(existing);
  const term = editor.isActive('term') && editor.state.selection.empty ? '' : editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ');
  const save = () => {
    const chain = editor.chain().focus();
    if (editor.isActive('term') && editor.state.selection.empty) chain.extendMarkRange('term');
    chain.setMark('term', { note: note.trim() }).run();
    onClose();
  };
  return (
    <Modal
      title="Seta de explicação"
      icon="arrowDown"
      accent="var(--g-phrases)"
      onClose={onClose}
      footer={
        <>
          {existing !== '' || editor.isActive('term') ? (
            <button
              className="btn ghost"
              onClick={() => {
                editor.chain().focus().extendMarkRange('term').unsetMark('term').run();
                onClose();
              }}
            >
              <Icon name="trash" size={16} /> Remover seta
            </button>
          ) : null}
          <button className="btn primary" onClick={save}>
            <Icon name="check" size={16} /> Salvar seta
          </button>
        </>
      }
    >
      <div className="col">
        {term && (
          <div className="phrase" style={{ fontSize: 22 }}>
            <span className="term">{term}</span>
          </div>
        )}
        <div className="field">
          <label>Explicação (opcional)</label>
          <textarea className="textarea" autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: phrasal verb — “desistir”. Usado quando…" />
          <span className="hint">Aparece ao tocar na seta embaixo do termo. O ElevenLabs ignora este texto.</span>
        </div>
      </div>
    </Modal>
  );
}
