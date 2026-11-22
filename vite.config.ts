import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const env = process.env;

export default defineConfig(({ mode }) => {
  const platform = ['desktop', 'android', 'extension'].includes(mode) ? mode : 'web';
  return {
    base: './',
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(env.APP_VERSION || pkg.version),
      __PLATFORM__: JSON.stringify(platform),
      __SYNC_URL__: JSON.stringify(env.SYNC_URL || ''),
      __SYNC_TOKEN__: JSON.stringify(env.SYNC_TOKEN || ''),
      __UPDATE_URL__: JSON.stringify(env.UPDATE_URL || ''),
      __REPO__: JSON.stringify(env.GITHUB_REPOSITORY || 'limuddvarim-byte/Ingles-2027'),
    },
    build: {
      outDir: `dist-${platform}`,
      emptyOutDir: true,
      chunkSizeWarningLimit: 2000,
      assetsInlineLimit: 0,
    },
    server: { port: 5173 },
  };
});
