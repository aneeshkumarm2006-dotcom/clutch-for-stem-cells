import * as React from "react";

import { renderJsonLd, type JsonLd as JsonLdData } from "@/lib/seo";

/**
 * Renders one or more schema.org nodes as a `<script type="application/ld+json">`
 * tag. Centralizes the `renderJsonLd` (XSS-safe) + `dangerouslySetInnerHTML`
 * pattern so pages don't repeat the eslint-disable boilerplate. Pass a single
 * node or an array of nodes.
 */
export function JsonLd({ data }: { data: JsonLdData | JsonLdData[] }) {
  const nodes = Array.isArray(data) ? data : [data];
  if (nodes.length === 0) return null;
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: renderJsonLd(nodes) }}
    />
  );
}
