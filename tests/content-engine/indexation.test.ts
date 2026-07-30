/**
 * Indexation rules — behavioural tests for `lib/seo-indexation.ts`.
 *
 * These decide which URLs Google is allowed to index AND which URLs land in
 * `sitemap.xml`; the two callers must never disagree, so the predicates are pure
 * and tested directly.
 *
 * Run: npx tsx --tsconfig tsconfig.test.json --test tests/content-engine/indexation.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isMatrixIndexable,
  shouldNoindexDirectory,
} from "@/lib/seo-indexation";

// ── shouldNoindexDirectory ──────────────────────────────────────────────────

test("a clean directory URL is indexable", () => {
  assert.equal(shouldNoindexDirectory({}), false);
  assert.equal(shouldNoindexDirectory({ page: "1", view: "all" }), false);
});

test("filtered, sorted, paged and alternate-view URLs are not", () => {
  assert.equal(shouldNoindexDirectory({ view: "top" }), true);
  assert.equal(shouldNoindexDirectory({ page: "2" }), true);
  assert.equal(shouldNoindexDirectory({ sort: "rating" }), true);
  assert.equal(shouldNoindexDirectory({ country: "mexico" }), true);
});

test("a route-locked dimension in the query does not make the page thin", () => {
  // `/conditions/parkinsons` pins the condition; seeing it again in the query
  // is the same page, not a user-applied facet.
  assert.equal(
    shouldNoindexDirectory(
      { condition: "parkinsons" },
      { locked: ["condition"] },
    ),
    false,
  );
  // A second, unlocked facet still demotes it.
  assert.equal(
    shouldNoindexDirectory(
      { condition: "parkinsons", country: "mexico" },
      { locked: ["condition"] },
    ),
    true,
  );
});

// ── isMatrixIndexable ───────────────────────────────────────────────────────

test("an approved record is indexable", () => {
  assert.equal(isMatrixIndexable({ reviewStatus: "approved" }), true);
});

test("an unapproved record is not", () => {
  assert.equal(isMatrixIndexable({ reviewStatus: "draft" }), false);
  assert.equal(isMatrixIndexable({ reviewStatus: "in_review" }), false);
});

// ── emptiness is not a gate ─────────────────────────────────────────────────

test("content depth never affects indexability", () => {
  // Regression guard for a deliberate policy choice: thin pages are indexed.
  // A page with no clinics, no FAQs, no body and no reviewer is still indexable
  // once approved. If a soft-404 gate is ever reintroduced, it must be opt-in
  // per record (`seo.noindex`), never inferred from emptiness.
  assert.equal(
    isMatrixIndexable({ reviewStatus: "approved" } as {
      reviewStatus: string;
    }),
    true,
  );
});
