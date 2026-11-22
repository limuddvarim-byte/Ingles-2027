import { defineConfig } from 'vitest/config';
export default defineConfig({
  define: { __APP_VERSION__: '"0.0.0-test"', __PLATFORM__: '"web"', __SYNC_URL__: '""', __SYNC_TOKEN__: '""', __UPDATE_URL__: '""', __REPO__: '"x/y"' },
  test: { environment: 'jsdom', setupFiles: ['tests/setup.ts'], include: ['tests/**/*.test.ts', 'worker/test/**/*.test.ts'] },
});
