import React, { ComponentType, lazy } from 'react';

const RELOAD_GUARD_KEY = 'lowervibe_chunk_reload_ts';
const RELOAD_COOLDOWN_MS = 12000;

function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test(
    msg
  );
}

/**
 * Resilient React.lazy wrapper that retries transient dynamic import failures
 * (such as flaky mobile connections or post-deploy chunk invalidations) and
 * guards against infinite reload loops.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const delays = [0, 350, 900];
    let lastError: unknown;

    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt] > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, delays[attempt]));
      }
      try {
        return await factory();
      } catch (err) {
        lastError = err;
        if (!isChunkLoadError(err)) {
          throw err;
        }
      }
    }

    if (typeof window !== 'undefined' && isChunkLoadError(lastError)) {
      try {
        const lastReload = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || '0');
        if (!lastReload || Date.now() - lastReload > RELOAD_COOLDOWN_MS) {
          sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
      } catch {
        // Fall through to throw original error
      }
    }

    throw lastError;
  });
}
