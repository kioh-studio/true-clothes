// Races a promise against a timeout so a hung network call (stalled, not
// outright failed) can never block a caller forever. On timeout, resolves to
// `fallback` instead of waiting for the original promise; a genuine rejection
// from the original promise still propagates (only the "never settles" case
// is caught here). The original promise is left running — its eventual
// settlement is ignored once the race is decided.
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Used to bound the cold-start hydrate() network calls (authStore, appStore)
// so a stalled connection surfaces as "treat as unavailable" instead of an
// indefinitely stuck splash screen.
export const HYDRATE_TIMEOUT_MS = 15000;
