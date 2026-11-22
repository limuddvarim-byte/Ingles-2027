import { describe, expect, it } from 'vitest';
import { extractHighlights, extractNotes, hashText, htmlToText, sanitizeHtml, splitSentences, textToHtml } from '../src/core/richtext';

describe('richtext', () => {
  const html = '<p>I <strong>could use</strong> a <span style="color: #ff0000">cup</span> of <span data-note="expressão: tomar um café" class="term">coffee</span> now</p>';
  it('texto puro não inclui explicações das setas', () => {
    expect(htmlToText(html)).toBe('I could use a cup of coffee now');
  });
  it('extrai trechos formatados em ordem', () => {
    expect(extractHighlights(html)).toEqual(['could use', 'cup', 'coffee']);
  });
  it('junta trechos formatados adjacentes', () => {
    expect(extractHighlights('<p><b>give</b> <i>up</i> later</p>')).toEqual(['give up']);
  });
  it('sem formatação não há destaques', () => {
    expect(extractHighlights('<p>plain text</p>')).toEqual([]);
  });
  it('extrai notas', () => {
    expect(extractNotes(html)).toEqual([{ term: 'coffee', note: 'expressão: tomar um café' }]);
  });
  it('sanitiza scripts, atributos e estilos perigosos', () => {
    const dirty = '<p onclick="x()">Hi <script>alert(1)</script><img src=x onerror=y><span style="color: red; background: url(evil)">r</span><a href="javascript:1">l</a></p>';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toMatch(/script|onclick|onerror|img|url\(|href/);
    expect(clean).toContain('<span style="color: red">r</span>');
    expect(clean).toContain('l');
  });
  it('mantém sublinhado colorido e termos', () => {
    const c = sanitizeHtml('<u style="text-decoration-color: #14D2C8" data-underline-color="#14D2C8">x</u><span data-note="n">t</span>');
    expect(c).toContain('text-decoration-color: #14D2C8');
    expect(c).toContain('data-note="n"');
    expect(c).toContain('class="term"');
  });
  it('várias linhas', () => {
    expect(htmlToText('<p>a</p><p>b<br>c</p>')).toBe('a\nb\nc');
    expect(textToHtml('a\n\nb <x>')).toBe('<p>a</p><p>b &lt;x&gt;</p>');
  });
  it('hash estável', () => {
    expect(hashText('abc')).toBe(hashText('abc'));
    expect(hashText('abc')).not.toBe(hashText('abd'));
  });
  it('divide frases', () => {
    expect(splitSentences('Hello there. How are you?\nFine!')).toEqual(['Hello there.', 'How are you?', 'Fine!']);
  });
});
