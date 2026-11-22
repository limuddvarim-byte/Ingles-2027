// Constantes injetadas no build (vite.config.ts / scripts/build-extension.mjs).
const g = globalThis as Record<string, unknown>;
const pick = <T>(fn: () => T, fallback: T): T => {
  try {
    const v = fn();
    return v === undefined || v === null ? fallback : v;
  } catch {
    return fallback;
  }
};

export const APP_VERSION: string = pick(() => __APP_VERSION__, (g.__APP_VERSION__ as string) ?? '0.0.0');
export const PLATFORM = pick(() => __PLATFORM__, 'web' as const);
export const EMBEDDED_SYNC_URL: string = pick(() => __SYNC_URL__, '');
export const EMBEDDED_SYNC_TOKEN: string = pick(() => __SYNC_TOKEN__, '');
export const REPO: string = pick(() => __REPO__, 'limuddvarim-byte/Ingles-2027');
export const UPDATE_URL: string = pick(() => __UPDATE_URL__, '') || `https://api.github.com/repos/${REPO}/releases/latest`;
