/**
 * Content compliance scanner — flags unsupported efficacy language (Stage 8.8 /
 * PRD §14).
 *
 * In a sensitive medical vertical we must NOT present treatments as cures or
 * guaranteed outcomes. This module detects "cure / guaranteed / miracle / 100%
 * effective"-style phrasing in user- or provider-supplied copy (clinic
 * descriptions, case studies, reviews) so staff can review it before it goes
 * live. It is **advisory only** — it surfaces matches for a human, it never
 * blocks or rewrites content.
 *
 * Intentionally dependency-free (no mongoose, no server-only) so it runs in both
 * the admin read layer (server) and the clinic edit form (client live warning).
 */

/**
 * Prohibited / high-risk phrases. Each entry is matched case-insensitively on a
 * word boundary. Keep this list conservative — false positives erode trust in
 * the flag. Tunable here (Settings-backed list is a possible Phase 2 extension).
 */
export const FLAGGED_PHRASES: readonly string[] = [
  "cure",
  "cures",
  "cured",
  "guarantee",
  "guaranteed",
  "guarantees",
  "100% effective",
  "100% success",
  "fully effective",
  "miracle",
  "miraculous",
  "permanent cure",
  "completely heals",
  "completely cured",
  "no risk",
  "risk-free",
  "risk free",
  "proven to cure",
  "reverses",
  "reverse aging",
  "eliminates the disease",
];

export interface ContentFlag {
  /** The phrase that matched (as listed above). */
  phrase: string;
  /** A short surrounding snippet for context in the admin UI. */
  context: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Pre-compiled, word-boundary, case-insensitive matcher per phrase.
const MATCHERS = FLAGGED_PHRASES.map((phrase) => ({
  phrase,
  re: new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "i"),
}));

/**
 * Scan one or more strings and return the distinct flagged phrases found, each
 * with a context snippet. Empty array = clean.
 */
export function scanContentFlags(
  input: string | Array<string | undefined | null>,
): ContentFlag[] {
  const texts = (Array.isArray(input) ? input : [input]).filter(
    (t): t is string => Boolean(t && t.trim()),
  );
  if (texts.length === 0) return [];

  const found = new Map<string, ContentFlag>();
  for (const text of texts) {
    for (const { phrase, re } of MATCHERS) {
      if (found.has(phrase)) continue;
      const m = re.exec(text);
      if (m && m.index != null) {
        const start = Math.max(0, m.index - 30);
        const end = Math.min(text.length, m.index + m[0].length + 30);
        const snippet =
          (start > 0 ? "…" : "") +
          text.slice(start, end).trim() +
          (end < text.length ? "…" : "");
        found.set(phrase, { phrase, context: snippet });
      }
    }
  }
  return [...found.values()];
}

/** Just the matched phrases (no context) — convenient for live form warnings. */
export function findFlaggedPhrases(
  input: string | Array<string | undefined | null>,
): string[] {
  return scanContentFlags(input).map((f) => f.phrase);
}

/** True when any flagged phrase is present. */
export function hasContentFlags(
  input: string | Array<string | undefined | null>,
): boolean {
  const texts = Array.isArray(input) ? input : [input];
  for (const text of texts) {
    if (!text) continue;
    for (const { re } of MATCHERS) if (re.test(text)) return true;
  }
  return false;
}
