/**
 * IndexNow — push URLs to the participating search engines the moment they are
 * published, changed, or removed.
 *
 * IndexNow is a free, open protocol (no API key purchase, no quota tier). One
 * POST to `api.indexnow.org` fans out to every participant: **Bing, Yandex,
 * Naver, Seznam, Yep**. Google does **not** participate — Googlebot still
 * discovers through the sitemap and organic crawl, so nothing here replaces
 * `app/sitemap.ts`. The reason to care is that Bing's index is a primary
 * retrieval layer for ChatGPT Search, so a same-minute Bing push is the
 * fastest route into AI answers.
 *
 * ## Contract
 *
 * {@link pingIndexNow} is **fire-and-forget and never throws**. It returns
 * `void`, is never awaited in a request path, and cannot delay or fail the
 * response it rides along with. Every failure mode (no key, DB/network outage,
 * a 4xx from the endpoint) degrades to a log line, the same discipline
 * `app/sitemap.ts` uses when the database is unreachable at build time.
 *
 * Because it is un-awaited, a serverless invocation that is frozen the instant
 * it returns its response can cut the request short. That is accepted rather
 * than worked around (`waitUntil` would mean a new runtime dependency): the
 * `.github/workflows/indexnow.yml` sitemap diff re-submits anything a dropped
 * ping missed, so the worst case is "indexed on the next diff" rather than
 * "never indexed". Callers that *want* the result (the CLI backfill in
 * `scripts/indexnow-ping.ts`) await {@link submitIndexNow} instead.
 *
 * ## Safety rails
 *
 * - **Production only.** No key, or `VERCEL_ENV !== "production"`, is a silent
 *   no-op, so dev and preview deploys never submit. The CLI passes
 *   `force: true` because a human running a backfill is a deliberate act.
 * - **Canonical, indexable URLs only.** Query strings (faceted directory
 *   variants are `noindex` + canonicalized back to the clean path — see
 *   `lib/seo-indexation.ts`), fragments, off-host URLs, and private path
 *   prefixes are dropped before submission. Submitting a `noindex` URL wastes
 *   the signal; submitting an off-host URL earns a 422 for the whole batch.
 * - **Never hardcodes the domain.** Host and `keyLocation` are both derived
 *   from {@link absoluteUrl}, the same helper `app/sitemap.ts` uses, so a
 *   rebrand needs no edit here.
 */
import { absoluteUrl } from "@/lib/seo";

/** Protocol endpoint. One POST here fans out to every participating engine. */
const ENDPOINT = "https://api.indexnow.org/indexnow";

/** Protocol cap on `urlList` length; larger sets are split across requests. */
export const MAX_URLS_PER_REQUEST = 10_000;

/**
 * Path prefixes that must never be submitted. Mirrors the `DISALLOW` list in
 * `app/robots.ts` — kept as its own copy rather than imported, because
 * `app/robots.ts` is a route module and importing a route into `lib/` to share
 * one array would invert the dependency direction. Both lists are short and
 * both are about "not for crawlers", so they are checked against each other by
 * eye when either changes.
 */
const PRIVATE_PREFIXES = [
  "/admin",
  "/api/",
  "/auth/",
  "/account",
  "/seoteam",
  "/analyticshub",
  "/r/",
];

/** Hosts that are never a real site: a ping from one would be a 422. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

export interface IndexNowConfig {
  key: string;
  host: string;
  /** Where the engines fetch the key file to prove we own the host. */
  keyLocation: string;
}

/**
 * Resolved key + host, or `null` when IndexNow is not usable in this
 * environment. `reason` is for the log line, never for a thrown error.
 */
export function indexNowConfig(
  opts: { force?: boolean } = {},
): { config: IndexNowConfig } | { config: null; reason: string } {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key) return { config: null, reason: "INDEXNOW_KEY is not set" };

  // Preview and dev deployments share the production key but not the
  // production host, so a submission from one is either wrong or a 422.
  if (!opts.force && process.env.VERCEL_ENV !== "production") {
    return {
      config: null,
      reason: `VERCEL_ENV is ${process.env.VERCEL_ENV ?? "unset"}, not "production"`,
    };
  }

  let host: string;
  try {
    host = new URL(absoluteUrl("/")).host;
  } catch {
    return { config: null, reason: "site URL is not a valid URL" };
  }

  if (LOCAL_HOSTS.has(host.replace(/:\d+$/, ""))) {
    return {
      config: null,
      reason: `site URL resolves to ${host}; set NEXT_PUBLIC_SITE_URL to the public domain`,
    };
  }

  return {
    config: { key, host, keyLocation: absoluteUrl(`/${key}.txt`) },
  };
}

/**
 * Absolute, deduped, submittable URLs for a set of root-relative paths (or
 * already-absolute URLs). Drops anything that is not a canonical indexable URL
 * on our own host; order is preserved so logs read in the order callers meant.
 *
 * Exported for the unit tests and the CLI, which both want the filtering
 * without the network call.
 */
