// ElevenLabs — gera o áudio da FRENTE das frases (nunca do verso nem das explicações das setas).
import { getAudio, getSharedSettings, put, putAudio, uid } from '../core/db';
import { hashText } from '../core/richtext';
import type { Phrase } from '../core/types';
import { platform } from '../platform';

const API = 'https://api.elevenlabs.io/v1';

export interface Voice {
  voice_id: string;
  name: string;
  category?: string;
  preview_url?: string;
  labels?: Record<string, string>;
}

export async function listVoices(apiKey: string): Promise<Voice[]> {
  const res = await platform.http({ url: `${API}/voices`, headers: { 'xi-api-key': apiKey }, responseType: 'json' });
  if (res.status === 401) throw new Error('Chave da API do ElevenLabs inválida');
  if (!res.ok) throw new Error(`ElevenLabs respondeu ${res.status}`);
  return ((res.data as { voices: Voice[] }).voices ?? []).sort((a, b) => a.name.localeCompare(b.name));
}

export const MODELS = [
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2 (mais natural)' },
  { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5 (rápido)' },
  { id: 'eleven_flash_v2_5', name: 'Flash v2.5 (mais barato)' },
  { id: 'eleven_v3', name: 'Eleven v3 (expressivo)' },
];

export async function synthesize(text: string, opts?: { apiKey?: string; voiceId?: string; model?: string }): Promise<Blob> {
  const s = await getSharedSettings();
  const apiKey = opts?.apiKey ?? s.elevenApiKey;
  const voiceId = opts?.voiceId ?? s.elevenVoiceId;
  if (!apiKey) throw new Error('Configure a chave do ElevenLabs em Ajustes → Voz');
  if (!voiceId) throw new Error('Escolha uma voz em Ajustes → Voz');
  const res = await platform.http({
    url: `${API}/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    method: 'POST',
    headers: { 'xi-api-key': apiKey, Accept: 'audio/mpeg' },
    body: { text, model_id: opts?.model ?? s.elevenModel, voice_settings: { stability: 0.5, similarity_boost: 0.8 } },
    responseType: 'arraybuffer',
  });
  if (res.status === 401) throw new Error('Chave do ElevenLabs inválida');
  if (res.status === 402 || res.status === 429) throw new Error('Limite/créditos do ElevenLabs atingido');
  if (!res.ok) throw new Error(`ElevenLabs respondeu ${res.status}`);
  return new Blob([res.data as ArrayBuffer], { type: 'audio/mpeg' });
}

/** O áudio está atualizado com o texto e a voz atuais? */
export function audioIsFresh(p: Phrase, voiceId: string): boolean {
  return !!p.audio && p.audio.textHash === hashText(p.text) && (!voiceId || p.audio.voiceId === voiceId);
}

export async function generateAudio(p: Phrase): Promise<Phrase> {
  const s = await getSharedSettings();
  const blob = await synthesize(p.text);
  const id = `aud-${uid()}`;
  await putAudio({ id, mime: 'audio/mpeg', data: blob, synced: false, createdAt: Date.now() });
  return put('phrases', {
    ...p,
    audio: { id, voiceId: s.elevenVoiceId, voiceName: s.elevenVoiceName, textHash: hashText(p.text), createdAt: Date.now() },
  });
}

/** Gera áudio para todas as frases de uma vez (só as que ainda não têm ou mudaram). */
export async function generateAll(phrases: Phrase[], onProgress: (done: number, total: number, current?: Phrase) => void, force = false) {
  const s = await getSharedSettings();
  const todo = phrases.filter((p) => force || !audioIsFresh(p, s.elevenVoiceId));
  let done = 0;
  const errors: string[] = [];
  onProgress(0, todo.length);
  for (const p of todo) {
    onProgress(done, todo.length, p);
    try {
      await generateAudio(p);
    } catch (e) {
      errors.push((e as Error).message);
      if (/inválida|Limite|Configure|Escolha/.test((e as Error).message)) break;
    }
    done++;
    onProgress(done, todo.length);
  }
  return { total: todo.length, errors };
}

export async function audioBlob(p: Phrase): Promise<Blob | null> {
  if (!p.audio) return null;
  const local = await getAudio(p.audio.id);
  if (local) return local.data;
  const { ensureAudio } = await import('../core/sync');
  return ensureAudio(p.audio.id);
}

let current: HTMLAudioElement | null = null;
export async function playPhrase(p: Phrase): Promise<boolean> {
  const blob = await audioBlob(p);
  if (!blob) return false;
  current?.pause();
  const url = URL.createObjectURL(blob);
  current = new Audio(url);
  current.onended = () => URL.revokeObjectURL(url);
  await current.play();
  return true;
}

export async function playUrl(url: string) {
  current?.pause();
  current = new Audio(url);
  await current.play();
}
