/**
 * Editorial review gate — the YMYL compliance chokepoint shared by taxonomy
 * enrichment and MatrixPage writes.
 *
 * Two responsibilities on every write:
 *  1. Re-scan the record's editorial text for cure/guarantee language
 *     (`lib/content-flags.ts`) and return the cached `contentFlags`.
 *  2. Enforce the approval gate: a record may only reach `reviewStatus:
 *     "approved"` when it has either no content flags, or flags a reviewer has
 *     explicitly acknowledged.
 *
 * It NEVER blocks saving a draft / in-review record — flags are advisory until
 * the moment of approval, matching the site's existing content-flag posture.
 *
 * ── On the reviewer requirement ────────────────────────────────────────────
 * Approval used to additionally require a `reviewedBy` MedicalReviewer. That is
 * now an editorial convention rather than a hard block, so a page can ship
 * before a credentialed reviewer has been recruited. Nothing misleading follows
 * from it: `ReviewedByByline` renders NOTHING without a reviewer, and
 * `medicalWebPageJsonLd` omits `reviewedBy`, so an unreviewed page simply
 * carries no medical-review claim rather than a fabricated one.
 *
 * To restore the hard requirement, reinstate the `merged.reviewedBy` check in
 * {@link reviewEditorialWrite}. The cure/guarantee gate below is the actual
 * safety control and is deliberately left untouched.
 */
import "server-only";

import { blocksScanText, parseBlocks } from "@/lib/blocks/content";
import { scanContentFlags, type ContentFlag } from "@/lib/content-flags";

/** Long-form editorial fields that may carry medical claims (any record kind). */
const SCANNED_TEXT_FIELDS = [
  "description",
  "shortDescription",
  "body",
  "intro",
  // Treatment
  "mechanism",
  "evidenceSummary",
  "costRange",
  "recoveryTimeline",
  "risks",
  // Condition
  "overview",
  "standardOfCare",
  "evidenceForCellTherapy",
  // Location
  "regulatoryStatus",
  "logistics",
  "travelNotes",
];

/**
 * Collect every scannable string on a record: top-level fields, faqs, keyFacts,
 * and the prose inside its modular content blocks. Blocks are re-parsed rather
 * than trusted, so a hand-edited row can't smuggle a claim past the gate by
 * malforming a block's `data`.
 */
function editorialText(doc: Record<string, unknown>): string[] {
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string" && v.trim()) parts.push(v);
  };

  for (const field of SCANNED_TEXT_FIELDS) push(doc[field]);

  if (Array.isArray(doc.blocks)) push(blocksScanText(parseBlocks(doc.blocks)));

  const faqs = doc.faqs as { question?: string; answer?: string }[] | undefined;
  if (Array.isArray(faqs)) {
    for (const f of faqs) {
      push(f.question);
      push(f.answer);
    }
  }

  const keyFacts = doc.keyFacts as
    { label?: string; value?: string }[] | undefined;
  if (Array.isArray(keyFacts)) {
    for (const k of keyFacts) {
      push(k.label);
      push(k.value);
    }
  }

  return parts;
}

export interface ReviewGateResult {
  /** Recomputed flags to persist on the record. */
  contentFlags: ContentFlag[];
  /** Non-null when the write must be rejected (approval gate failed). */
  error: string | null;
}

/**
 * Recompute content flags and enforce the approval gate on the MERGED final
 * state (`existing` overlaid with the incoming patch). Callers persist
 * `contentFlags` and reject with `error` (HTTP 422) when non-null.
 */
export function reviewEditorialWrite(
  existing: Record<string, unknown> | null,
  incoming: Record<string, unknown>,
): ReviewGateResult {
  const merged = { ...(existing ?? {}), ...incoming };
  const contentFlags = scanContentFlags(editorialText(merged));

  if (merged.reviewStatus === "approved") {
    if (contentFlags.length > 0 && !merged.flagsAcknowledged) {
      const n = contentFlags.length;
      return {
        contentFlags,
        error: `Approval blocked: ${n} flagged phrase${
          n === 1 ? "" : "s"
        } must be acknowledged by the reviewer before publishing.`,
      };
    }
  }

  return { contentFlags, error: null };
}
