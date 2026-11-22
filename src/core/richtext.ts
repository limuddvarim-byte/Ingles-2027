// Utilidades para o HTML rico das frases (vindo do editor TipTap).

const ALLOWED_TAGS = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'SPAN', 'MARK']);
const FORMAT_TAGS = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'S', 'MARK']);
const ALLOWED_STYLE = /^(color|text-decoration-color|text-decoration-line|text-decoration)$/i;
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|[a-z]+)$/i;

function parse(html: string): HTMLElement {
  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html');
  return doc.getElementById('r') as HTMLElement;
}

function cleanStyle(style: string): string {
  return style
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((decl) => {
      const i = decl.indexOf(':');
      if (i < 0) return '';
      const prop = decl.slice(0, i).trim().toLowerCase();
      const value = decl.slice(i + 1).trim();
      if (!ALLOWED_STYLE.test(prop)) return '';
      if (prop.includes('color') && !SAFE_COLOR.test(value)) return '';
      if (/url\(|expression|javascript:/i.test(value)) return '';
      return `${prop}: ${value}`;
    })
    .filter(Boolean)
    .join('; ');
}

function sanitizeNode(node: Node, doc: Document): Node | DocumentFragment | null {
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent ?? '');
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as HTMLElement;
  let tag = el.tagName;
  if (tag === 'DIV' || /^H[1-6]$/.test(tag) || tag === 'LI') tag = 'P';
  const children = Array.from(el.childNodes)
    .map((c) => sanitizeNode(c, doc))
    .filter(Boolean) as Node[];
  if (!ALLOWED_TAGS.has(tag)) {
    const frag = doc.createDocumentFragment();
    children.forEach((c) => frag.appendChild(c));
    return frag;
  }
  const out = doc.createElement(tag);
  const style = el.getAttribute('style');
  if (style) {
    const s = cleanStyle(style);
    if (s) out.setAttribute('style', s);
  }
  const note = el.getAttribute('data-note');
  if (note !== null && tag === 'SPAN') {
    out.setAttribute('data-note', note);
    out.setAttribute('class', 'term');
  }
  const uc = el.getAttribute('data-underline-color');
  if (uc && SAFE_COLOR.test(uc)) out.setAttribute('data-underline-color', uc);
  children.forEach((c) => out.appendChild(c));
  return out;
}

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  const root = parse(html);
  const doc = root.ownerDocument;
  const wrap = doc.createElement('div');
  Array.from(root.childNodes).forEach((n) => {
    const s = sanitizeNode(n, doc);
    if (s) wrap.appendChild(s);
  });
  return wrap.innerHTML;
}

/** Texto puro (o que é lido pelo ElevenLabs). Explicações das setas NÃO entram. */
export function htmlToText(html: string): string {
  if (!html) return '';
  const root = parse(html);
  const parts: string[] = [];
  const walk = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) parts.push(n.textContent ?? '');
    else if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as HTMLElement;
      if (el.tagName === 'BR') parts.push('\n');
      el.childNodes.forEach(walk);
      if (el.tagName === 'P') parts.push('\n');
    }
  };
  root.childNodes.forEach(walk);
  return parts
    .join('')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function isFormatted(el: HTMLElement): boolean {
  if (FORMAT_TAGS.has(el.tagName)) return true;
  if (el.tagName === 'SPAN') {
    if (el.hasAttribute('data-note')) return true;
    const st = el.getAttribute('style') ?? '';
    if (/(^|;)\s*color\s*:/i.test(st)) return true;
  }
  return false;
}

/** Trechos destacados (negrito/itálico/sublinhado/cor/termo), na ordem em que aparecem. */
export function extractHighlights(html: string): string[] {
  if (!html) return [];
  const root = parse(html);
  const segments: string[] = [];
  let current = '';
  const flush = () => {
    const t = current.replace(/\s+/g, ' ').trim();
    if (t) segments.push(t);
    current = '';
  };
  const walk = (n: Node, formatted: boolean) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = n.textContent ?? '';
      if (formatted) current += t;
      else if (t.trim()) flush();
      else current += t; // espaço entre dois trechos formatados mantém a junção
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as HTMLElement;
    if (el.tagName === 'P' || el.tagName === 'BR') flush();
    const f = formatted || isFormatted(el);
    el.childNodes.forEach((c) => walk(c, f));
    if (el.tagName === 'P') flush();
  };
  root.childNodes.forEach((c) => walk(c, false));
  flush();
  return [...new Set(segments)];
}

/** Termos com seta (explicações). */
export function extractNotes(html: string): { term: string; note: string }[] {
  if (!html) return [];
  const root = parse(html);
  return Array.from(root.querySelectorAll('span[data-note]')).map((el) => ({
    term: (el.textContent ?? '').trim(),
    note: el.getAttribute('data-note') ?? '',
  }));
}

export function textToHtml(text: string): string {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${escapeHtml(l)}</p>`)
    .join('');
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Hash FNV-1a (32 bits) — identifica se o texto do áudio mudou. */
export function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Divide um texto em frases (para "cada frase vira um card"). */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\r/g, '')
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z"“'‘(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}
