/**
 * Minimal fetch helper for provider APIs — timeout, JSON parse, and a
 * normalized error string. It surfaces the provider's OWN message (Google/Meta/
 * Ads all nest it differently) so Settings can show validation failures
 * verbatim, and never leaks our internals.
 */
export interface HttpResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  errorText: string | null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

/** Pull a human message out of Google / Meta / OAuth error envelopes. */
function extractError(data: unknown): string | null {
  const root = asRecord(data);
  if (!root) return null;
  const err = root.error;
  if (typeof err === "string") {
    const desc = root.error_description;
    return typeof desc === "string" ? `${err}: ${desc}` : err;
  }
  const errObj = asRecord(err);
  if (errObj && typeof errObj.message === "string") {
    return errObj.message;
  }
  return null;
}

export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 20000,
): Promise<HttpResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let data: T | null = null;
    if (text) {
      try {
        data = JSON.parse(text) as T;
      } catch {
        data = null;
      }
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data,
        errorText:
          extractError(data) ??
          (text ? text.slice(0, 500) : res.statusText) ??
          `HTTP ${res.status}`,
      };
    }
    return { ok: true, status: res.status, data, errorText: null };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: 0,
      data: null,
      errorText: aborted
        ? `Request to ${hostOf(url)} timed out.`
        : err instanceof Error
          ? err.message
          : "Network error.",
    };
  } finally {
    clearTimeout(timer);
  }
}
