import { build } from 'esbuild';
const common = { bundle: true, platform: 'node', target: 'node20', format: 'cjs', external: ['electron'], sourcemap: false, minify: true };
await build({ ...common, entryPoints: ['electron/main.ts'], outfile: 'electron-dist/main.cjs' });
await build({ ...common, entryPoints: ['electron/preload.ts'], outfile: 'electron-dist/preload.cjs' });
console.log('electron ok');
