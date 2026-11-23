import type { CloneKind, LauncherItem, PlatformKind } from '../core/types';

export interface HttpRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  /** JSON (objeto) ou texto. */
  body?: unknown;
  responseType?: 'json' | 'text' | 'arraybuffer';
}

export interface HttpResponse {
  status: number;
  ok: boolean;
  data: unknown; // json/text ou ArrayBuffer
  headers: Record<string, string>;
}

export interface AnkiDeck {
  id: string;
  name: string;
}

export interface AnkiNote {
  deck: string;
  front: string; // HTML
  back: string; // HTML
  audio?: { filename: string; base64: string } | null;
  tags?: string[];
}

export interface UpdateInfo {
  available: boolean;
  version?: string;
  notes?: string;
  url?: string;
  /** desktop: já baixada e pronta para instalar */
  ready?: boolean;
  progress?: number;
}

export interface CloneTab {
  title: string;
  url: string;
  profile: string;
  /** Serviço de streaming para contar o tempo dentro do clone. */
  service?: string | null;
  /** Cores do app (cabeçalho e aba ativa). */
  colors?: [string, string];
  /** JS para injetar após carregar (ex.: preencher prompt no Gemini). */
  inject?: string;
}

export interface Platform {
  kind: PlatformKind;
  label: string;
  /** Recursos exclusivos de cada versão. */
  features: {
    launcher: boolean;
    ocr: boolean;
    autoStart: boolean;
    streamingTracker: boolean;
    clones: boolean;
  };
  init(): Promise<void>;
  copy(text: string): Promise<void>;
  readClipboard(): Promise<string>;
  http(req: HttpRequest): Promise<HttpResponse>;
  openUrls(urls: string[]): Promise<void>;
  openLauncherItem(item: LauncherItem): Promise<void>;
  openClone(kind: Exclude<CloneKind, null>, tabs: CloneTab[]): Promise<void>;
  /** Abre as 3 IAs com o prompt (abas no PC, clones/app no celular). */
  openAIs(prompt: string): Promise<'opened' | 'copied'>;
  anki: {
    describe(): string;
    available(): Promise<{ ok: boolean; message: string }>;
    decks(): Promise<AnkiDeck[]>;
    createDeck(name: string): Promise<void>;
    addNote(note: AnkiNote): Promise<void>;
  };
  ocr?(source: 'camera' | 'gallery'): Promise<string>;
  getAutoStart?(): Promise<boolean>;
  setAutoStart?(on: boolean): Promise<void>;
  checkUpdate(): Promise<UpdateInfo>;
  installUpdate(info: UpdateInfo): Promise<void>;
  onUpdate?(fn: (u: UpdateInfo) => void): void;
  /** Android: contagem de streaming por notificações de mídia + acessibilidade. */
  tracking?: {
    status(): Promise<{ notification: boolean; accessibility: boolean }>;
    openNotificationSettings(): Promise<void>;
    openAccessibilitySettings(): Promise<void>;
  };
  /** Extras do PC (Chrome Estudos / pasta da extensão). */
  desktop?: {
    setupExtension(): Promise<{ folder: string }>;
    openExtensionFolder(): Promise<void>;
    chromeStatus(): Promise<{ found: boolean; path: string; profile: string }>;
  };
}
