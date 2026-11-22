// Contrato da ponte exposta pelo preload do Electron (window.inglesDesktop).
import type { HttpRequest, HttpResponse, UpdateInfo } from './types';

export interface DesktopBridge {
  version: string;
  http(req: HttpRequest): Promise<HttpResponse>;
  openUrls(urls: string[], mode: 'chrome-estudos' | 'default', chromePath?: string): Promise<{ ok: boolean; message?: string }>;
  copy(text: string): Promise<void>;
  readClipboard(): Promise<string>;
  getAutoStart(): Promise<boolean>;
  setAutoStart(on: boolean): Promise<void>;
  checkUpdate(): Promise<UpdateInfo>;
  installUpdate(): Promise<void>;
  onUpdate(fn: (u: UpdateInfo) => void): void;
  setupExtension(chromePath?: string): Promise<{ folder: string }>;
  openExtensionFolder(): Promise<void>;
  chromeStatus(chromePath?: string): Promise<{ found: boolean; path: string; profile: string }>;
}

declare global {
  interface Window {
    inglesDesktop?: DesktopBridge;
  }
}
