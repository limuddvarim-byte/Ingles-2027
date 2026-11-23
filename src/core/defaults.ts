import type { LauncherItem, LocalSettings, SharedSettings, StreamingService } from './types';
import { EMBEDDED_SYNC_TOKEN, EMBEDDED_SYNC_URL } from './build';

export const DEFAULT_SHARED: SharedSettings = {
  theme: 'auto',
  phraseColor: 'default',
  uiFont: 'Plus Jakarta Sans',
  phraseFont: 'Lora',
  phraseSize: 20,
  elevenApiKey: '',
  elevenVoiceId: '',
  elevenVoiceName: '',
  elevenModel: 'eleven_multilingual_v2',
  ankiDeck: 'Inglês',
  dailyGoalMinutes: 60,
  trackingPaused: {},
  trackingAllPaused: false,
};

export const DEFAULT_LOCAL: LocalSettings = {
  syncUrl: EMBEDDED_SYNC_URL,
  syncToken: EMBEDDED_SYNC_TOKEN,
  ankiConnectUrl: 'http://127.0.0.1:8765',
  browserMode: 'chrome-estudos',
  chromePath: '',
  lastSyncAt: 0,
  lastSyncError: '',
  autoStart: true,
  onboarded: false,
};

export interface ServiceInfo {
  id: StreamingService;
  name: string;
  colors: [string, string];
  /** Cor nos gráficos (tema claro / AMOLED). */
  chart: string;
  chartDark: string;
  hosts: string[];
  url: string;
  androidPackage?: string;
}

// Ordem fixa (empilhamento dos gráficos) com cores validadas para daltonismo,
// próximas da cor de cada marca. chart = tema claro, chartDark = AMOLED.
export const SERVICES: ServiceInfo[] = [
  { id: 'disney', name: 'Disney Plus', colors: ['#1B4FBF', '#0BB5D8'], chart: '#2a78d6', chartDark: '#3987e5', hosts: ['disneyplus.com'], url: 'https://www.disneyplus.com', androidPackage: 'com.disney.disneyplus' },
  { id: 'crunchyroll', name: 'Crunchyroll', colors: ['#FF8A1F', '#F2540B'], chart: '#eb6834', chartDark: '#d95926', hosts: ['crunchyroll.com'], url: 'https://www.crunchyroll.com', androidPackage: 'com.crunchyroll.crunchyroid' },
  { id: 'prime', name: 'Prime Video', colors: ['#1FA2FF', '#0A5FD1'], chart: '#1baf7a', chartDark: '#199e70', hosts: ['primevideo.com', 'amazon.com'], url: 'https://www.primevideo.com', androidPackage: 'com.amazon.avod.thirdpartyclient' },
  { id: 'realworld', name: 'Real World', colors: ['#FFD21F', '#F0453A'], chart: '#eda100', chartDark: '#c98500', hosts: ['instagram.com'], url: 'https://www.instagram.com/' },
  { id: 'youtube', name: 'YouTube', colors: ['#FF2D2D', '#B80000'], chart: '#e87ba4', chartDark: '#d55181', hosts: ['youtube.com', 'youtu.be'], url: 'https://www.youtube.com/?hl=en&gl=US' },
  { id: 'appletv', name: 'Apple TV', colors: ['#3A3A3F', '#0B0B0D'], chart: '#008300', chartDark: '#0ca30c', hosts: ['tv.apple.com'], url: 'https://tv.apple.com', androidPackage: 'com.apple.atve.androidtv.appletv' },
  { id: 'hbomax', name: 'HBO Max', colors: ['#5B2BFF', '#1A0B7A'], chart: '#6250d6', chartDark: '#9085e9', hosts: ['hbomax.com', 'max.com'], url: 'https://play.hbomax.com', androidPackage: 'com.wbd.stream' },
  { id: 'netflix', name: 'Netflix', colors: ['#E50914', '#7A0007'], chart: '#e34948', chartDark: '#e66767', hosts: ['netflix.com'], url: 'https://www.netflix.com/browse', androidPackage: 'com.netflix.mediaclient' },
];