export function normalizeIndexNowUrls(
  input: string | string[],
  opts: { host?: string } = {},
): string[] {
  const host = opts.host ?? hostOrNull();
  if (!host) return [];

  const out = new Set<string>();

  for (const raw of Array.isArray(input) ? input : [input]) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;

    let url: URL;
    try {
      url = new URL(absoluteUrl(trimmed));
    } catch {
      continue;
    }

    // An off-host URL makes the engines reject the entire batch, not just the
    // offending row, so it must never reach `urlList`.
    if (url.host !== host) continue;
    // A query string means a faceted/sorted/paged variant, which the page
    // itself serves as `noindex, follow` with a canonical pointing elsewhere.
    if (url.search) continue;
    if (url.hash) continue;
    if (PRIVATE_PREFIXES.some((p) => url.pathname.startsWith(p))) continue;

    out.add(url.toString());
  }

  return [...out];
}

function hostOrNull(): string | null {
  try {
    return new URL(absoluteUrl("/")).host;
  } catch {
    return null;
  }
}

/** Split a URL list into protocol-legal batches. */
export function chunkUrls(
  urls: string[],
  size = MAX_URLS_PER_REQUEST,
): string[][] {
  if (urls.length <= size) return urls.length ? [urls] : [];
  const chunks: string[][] = [];
  for (let i = 0; i < urls.length; i += size) {
    chunks.push(urls.slice(i, i + size));
  }
  return chunks;
}

export interface IndexNowBatchResult {
  status: number;
  count: number;
  ok: boolean;
  error?: string;
}

export interface IndexNowResult {
  submitted: number;
  skipped: boolean;
  /** Why nothing was submitted, when `skipped` is true. */
  reason?: string;
  batches: IndexNowBatchResult[];
}

/**
 * Submit URLs and resolve with what happened. **Never throws** — a transport
 * error becomes a batch result with `ok: false`.
 *
 * Prefer {@link pingIndexNow} in a request path; use this where the caller
 * genuinely needs the outcome (the CLI backfill reports it and sets an exit
 * code).
 */
export async function submitIndexNow(
  urls: string | string[],
  opts: { force?: boolean; dryRun?: boolean } = {},
): Promise<IndexNowResult> {
  const resolved = indexNowConfig(opts);
  if (!resolved.config) {
    return {
      submitted: 0,
      skipped: true,
      reason: resolved.reason,
      batches: [],
    };
  }
  const { key, host, keyLocation } = resolved.config;

  const urlList = normalizeIndexNowUrls(urls, { host });
  if (!urlList.length) {
    return {
      submitted: 0,
      skipped: true,
      reason: "no submittable URLs after filtering",
      batches: [],
    };
  }

  if (opts.dryRun) {
    return {
      submitted: 0,
      skipped: true,
      reason: `dry run (${urlList.length} URLs would be submitted)`,
      batches: [],
    };
  }

  const batches: IndexNowBatchResult[] = [];

  for (const chunk of chunkUrls(urlList)) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ host, key, keyLocation, urlList: chunk }),
        // Never let a hanging endpoint pin an invocation open.
        signal: AbortSignal.timeout(10_000),
      });

      // 200 = accepted, 202 = accepted with key validation still pending.
      const isOk = res.status === 200 || res.status === 202;
      batches.push({ status: res.status, count: chunk.length, ok: isOk });
      logBatch(res.status, chunk.length, keyLocation);
    } catch (err) {
      batches.push({
        status: 0,
        count: chunk.length,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
      // eslint-disable-next-line no-console
      console.warn(
        `[indexnow] submission failed for ${chunk.length} URL(s):`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return {
    submitted: batches.reduce((n, b) => n + (b.ok ? b.count : 0), 0),
    skipped: false,
    batches,
  };
}

/**
 * A 403 or 422 means the key file is wrong or missing, which silently disables
 * IndexNow for every future submission. That is the one failure worth shouting
 * about, because nothing else in the system will surface it.
 */
function logBatch(status: number, count: number, keyLocation: string): void {
  if (status === 200 || status === 202) {
    // eslint-disable-next-line no-console
    console.info(`[indexnow] submitted ${count} URL(s) (HTTP ${status})`);
    return;
  }

  if (status === 403 || status === 422) {
    // eslint-disable-next-line no-console
    console.error(
      `[indexnow] HTTP ${status} — key rejected. Check that ${keyLocation} ` +
        `is reachable and contains exactly the INDEXNOW_KEY value, and that ` +
        `every submitted URL is on the same host. ${count} URL(s) dropped.`,
    );
    return;
  }

  // eslint-disable-next-line no-console
  console.warn(
    `[indexnow] unexpected HTTP ${status} for ${count} URL(s) ` +
      `(429 = slow down, 400 = malformed body).`,
  );
}

/**
 * Fire-and-forget submission for use in publish paths.
 *
 * Returns immediately and swallows everything. Call it *after* the write has
 * succeeded and right before returning the response; do not `await` it.
 *
 * @param urls One or more root-relative paths (`/blog/my-post`) or absolute
 *   URLs on this site. Non-canonical, private, and off-host entries are
 *   dropped, so callers can pass a rough list without pre-filtering.
 */
export function pingIndexNow(urls: string | string[]): void {
  try {
    void submitIndexNow(urls).catch(() => {
      /* `submitIndexNow` already logs; this is belt-and-braces. */
    });
  } catch {
    /* Synchronous throw (bad input) must not reach the caller either. */
  }
}
