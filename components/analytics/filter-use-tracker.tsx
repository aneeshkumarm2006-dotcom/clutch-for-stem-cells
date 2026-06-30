"use client";

/**
 * FilterUseTracker — fires a consent-gated `filter_use` beacon whenever the
 * active directory filter set changes (Stage 9.2 / PRD §15). The server passes a
 * stable `signature` (sorted active filter dimension names) and the count; we
 * report only the dimension *names*, never the values, so no PII or query text
 * leaves the browser. Renders nothing.
 */
import * as React from "react";

import { trackClientEvent } from "@/lib/analytics-client";

export function FilterUseTracker({
  signature,
  count,
}: {
  signature: string;
  count: number;
}) {
  const last = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!signature || signature === last.current) return;
    last.current = signature;
    trackClientEvent("filter_use", {
      props: { dimensions: signature, count },
    });
  }, [signature, count]);

  return null;
}
