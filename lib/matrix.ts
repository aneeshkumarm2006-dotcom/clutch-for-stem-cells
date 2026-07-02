/**
 * Combination-page (MatrixPage) URL + label helpers — pure and mongoose-free so
 * routes, the sitemap, link components, and the CMS all map a (kind, slugA,
 * slugB) triple to the same nested path.
 *
 * Canonical URL per kind (one direction only — no mirror routes):
 *   treatment_condition → /treatments/{treatment}/for/{condition}
 *   treatment_country   → /locations/{country}/treatments/{treatment}
 *   condition_country   → /locations/{country}/conditions/{condition}
 *
 * `slugA` is always the primary axis (treatment, or condition for
 * condition×country); `slugB` is the secondary (condition, or country).
 */
import type { MatrixKind } from "@/lib/enums";

/** Root-relative canonical path for a combination record. */
export function matrixPagePath(
  kind: MatrixKind,
  slugA: string,
  slugB: string,
): string {
  switch (kind) {
    case "treatment_condition":
      return `/treatments/${slugA}/for/${slugB}`;
    case "treatment_country":
      return `/locations/${slugB}/treatments/${slugA}`;
    case "condition_country":
      return `/locations/${slugB}/conditions/${slugA}`;
  }
}

export const MATRIX_KIND_LABELS: Record<MatrixKind, string> = {
  treatment_condition: "Treatment × condition",
  treatment_country: "Treatment × destination",
  condition_country: "Condition × destination",
};
