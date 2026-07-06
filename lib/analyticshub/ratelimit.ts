/**
 * Login rate limit, persisted in the config store so it is durable across
 * serverless instances — no in-memory counters that reset on cold start, and no
 * KV dependency. Fixed-window, counting FAILURES only: `peek` reports whether
 * the key is currently locked; `recordFailure` increments after a bad password;
 * a successful login clears it.
 */
import { getJSON, setJSON, type HubStore } from "@/lib/analyticshub/store";

interface RateState {
  count: number;
  resetAt: number; // epoch ms
}

export interface RateResult {
  blocked: boolean;
  retryAfterSeconds: number;
}

function keyFor(key: string): string {
  return `ratelimit:${key}`;
}

export async function peekRateLimit(
  store: HubStore,
  key: string,
  limit: number,
  nowMs: number,
): Promise<RateResult> {
  const state = await getJSON<RateState>(store, keyFor(key));
  if (!state || state.resetAt <= nowMs) {
    return { blocked: false, retryAfterSeconds: 0 };
  }
  if (state.count >= limit) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((state.resetAt - nowMs) / 1000)),
    };
  }
  return { blocked: false, retryAfterSeconds: 0 };
}

export async function recordFailure(
  store: HubStore,
  key: string,
  windowMs: number,
  nowMs: number,
): Promise<void> {
  const k = keyFor(key);
  const state = await getJSON<RateState>(store, k);
  if (!state || state.resetAt <= nowMs) {
    await setJSON(store, k, { count: 1, resetAt: nowMs + windowMs });
    return;
  }
  await setJSON(store, k, { count: state.count + 1, resetAt: state.resetAt });
}

export async function clearRateLimit(
  store: HubStore,
  key: string,
): Promise<void> {
  await store.del(keyFor(key));
}
