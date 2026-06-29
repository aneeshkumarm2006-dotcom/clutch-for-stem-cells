/**
 * Client-side helper for admin mutations (Stage 6).
 *
 * Wraps `fetch` to the `/api/admin/*` handlers: sends JSON, parses the `{error}`
 * envelope these routes return, and throws a friendly `Error` on failure so
 * callers can `toast.error(e.message)`.
 */
export async function adminFetch<T = unknown>(
  url: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* empty / non-JSON body */
  }

  if (!res.ok) {
    const message =
      (payload as { error?: string } | null)?.error ??
      "Something went wrong. Try again.";
    throw new Error(message);
  }
  return payload as T;
}
