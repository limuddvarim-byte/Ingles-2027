// Monta a extensão em extension-dist/: páginas (Vite, modo extension) + scripts (esbuild) + manifest.
import { build as vite } from 'vite';
import { build as esbuild } from 'esbuild';
import { cpSync, readFileSync, renameSync, writeFileSync, mkdirSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const version = process.env.APP_VERSION || pkg.version;
const out = 'extension-dist';

await vite({ mode: 'extension', logLevel: 'warn', build: { outDir: out, emptyOutDir: true } });
renameSync(`${out}/index.html`, `${out}/app.html`);

const define = {
  __APP_VERSION__: JSON.stringify(version),
  __PLATFORM__: '"extension"',
  __SYNC_URL__: JSON.stringify(process.env.SYNC_URL || ''),
  __SYNC_TOKEN__: JSON.stringify(process.env.SYNC_TOKEN || ''),
  __UPDATE_URL__: JSON.stringify(process.env.UPDATE_URL || ''),
  __REPO__: JSON.stringify(process.env.GITHUB_REPOSITORY || 'limuddvarim-byte/Ingles-2027'),
};
const common = { bundle: true, minify: true, target: 'chrome110', define };
await esbuild({ ...common, entryPoints: ['extension/src/background.ts'], outfile: `${out}/background.js`, format: 'esm' });
await esbuild({ ...common, entryPoints: ['extension/src/stream.ts'], outfile: `${out}/stream.js`, format: 'iife' });
await esbuild({ ...common, entryPoints: ['extension/src/ai.ts'], outfile: `${out}/ai.js`, format: 'iife' });

const manifest = JSON.parse(readFileSync('extension/manifest.json', 'utf8'));
manifest.version = version.replace(/[^0-9.]/g, '').split('.').slice(0, 4).join('.');
writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 2));
mkdirSync(`${out}/icons`, { recursive: true });
cpSync('extension/icons', `${out}/icons`, { recursive: true });
console.log(`extensão ${manifest.version} pronta em ${out}/`);
