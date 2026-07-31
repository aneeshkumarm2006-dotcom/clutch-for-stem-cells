"use client";

/**
 * Recent searches — the last few terms a visitor searched, kept in
 * `localStorage` only (never sent anywhere; search terms can carry health
 * details, so they stay on the device). Shown when an empty search field gets
 * focus, which is the moment a returning visitor most often wants the thing
 * they looked at yesterday.
 *
 * Mirrors the guest-shortlist storage convention in `lib/hooks/use-shortlist`.
 */
import * as React from "react";

const STORAGE_KEY = "mystemcellguide:recent-searches";
const MAX_ENTRIES = 5;
/** Same-tab writes don't fire `storage`, so components sync through this. */
const CHANGE_EVENT = "mystemcellguide:recent-searches-change";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "[]",
    ) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string" && v.length > 0)
      : [];
  } catch {
    return [];
  }
}

function write(values: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    // Private mode / quota: recents are a convenience, not a requirement.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function addRecentSearch(term: string): void {
  const value = term.trim();
  if (typeof window === "undefined" || value.length < 2) return;
  const existing = read().filter(
    (v) => v.toLowerCase() !== value.toLowerCase(),
  );
  write([value, ...existing].slice(0, MAX_ENTRIES));
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  write([]);
}

/** Reads on mount only, so server and first client render stay identical. */
export function useRecentSearches(): string[] {
  const [values, setValues] = React.useState<string[]>([]);

  React.useEffect(() => {
    const sync = () => setValues(read());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return values;
}
