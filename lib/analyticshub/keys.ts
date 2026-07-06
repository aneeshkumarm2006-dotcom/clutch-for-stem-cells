/**
 * Canonical config-store keys. One place so the handler, connect flows, and
 * cache-busting never drift on a string literal.
 */
export const K = {
  password: "auth:password",
  project: "config:project",
  google: "source:google",
  meta: "source:meta",
  gads: "source:gads",
  healthGoogle: "health:google",
  healthMeta: "health:meta",
  healthGads: "health:gads",
  cache: (source: string, from: string, to: string): string =>
    `cache:${source}:${from}:${to}`,
  cachePrefix: (source: string): string => `cache:${source}:`,
} as const;
