// Tipos centrais compartilhados pela tríade (software, app e extensão).

export type PlatformKind = 'desktop' | 'android' | 'extension' | 'web';

/** Campos comuns a todo registro sincronizado. */
export interface SyncMeta {
  id: string;
  updatedAt: number;
  /** Exclusão definitiva (tombstone) — o registro some de todos os aparelhos. */
  deleted?: boolean;
}

export interface PhraseAudio {
  id: string;
  voiceId: string;
  voiceName?: string;
  /** hash do texto usado para gerar — se a frase mudar, o áudio fica desatualizado. */
  textHash: string;
  createdAt: number;
}

export interface Phrase extends SyncMeta {
  /** HTML da frente (com negrito, itálico, sublinhado, cores e termos com setas). */
  html: string;
  /** Texto puro da frente — é o que vai para o ElevenLabs e para os prompts. */
  text: string;
  /** Verso do flashcard (opcional): tradução PT-BR ou definição em inglês. */
  back: string;
  audio: PhraseAudio | null;
  anki: { deck: string; sentAt: number } | null;
  createdAt: number;
  /** Quando foi apagada da lista = aprendida. */
  learnedAt: number | null;
  /** Apagada sem contar como aprendida. */
  removed?: boolean;
}

export type IconSpec =
  | { kind: 'preset'; value: string }
  | { kind: 'emoji'; value: string }
  | { kind: 'image'; value: string } // data URL
  | { kind: 'favicon'; value: string }; // domínio

export type CloneKind = 'realworld' | 'youtube' | 'chatgpt' | 'gemini' | 'claude' | null;

export interface LauncherItem extends SyncMeta {
  name: string;
  urls: string[];
  icon: IconSpec;
  /** Gradiente do bloco [cor1, cor2]. */
  colors: [string, string];
  order: number;
  /** Serviço de streaming associado (para estatísticas). */
  service?: StreamingService | null;
  /** No celular: abre numa versão clonada e isolada dentro do app. */
  clone?: CloneKind;
  /** No celular: pacote do app nativo para abrir direto (Netflix, Disney+...). */
  androidPackage?: string | null;
  builtin?: string | null;
  hidden?: boolean;
}

export type StreamingService =
  | 'netflix'
  | 'hbomax'
  | 'disney'
  | 'crunchyroll'
  | 'prime'
  | 'appletv'
  | 'youtube'
  | 'realworld';

export interface WatchRecord extends SyncMeta {
  service: StreamingService;
  /** YYYY-MM-DD local */
  day: string;
  seconds: number;
  source: 'auto' | 'manual';
  device?: string;
  note?: string;
}

export interface DraftDoc extends SyncMeta {
  html: string;
}

export type ThemeMode = 'light' | 'amoled' | 'auto';
export type PhraseColorMode = 'default' | 'turquoise';

/** Configurações sincronizadas entre a tríade. */
export interface SharedSettings {
  theme: ThemeMode;
  phraseColor: PhraseColorMode;
  uiFont: string;
  phraseFont: string;
  phraseSize: number;
  elevenApiKey: string;
  elevenVoiceId: string;
  elevenVoiceName: string;
  elevenModel: string;
  ankiDeck: string;
  dailyGoalMinutes: number;
  trackingPaused: Partial<Record<StreamingService, boolean>>;
  trackingAllPaused: boolean;
}

/** Configurações só deste aparelho (não sincronizam). */
export interface LocalSettings {
  syncUrl: string;
  syncToken: string;
  ankiConnectUrl: string;
  browserMode: 'chrome-estudos' | 'default';
  chromePath: string;
  lastSyncAt: number;
  lastSyncError: string;
  autoStart: boolean;
  onboarded: boolean;
}

export interface SettingsRecord extends SyncMeta {
  value: SharedSettings;
}

export type CollectionName = 'phrases' | 'launcher' | 'watch' | 'draft' | 'settings';

export interface CollectionMap {
  phrases: Phrase;
  launcher: LauncherItem;
  watch: WatchRecord;
  draft: DraftDoc;
  settings: SettingsRecord;
}

export interface SyncChange {
  c: CollectionName;
  id: string;
  u: number;
  d?: boolean;
  data?: unknown;
}
