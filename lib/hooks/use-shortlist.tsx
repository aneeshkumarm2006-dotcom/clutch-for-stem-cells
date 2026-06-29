"use client";

import * as React from "react";
import { useSession } from "next-auth/react";

/**
 * Shortlist state — PRD §7 / §6.10 / Stage 5.11 + 5.13.
 *
 * Works for guests via `localStorage` and **syncs on login** to the user record
 * (PRD §7). Keyed by clinic **slug** throughout the client; the sync API
 * (`/api/account/shortlist`) resolves slugs ↔ ObjectIds server-side.
 *
 * Fully client-driven (reads auth via `useSession`) so it imposes no cookie read
 * on the server layout — public pages stay statically renderable. On sign-in it
 * unions any guest slugs with the server set, pushes the merge once, then treats
 * the server as the source of truth (and clears the guest copy).
 */
const STORAGE_KEY = "stemconnect:shortlist";

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

async function postShortlist(body: Record<string, unknown>): Promise<void> {
  try {
    await fetch("/api/account/shortlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    /* offline — local state still reflects the intent */
  }
}

export function ShortlistProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  const [slugs, setSlugs] = React.useState<Set<string>>(new Set());
  const [ready, setReady] = React.useState(false);
  const syncedRef = React.useRef(false);

  // Guests: hydrate from localStorage immediately.
  React.useEffect(() => {
    if (status === "loading") return;
    if (!isAuthenticated) {
      setSlugs(new Set(readLocal()));
      setReady(true);
      syncedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // On login: merge guest slugs with the server set, push once, then trust server.
  React.useEffect(() => {
    if (!isAuthenticated || syncedRef.current) return;
    syncedRef.current = true;
    const local = readLocal();
    let active = true;
    (async () => {
      let serverSlugs: string[] = [];
      try {
        const res = await fetch("/api/account/shortlist");
        if (res.ok) {
          const data = (await res.json()) as { slugs?: string[] };
          serverSlugs = data.slugs ?? [];
        }
      } catch {
        /* offline — fall back to local */
      }
      const merged = new Set([...serverSlugs, ...local]);
      if (active) {
        setSlugs(merged);
        setReady(true);
      }
      if (local.some((s) => !serverSlugs.includes(s))) {
        await postShortlist({ action: "set", slugs: [...merged] });
      }
      writeLocal([]); // server is now the source of truth
    })();
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const toggle = React.useCallback(
    (slug: string) => {
      setSlugs((prev) => {
        const next = new Set(prev);
        const removing = next.has(slug);
        if (removing) next.delete(slug);
        else next.add(slug);

        if (isAuthenticated) {
          void postShortlist({ action: removing ? "remove" : "add", slug });
        } else {
          writeLocal([...next]);
        }
        return next;
      });
    },
    [isAuthenticated],
  );

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
