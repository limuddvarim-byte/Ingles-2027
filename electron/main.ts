// Inglês — software para Windows (Electron).
// • Abre sozinho ao iniciar o Windows • Launcher abre tudo num "Chrome Estudos" isolado, em abas
// • Atualiza sozinho pelas Releases do GitHub • Mantém a extensão atualizada numa pasta fixa
import { app, BrowserWindow, clipboard, ipcMain, Menu, nativeImage, net, shell, Tray } from 'electron';
import { autoUpdater } from 'electron-updater';
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const isDev = !app.isPackaged;
// Pasta de dados fixa e sem acento (%APPDATA%\\Ingles) — banco, Chrome Estudos e extensão.
app.setPath('userData', join(app.getPath('appData'), 'Ingles'));
let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let lastUpdate: { available: boolean; version?: string; ready?: boolean; progress?: number; notes?: string } = { available: false };

const resources = () => (isDev ? join(__dirname, '..') : process.resourcesPath);
const iconPath = () => join(resources(), isDev ? 'build/icon.png' : 'icon.png');
const configFile = () => join(app.getPath('userData'), 'ingles-config.json');

function readConfig(): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(configFile(), 'utf8'));
  } catch {
    return {};
  }
}
function writeConfig(patch: Record<string, unknown>) {
  writeFileSync(configFile(), JSON.stringify({ ...readConfig(), ...patch }, null, 2));
}

// ---------------------------------------------------------------- Chrome Estudos

function findChrome(custom?: string): string | null {
  const cands = [
    custom,
    process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && join(process.env['PROGRAMFILES(X86)']!, 'Google/Chrome/Application/chrome.exe'),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean) as string[];
  return cands.find((c) => existsSync(c)) ?? null;
}

const profileDir = () => join(app.getPath('userData'), 'ChromeEstudos');
const extensionDir = () => join(app.getPath('userData'), 'extensao');

/** Perfil novo já nasce em inglês (Accept-Language en-US) para favorecer conteúdo em inglês. */
function prepareProfile() {
  const prefDir = join(profileDir(), 'Default');
  const pref = join(prefDir, 'Preferences');
  if (existsSync(pref)) return;
  mkdirSync(prefDir, { recursive: true });
  writeFileSync(
    pref,
    JSON.stringify({
      intl: { accept_languages: 'en-US,en', selected_languages: 'en-US,en' },
      translate: { enabled: false },
      profile: { name: 'Inglês — Estudos', avatar_index: 26 },
      browser: { has_seen_welcome_page: true },
    }),
  );
}

function openInChromeEstudos(urls: string[], chromePath?: string): { ok: boolean; message?: string } {
  const chrome = findChrome(chromePath);
  if (!chrome) return { ok: false, message: 'Google Chrome não encontrado. Informe o caminho em Ajustes.' };
  prepareProfile();
  // Com o mesmo --user-data-dir, as URLs viram ABAS na janela já aberta (não abre várias janelas).
  const args = [`--user-data-dir=${profileDir()}`, '--profile-directory=Default', '--no-first-run', '--no-default-browser-check', '--lang=en-US', ...urls];
  const child = spawn(chrome, args, { detached: true, stdio: 'ignore' });
  child.unref();
  return { ok: true };
}

// ---------------------------------------------------------------- extensão (pasta fixa)

function syncExtensionFolder() {
  const src = join(resources(), isDev ? 'extension-dist' : 'extension');
  if (!existsSync(src)) return;
  const dst = extensionDir();
  try {
    const srcV = JSON.parse(readFileSync(join(src, 'manifest.json'), 'utf8')).version;
    const dstV = existsSync(join(dst, 'manifest.json')) ? JSON.parse(readFileSync(join(dst, 'manifest.json'), 'utf8')).version : null;
    if (srcV === dstV) return;
    rmSync(dst, { recursive: true, force: true });
    cpSync(src, dst, { recursive: true });
  } catch (e) {
    console.error('extensão', e);
  }
}

// ---------------------------------------------------------------- janela

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 380,
    minHeight: 560,
    title: 'Inglês',
    icon: iconPath(),
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => {
    if (!process.argv.includes('--hidden')) win?.show();
  });
  win.loadFile(join(__dirname, '..', 'dist-desktop', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      win?.hide();
    }
  });
}

