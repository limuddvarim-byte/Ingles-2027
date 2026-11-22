/// <reference types="vite/client" />
declare const __APP_VERSION__: string;
declare const __PLATFORM__: 'desktop' | 'android' | 'extension' | 'web';
/** URL do servidor de sincronização embutida no build (Cloudflare Worker). */
declare const __SYNC_URL__: string;
/** Token embutido no build (opcional — veja docs/TUTORIAL-CLOUDFLARE.md). */
declare const __SYNC_TOKEN__: string;
/** Endpoint que informa a última versão (GitHub Releases ou o seu Worker /update). */
declare const __UPDATE_URL__: string;
declare const __REPO__: string;