export const SERVICE_MAP = Object.fromEntries(SERVICES.map((s) => [s.id, s])) as Record<StreamingService, ServiceInfo>;

export function serviceFromHost(host: string, path = ''): StreamingService | null {
  const h = host.toLowerCase();
  for (const s of SERVICES) {
    for (const d of s.hosts) {
      if (h === d || h.endsWith(`.${d}`)) {
        if (d === 'amazon.com' && !/\/(gp\/video|video)/.test(path)) return null;
        return s.id;
      }
    }
  }
  return null;
}

const svc = (id: StreamingService, order: number, extra: Partial<LauncherItem> = {}): LauncherItem => {
  const s = SERVICE_MAP[id];
  return {
    id: `builtin-${id}`,
    builtin: id,
    name: s.name,
    urls: [s.url],
    icon: { kind: 'preset', value: id },
    colors: s.colors,
    order,
    service: id,
    androidPackage: s.androidPackage ?? null,
    clone: null,
    updatedAt: 1,
    ...extra,
  };
};

/** Launcher padrão (pode ser editado, reordenado e ganhar novos atalhos). */
export function defaultLauncher(): LauncherItem[] {
  return [
    svc('hbomax', 0),
    svc('disney', 1),
    svc('crunchyroll', 2),
    svc('realworld', 3, { clone: 'realworld', androidPackage: null, icon: { kind: 'preset', value: 'realworld' } }),
    svc('netflix', 4),
    svc('appletv', 5),
    svc('prime', 6),
    svc('youtube', 7, { clone: 'youtube', androidPackage: null }),
    {
      id: 'builtin-chatgpt',
      builtin: 'chatgpt',
      name: 'ChatGPT',
      urls: ['https://chatgpt.com/'],
      icon: { kind: 'preset', value: 'chatgpt' },
      colors: ['#19C37D', '#0B6B4F'],
      order: 8,
      clone: 'chatgpt',
      service: null,
      updatedAt: 1,
    },
    {
      id: 'builtin-gemini',
      builtin: 'gemini',
      name: 'Gemini',
      urls: ['https://gemini.google.com/app'],
      icon: { kind: 'preset', value: 'gemini' },
      colors: ['#4F8BF9', '#B46CF0'],
      order: 9,
      clone: 'gemini',
      service: null,
      updatedAt: 1,
    },
  ];
}

export const PHRASE_COLORS = {
  light: '#0A0A0F',
  amoled: '#FFFFFF',
  turquoise: '#14D2C8',
};

export const FONT_LIST = [
  'Plus Jakarta Sans', 'Inter', 'Poppins', 'Montserrat', 'Nunito', 'Quicksand', 'Raleway', 'Lato', 'Open Sans', 'Roboto',
  'Rubik', 'Outfit', 'Sora', 'Space Grotesk', 'Manrope', 'DM Sans', 'Urbanist', 'Lexend', 'Comfortaa', 'Fredoka',
  'Baloo 2', 'Varela Round', 'Josefin Sans', 'Archivo', 'Kanit', 'Titillium Web', 'Chakra Petch', 'Exo 2', 'Rajdhani', 'Orbitron',
  'Audiowide', 'Righteous', 'Lilita One', 'Bebas Neue', 'Playfair Display', 'Merriweather', 'Lora', 'Libre Baskerville', 'Source Serif 4',
  'Caveat', 'Dancing Script', 'Pacifico', 'Indie Flower', 'Patrick Hand', 'Kalam', 'Comic Neue', 'Fira Code', 'JetBrains Mono',
];

export const TEXT_COLORS = [
  '#F43F5E', '#FB7185', '#F97316', '#F5A524', '#FACC15', '#84CC16', '#22C55E', '#10B981',
  '#14D2C8', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
];