function createTray() {
  const img = nativeImage.createFromPath(iconPath()).resize({ width: 18, height: 18 });
  tray = new Tray(img);
  tray.setToolTip('Inglês');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir Inglês', click: showWindow },
      { type: 'separator' },
      {
        label: 'Sair',
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on('click', showWindow);
}

function showWindow() {
  if (!win) createWindow();
  win?.show();
  if (win?.isMinimized()) win.restore();
  win?.focus();
}

// ---------------------------------------------------------------- atualizações

function setupUpdater() {
  if (isDev) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  const send = () => win?.webContents.send('ingles:update', lastUpdate);
  autoUpdater.on('update-available', (i) => {
    lastUpdate = { available: true, version: i.version, notes: String(i.releaseNotes ?? '') };
    send();
  });
  autoUpdater.on('download-progress', (p) => {
    lastUpdate = { ...lastUpdate, progress: p.percent };
    send();
  });
  autoUpdater.on('update-downloaded', (i) => {
    lastUpdate = { available: true, version: i.version, ready: true };
    send();
  });
  autoUpdater.on('error', (e) => console.error('updater', e));
  void autoUpdater.checkForUpdates().catch(() => undefined);
  setInterval(() => void autoUpdater.checkForUpdates().catch(() => undefined), 3 * 3600_000);
}

// ---------------------------------------------------------------- IPC

function registerIpc() {
  ipcMain.handle('ingles:http', async (_e, req: { url: string; method?: string; headers?: Record<string, string>; body?: unknown; responseType?: string }) => {
    const isJson = req.body !== undefined && typeof req.body !== 'string';
    const res = await net.fetch(req.url, {
      method: req.method ?? (req.body ? 'POST' : 'GET'),
      headers: { ...(isJson ? { 'Content-Type': 'application/json' } : {}), ...(req.headers ?? {}) },
      body: req.body === undefined ? undefined : isJson ? JSON.stringify(req.body) : (req.body as string),
    });
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => (headers[k] = v));
    let data: unknown;
    if (req.responseType === 'arraybuffer') data = await res.arrayBuffer();
    else if (req.responseType === 'text') data = await res.text();
    else data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data, headers };
  });
  ipcMain.handle('ingles:openUrls', async (_e, urls: string[], mode: string, chromePath?: string) => {
    if (mode === 'chrome-estudos') return openInChromeEstudos(urls, chromePath);
    for (const u of urls) await shell.openExternal(u);
    return { ok: true };
  });
  ipcMain.handle('ingles:copy', (_e, t: string) => clipboard.writeText(t));
  ipcMain.handle('ingles:readClipboard', () => clipboard.readText());
  ipcMain.handle('ingles:getAutoStart', () => app.getLoginItemSettings().openAtLogin);
  ipcMain.handle('ingles:setAutoStart', (_e, on: boolean) => {
    app.setLoginItemSettings({ openAtLogin: on, path: process.execPath });
    writeConfig({ autoStart: on });
  });
  ipcMain.handle('ingles:checkUpdate', async () => {
    if (isDev) return { available: false };
    const r = await autoUpdater.checkForUpdates().catch(() => null);
    if (r?.updateInfo && r.updateInfo.version !== app.getVersion()) lastUpdate = { ...lastUpdate, available: true, version: r.updateInfo.version };
    return lastUpdate;
  });
  ipcMain.handle('ingles:installUpdate', () => {
    quitting = true;
    autoUpdater.quitAndInstall(false, true);
  });
  ipcMain.handle('ingles:setupExtension', (_e, chromePath?: string) => {
    syncExtensionFolder();
    const folder = extensionDir();
    void shell.openPath(folder);
    openInChromeEstudos(['chrome://extensions/'], chromePath);
    clipboard.writeText(folder);
    return { folder };
  });
  ipcMain.handle('ingles:openExtensionFolder', () => {
    syncExtensionFolder();
    void shell.openPath(extensionDir());
  });
  ipcMain.handle('ingles:chromeStatus', (_e, chromePath?: string) => {
    const c = findChrome(chromePath);
    return { found: !!c, path: c ?? '', profile: profileDir() };
  });
  ipcMain.handle('ingles:version', () => app.getVersion());
}

// ---------------------------------------------------------------- início

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.setAppUserModelId('com.ingles.triade');
  app.whenReady().then(() => {
    // Primeira execução: liga "abrir ao iniciar o Windows".
    const cfg = readConfig();
    if (cfg.autoStart === undefined && !isDev) {
      app.setLoginItemSettings({ openAtLogin: true, path: process.execPath });
      writeConfig({ autoStart: true });
    }
    registerIpc();
    syncExtensionFolder();
    createWindow();
    createTray();
    setupUpdater();
  });
  app.on('before-quit', () => (quitting = true));
  app.on('window-all-closed', () => {
    /* continua na bandeja */
  });
}
