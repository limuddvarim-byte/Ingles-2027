// Prompts automáticos para as IAs (Gemini, ChatGPT e Claude).
// Os textos-base são exatamente os definidos pelo usuário.

export type PromptKind = 'translate' | 'define';

export interface PromptInput {
  /** Frase inteira em texto puro. */
  text: string;
  /** Trechos destacados/formatados (negrito, itálico, sublinhado, cor ou termo). */
  highlights: string[];
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

export function buildPrompt(kind: PromptKind, input: PromptInput): string {
  const text = clean(input.text);
  const highlights = input.highlights.map(clean).filter(Boolean);
  const hasFormat = highlights.length > 0;
  const quoted = highlights.map((h) => `"${h}"`).join(', ');

  if (kind === 'translate') {
    if (!hasFormat) {
      return `Qual tradução daria para fazer com "${text}" na lingua portuguesa (do Brasil) para se parecer com a estrutura do inglês, mas mesmo assim fazendo o mesmo sentido em português`;
    }
    return [
      `Frase inteira: "${emphasize(text, highlights)}"`,
      `Parte destacada: ${quoted}`,
      '',
      'Traduza somente a parte destacada que te dei na frase inteira, não traduza o restante apenas dê uma tradução da parte destacada e uma explicação de como pode ser usado, seu sentido e como essa estrutura da qual não sei o que é nos países de quem fala inglês é conhecida',
    ].join('\n');
  }

  if (!hasFormat) {
    return `What does "${text}" mean? Give me an explanation that doesn't make it even harder to understand, isn't long or exhausting to read, and is still clear, objective, and complete and with 15 examples of usage each.`;
  }
  return [
    `Sentence: "${emphasize(text, highlights)}"`,
    '',
    `What does ${quoted} mean in this sentence? What did the narrator mean by it? Give me an explanation that doesn't make it even harder to understand, isn't long or exhausting to read, and is still clear, objective, and complete.`,
  ].join('\n');
}

/** Marca os trechos destacados com **asteriscos** dentro da frase inteira (ênfase para a IA). */
export function emphasize(text: string, highlights: string[]): string {
  let out = text;
  let cursor = 0;
  for (const h of highlights) {
    if (!h) continue;
    const idx = out.indexOf(h, cursor);
    if (idx === -1) continue;
    out = `${out.slice(0, idx)}**${h}**${out.slice(idx + h.length)}`;
    cursor = idx + h.length + 4;
  }
  return out;
}

export interface AiTarget {
  id: 'gemini' | 'chatgpt' | 'claude';
  name: string;
  colors: [string, string];
  url: (prompt: string) => string;
}

export const AI_TARGETS: AiTarget[] = [
  {
    id: 'gemini',
    name: 'Gemini',
    colors: ['#4F8BF9', '#A86CF0'],
    // O Gemini não aceita ?q= oficialmente: a extensão "Inglês" preenche o campo
    // automaticamente a partir do hash; sem ela, o prompt já está copiado.
    url: (p) => `https://gemini.google.com/app#ingles-prompt=${encodeURIComponent(p)}`,
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    colors: ['#10A37F', '#0B7A5F'],
    url: (p) => `https://chatgpt.com/?q=${encodeURIComponent(p)}`,
  },
  {
    id: 'claude',
    name: 'Claude',
    colors: ['#D97757', '#B95A3C'],
    url: (p) => `https://claude.ai/new?q=${encodeURIComponent(p)}`,
  },
];
