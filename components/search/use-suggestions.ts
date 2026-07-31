"use client";

/**
 * useSuggestions — the shared data half of every typeahead on the site.
 *
 * Owns the parts that are easy to get subtly wrong and pointless to write
 * twice: debouncing, cancelling superseded requests, holding the previous
 * results on screen while the next ones load (so the menu never blinks empty
 * mid-word), and a process-wide response cache so backspacing re-renders
 * instantly instead of re-querying Mongo.
 *
 * The UI half lives in `suggestion-menu.tsx`.
 */
import * as React from "react";

import type { Suggestion, SuggestionType } from "@/lib/search";

/** Below this, a query matches most of the database and helps nobody. */
export const MIN_QUERY_LENGTH = 2;

/**
 * Case- and accent-insensitive comparison key, mirroring how the server matched
 * the row: a visitor who types "cancun" has named "Cancún".
 */
export function foldForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/** True when `text` names `label` exactly, ignoring case and accents. */
export function namesExactly(text: string, label: string): boolean {
  return foldForMatch(text) === foldForMatch(label);
}

/**
 * Shared across every mounted typeahead, and deliberately never invalidated:
 * these entries live for one page session, and taxonomy/clinic names do not
 * change inside one.
 */
const cache = new Map<string, Suggestion[]>();
const CACHE_MAX_ENTRIES = 80;

function remember(key: string, suggestions: Suggestion[]): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Maps iterate in insertion order, so this drops the oldest entry.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, suggestions);
}

export interface SuggestOptions {
  /** Restrict to certain kinds, e.g. `["location"]` for a place field. */
  types?: readonly SuggestionType[];
  limit?: number;
  debounceMs?: number;
}

function cacheKey(query: string, { types, limit = 8 }: SuggestOptions): string {
  const typeKey = types?.length ? [...types].sort().join(",") : "all";
  return `${typeKey}|${limit}|${query.trim().toLowerCase()}`;
}

function requestUrl(
  query: string,
  { types, limit = 8 }: SuggestOptions,
): string {
  const params = new URLSearchParams({ q: query.trim(), limit: String(limit) });
  if (types?.length) params.set("types", types.join(","));
  return `/api/search/suggest?${params.toString()}`;
}

/**
 * Synchronous cache read. Lets a form resolve what the visitor typed at submit
 * time without waiting on a round trip, so pressing Enter straight after typing
 * still applies the right filter.
 */
export function peekSuggestions(
  query: string,
  opts: SuggestOptions = {},
): Suggestion[] | undefined {
  if (query.trim().length < MIN_QUERY_LENGTH) return [];
  return cache.get(cacheKey(query, opts));
}

export interface SuggestionsState {
  suggestions: Suggestion[];
  /** The query `suggestions` actually belong to (lags `query` while loading). */
  resolvedQuery: string;
  /** A request is in flight and there is nothing resolved for this query yet. */
  loading: boolean;
  /** The current query has a resolved (possibly empty) result set. */
  ready: boolean;
  error: boolean;
}

export function useSuggestions(
  query: string,
  opts: SuggestOptions = {},
): SuggestionsState {
  const { types, limit = 8, debounceMs = 160 } = opts;
  const typeKey = types?.length ? [...types].sort().join(",") : "all";
  const trimmed = query.trim();
  const enabled = trimmed.length >= MIN_QUERY_LENGTH;
  const key = cacheKey(trimmed, { types, limit });

  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<{
    key: string;
    suggestions: Suggestion[];
    error: boolean;
  } | null>(null);

  React.useEffect(() => {
    if (!enabled || cache.has(key)) {
      setPending(false);
      return;
    }
    setPending(true);

    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            requestUrl(trimmed, { types: types as SuggestionType[], limit }),
            { signal: controller.signal },
          );
          if (!res.ok) throw new Error(`suggest ${res.status}`);
          const data = (await res.json()) as { suggestions?: Suggestion[] };
          const suggestions = data.suggestions ?? [];
          remember(key, suggestions);
          setResult({ key, suggestions, error: false });
        } catch {
          // An abort means a newer keystroke owns the field now; leave the
          // state alone so the older request can't overwrite it.
          if (controller.signal.aborted) return;
          setResult({ key, suggestions: [], error: true });
        } finally {
          if (!controller.signal.aborted) setPending(false);
        }
      })();
    }, debounceMs);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
    // `typeKey` stands in for the `types` array so a fresh literal on every
    // render can't restart the fetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, trimmed, enabled, typeKey, limit, debounceMs]);

  const resolved = enabled
    ? (cache.get(key) ?? (result?.key === key ? result.suggestions : undefined))
    : [];

  // Keep the last resolved set on screen while the next one loads, so typing
  // never flashes an empty menu between keystrokes.
  const previous = React.useRef<{ query: string; suggestions: Suggestion[] }>({
    query: "",
    suggestions: [],
  });
  if (resolved) previous.current = { query: trimmed, suggestions: resolved };

  return {
    suggestions: resolved ?? previous.current.suggestions,
    resolvedQuery: resolved ? trimmed : previous.current.query,
    loading: pending && !resolved,
    ready: Boolean(resolved),
    error: result?.key === key && result.error,
  };
}
