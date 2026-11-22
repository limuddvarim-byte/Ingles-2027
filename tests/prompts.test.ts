import { describe, expect, it } from 'vitest';
import { AI_TARGETS, buildPrompt, emphasize } from '../src/core/prompts';

describe('prompts', () => {
  it('tradução sem formatação usa o texto exato do usuário', () => {
    const p = buildPrompt('translate', { text: '  I could use a coffee ', highlights: [] });
    expect(p).toBe('Qual tradução daria para fazer com "I could use a coffee" na lingua portuguesa (do Brasil) para se parecer com a estrutura do inglês, mas mesmo assim fazendo o mesmo sentido em português');
  });
  it('tradução com destaque envia a frase inteira com ênfase', () => {
    const p = buildPrompt('translate', { text: 'She is on the fence about it', highlights: ['on the fence'] });
    expect(p).toContain('Frase inteira: "She is **on the fence** about it"');
    expect(p).toContain('Parte destacada: "on the fence"');
    expect(p).toContain('Traduza somente a parte destacada');
  });
  it('definição sem formatação pede 15 exemplos', () => {
    const p = buildPrompt('define', { text: 'break a leg', highlights: [] });
    expect(p.startsWith('What does "break a leg" mean?')).toBe(true);
    expect(p).toContain('15 examples of usage each');
  });
  it('definição com destaque cita o trecho entre aspas e a frase', () => {
    const p = buildPrompt('define', { text: 'He spilled the beans yesterday', highlights: ['spilled the beans'] });
    expect(p).toContain('What does "spilled the beans" mean in this sentence?');
    expect(p).toContain('Sentence: "He **spilled the beans** yesterday"');
    expect(p).not.toContain('15 examples');
  });
  it('emphasize ignora trechos inexistentes e respeita ordem', () => {
    expect(emphasize('a b a', ['a', 'a'])).toBe('**a** b **a**');
    expect(emphasize('hello', ['zzz'])).toBe('hello');
  });
  it('URLs das IAs codificam o prompt', () => {
    const urls = AI_TARGETS.map((t) => t.url('a b&c'));
    expect(urls[0]).toContain('#ingles-prompt=a%20b%26c');
    expect(urls[1]).toBe('https://chatgpt.com/?q=a%20b%26c');
    expect(urls[2]).toBe('https://claude.ai/new?q=a%20b%26c');
  });
});
