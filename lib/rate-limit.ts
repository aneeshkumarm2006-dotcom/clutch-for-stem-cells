/**
 * Rate limiting — Upstash Redis REST, SDK-free (Stage 3.7 / PRD §13).
 *
 * Fixed-window counter via the Upstash REST pipeline (`INCR` + `EXPIRE … NX` +
 * `PTTL` in one round trip). When `UPSTASH_REDIS_REST_URL`/`_TOKEN` are unset
 * (local dev), it falls back to a per-process in-memory window so public-form
 * flows stay testable without a Redis account — matching the graceful
 * degradation in `lib/email.ts`/`lib/db.ts`.
 *
 * Wrap public forms (review, lead, contact) via `lib/public-form.ts`.
 */

export interface RateLimitOptions {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the current window resets. */
  reset: number;
}

const REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/** True when Upstash is configured; otherwise the in-memory fallback is used. */
export function isRateLimitConfigured(): boolean {
  return Boolean(REST_URL && REST_TOKEN);
}

// ── In-memory fallback (dev / single instance) ───────────────────────────────

const memoryWindows = new Map<string, { count: number; resetAt: number }>();

function memoryRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const windowMs = opts.windowSeconds * 1000;
  const existing = memoryWindows.get(key);

  if (!existing || existing.resetAt <= now) {
    const entry = { count: 1, resetAt: now + windowMs };
    memoryWindows.set(key, entry);
    return {
      success: true,
      limit: opts.limit,
      remaining: opts.limit - 1,
      reset: entry.resetAt,
    };
  }

  existing.count += 1;
  return {
    success: existing.count <= opts.limit,
    limit: opts.limit,
    remaining: Math.max(0, opts.limit - existing.count),
    reset: existing.resetAt,
  };
}

// ── Upstash REST ─────────────────────────────────────────────────────────────

interface UpstashPipelineItem {
  result?: number | null;
  error?: string;
}

async function upstashRateLimit(
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const res = await fetch(`${REST_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      // Only the first hit in the window sets the TTL (NX), so the window is
      // fixed rather than sliding forward on every request.
      ["EXPIRE", key, opts.windowSeconds, "NX"],
      ["PTTL", key],
    ]),
    cache: "no-store",
  });

  if (!res.ok)
    throw new Error(`Upstash error: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as UpstashPipelineItem[];

  const count = data[0]?.result ?? 1;
  const pttl = data[2]?.result ?? opts.windowSeconds * 1000;
  return {
    success: count <= opts.limit,
    limit: opts.limit,
    remaining: Math.max(0, opts.limit - count),
    reset: Date.now() + (pttl > 0 ? pttl : opts.windowSeconds * 1000),
  };
}

/**
 * Increment and check the counter for `key`. Never throws — a transport error
 * fails open (request allowed) so a Redis hiccup can't take down public forms;
 * the error is logged for observability.
 */
export async function rateLimit(
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  if (!isRateLimitConfigured()) return memoryRateLimit(key, opts);
  try {
    return await upstashRateLimit(key, opts);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Rate limit check failed (failing open):", err);
    return {
      success: true,
      limit: opts.limit,
      remaining: opts.limit,
      reset: Date.now() + opts.windowSeconds * 1000,
    };
  }
}

/** Standard `X-RateLimit-*` headers (plus `Retry-After` when blocked). */
export function rateLimitHeaders(
  result: RateLimitResult,
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.reset / 1000)),
  };
  if (!result.success) {
    headers["Retry-After"] = String(
      Math.max(0, Math.ceil((result.reset - Date.now()) / 1000)),
    );
  }
  return headers;
}

/**
 * Check several keys in one go and return the *most* restrictive result — used
 * to cap an address and its /24 (or /48) together, so rotating through a rented
 * subnet doesn't reset the counter. Every key is incremented regardless of which
 * one trips first, otherwise a blocked address would stop feeding the subnet
 * counter that is supposed to be catching it.
 */
export async function rateLimitAll(
  keys: Array<{ key: string; opts: RateLimitOptions }>,
): Promise<RateLimitResult> {
  const results = await Promise.all(keys.map((k) => rateLimit(k.key, k.opts)));
  const blocked = results.filter((r) => !r.success);
  if (blocked.length) {
    // Report the longest wait so a client that respects Retry-After only comes
    // back once every bucket it tripped has actually reset.
    return blocked.reduce((worst, r) => (r.reset > worst.reset ? r : worst));
  }
  return results.reduce((least, r) =>
    r.remaining < least.remaining ? r : least,
  );
}

// ── Failure counters ────────────────────────────────────────────────────────
// `rateLimit` increments on every call, which is wrong for a login: a staff
// member who mistypes twice and then succeeds should not have burned three of
// their ten attempts for the next 15 minutes. These primitives split reading
// from writing so the caller increments only on a *failed* attempt and wipes
// the counter on success.

export interface CounterState {
  count: number;
  /** Epoch ms when the window resets (0 when no window is open). */
  resetAt: number;
}

/** Read a counter without touching it. Fails open (`count: 0`) on error. */
export async function peekCounter(key: string): Promise<CounterState> {
  if (!isRateLimitConfigured()) {
    const entry = memoryWindows.get(key);
    if (!entry || entry.resetAt <= Date.now()) return { count: 0, resetAt: 0 };
    return { count: entry.count, resetAt: entry.resetAt };
  }

  try {
    const res = await fetch(`${REST_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["GET", key],
        ["PTTL", key],
      ]),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Upstash error: ${res.status}`);
    const data = (await res.json()) as Array<{ result?: unknown }>;
    const count = Number(data[0]?.result ?? 0) || 0;
    const pttl = Number(data[1]?.result ?? 0) || 0;
    return { count, resetAt: pttl > 0 ? Date.now() + pttl : 0 };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Counter peek failed (failing open):", err);
    return { count: 0, resetAt: 0 };
  }
}

/** Increment a counter, opening a fixed window on the first hit. Never throws. */
export async function bumpCounter(
  key: string,
  windowSeconds: number,
): Promise<void> {
  if (!isRateLimitConfigured()) {
    memoryRateLimit(key, { limit: Number.MAX_SAFE_INTEGER, windowSeconds });
    return;
  }

  try {
    await fetch(`${REST_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, windowSeconds, "NX"],
      ]),
      cache: "no-store",
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Counter bump failed (ignored):", err);
  }
}

/** Delete counters (a successful login clears its own). Never throws. */
export async function clearCounters(keys: string[]): Promise<void> {
  if (!keys.length) return;
  if (!isRateLimitConfigured()) {
    for (const key of keys) memoryWindows.delete(key);
    return;
  }

  try {
    await fetch(`${REST_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(keys.map((key) => ["DEL", key])),
      cache: "no-store",
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Counter clear failed (ignored):", err);
  }
}
