import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('inglesDesktop', {
  version: process.env.npm_package_version ?? '',
  http: (req: unknown) => ipcRenderer.invoke('ingles:http', req),
  openUrls: (urls: string[], mode: string, chromePath?: string) => ipcRenderer.invoke('ingles:openUrls', urls, mode, chromePath),
  copy: (t: string) => ipcRenderer.invoke('ingles:copy', t),
  readClipboard: () => ipcRenderer.invoke('ingles:readClipboard'),
  getAutoStart: () => ipcRenderer.invoke('ingles:getAutoStart'),
  setAutoStart: (on: boolean) => ipcRenderer.invoke('ingles:setAutoStart', on),
  checkUpdate: () => ipcRenderer.invoke('ingles:checkUpdate'),
  installUpdate: () => ipcRenderer.invoke('ingles:installUpdate'),
  onUpdate: (fn: (u: unknown) => void) => ipcRenderer.on('ingles:update', (_e, u) => fn(u)),
  setupExtension: (chromePath?: string) => ipcRenderer.invoke('ingles:setupExtension', chromePath),
  openExtensionFolder: () => ipcRenderer.invoke('ingles:openExtensionFolder'),
  chromeStatus: (chromePath?: string) => ipcRenderer.invoke('ingles:chromeStatus', chromePath),
});
