"use client";

import * as React from "react";

/**
 * Shortlist state — PRD §7 / §6.10 / Stage 5.11 + 5.13.
 *
 * Guest-only, backed by `localStorage` and keyed by clinic **slug**. The
 * sign-in-and-sync path was removed along with the member area: the public site
 * never exposed sign-in, so no visitor could ever reach the server-side copy.
 * Nothing here touches the network, and no cookie is read on the server, so
 * public pages stay statically renderable.
 */
const STORAGE_KEY = "mystemcellguide:shortlist";

interface ShortlistContextValue {
  slugs: Set<string>;
  ready: boolean;
  isSaved: (slug: string) => boolean;
  toggle: (slug: string) => void;
  count: number;
}

const ShortlistContext = React.createContext<ShortlistContextValue | null>(null);

function readLocal(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((s) => typeof s === "string")
      : [];
  } catch {
    return [];
  }
}

function writeLocal(slugs: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
  } catch {
    /* storage full / disabled — non-fatal */
  }
}

export function ShortlistProvider({ children }: { children: React.ReactNode }) {
  const [slugs, setSlugs] = React.useState<Set<string>>(new Set());
  const [ready, setReady] = React.useState(false);

  // Hydrate after mount — `localStorage` doesn't exist during SSR, and reading
  // it in render would desync the first paint.
  React.useEffect(() => {
    setSlugs(new Set(readLocal()));
    setReady(true);
  }, []);

  const toggle = React.useCallback((slug: string) => {
    setSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      writeLocal([...next]);
      return next;
    });
  }, []);

  const value = React.useMemo<ShortlistContextValue>(
    () => ({
      slugs,
      ready,
      isSaved: (slug: string) => slugs.has(slug),
      toggle,
      count: slugs.size,
    }),
    [slugs, ready, toggle],
  );

  return (
    <ShortlistContext.Provider value={value}>
      {children}
    </ShortlistContext.Provider>
  );
}

export function useShortlist(): ShortlistContextValue {
  const ctx = React.useContext(ShortlistContext);
  if (!ctx) {
    throw new Error("useShortlist must be used within a ShortlistProvider");
  }
  return ctx;
}
