"use client";

import * as React from "react";

/**
 * Fires a one-time view beacon for a post so the page stays statically cacheable
 * while view counts still increment. Deduped per browser session via
 * sessionStorage; failures are ignored (it's a monitoring metric).
 */
export function ViewBeacon({ slug }: { slug: string }) {
  React.useEffect(() => {
    const key = `blog-viewed:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage unavailable (private mode) — just send the beacon once.
    }
    void fetch(`/api/blog/${encodeURIComponent(slug)}/view`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {
      /* ignore */
    });
  }, [slug]);

  return null;
}
