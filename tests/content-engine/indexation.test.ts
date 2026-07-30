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
  hasTermEditorialContent,
  isThinDirectoryTerm,
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
    shouldNoindexDirectory({ condition: "parkinsons" }, { locked: ["condition"] }),
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

// ── isThinDirectoryTerm ─────────────────────────────────────────────────────

test("a term with clinics is indexable, guide or no guide", () => {
  assert.equal(isThinDirectoryTerm({ clinicCount: 3 }), false);
  assert.equal(isThinDirectoryTerm({ clinicCount: 1, editorial: null }), false);
});

test("a term with no clinics and no guide is withheld (soft-404 guard)", () => {
  assert.equal(isThinDirectoryTerm({ clinicCount: 0 }), true);
  assert.equal(isThinDirectoryTerm({}), true);
  assert.equal(isThinDirectoryTerm({ clinicCount: 0, editorial: null }), true);
});

test("an approved-but-blank editorial record does not rescue an empty term", () => {
  // `buildTermEditorial` returns an object for any approved term, even one
  // where nothing has been written yet — presence alone must not count.
  assert.equal(
    isThinDirectoryTerm({
      clinicCount: 0,
      editorial: { body: "", blocks: [], faqs: [], keyFacts: [], sections: [] },
    }),
    true,
  );
});

test("a real guide keeps an empty term indexable, via any content field", () => {
  const written = [
    { body: "Long-form guide copy." },
    { blocks: [{ type: "callout" }] },
    { faqs: [{ question: "q", answer: "a" }] },
    { keyFacts: [{ label: "l", value: "v" }] },
    { sections: [{ title: "Overview", body: "…" }] },
  ];
  for (const editorial of written) {
    assert.equal(hasTermEditorialContent({ editorial }), true);
    assert.equal(isThinDirectoryTerm({ clinicCount: 0, editorial }), false);
  }
});
