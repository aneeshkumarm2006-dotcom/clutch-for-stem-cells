/**
 * Meta-tag text policy — behavioural tests.
 *
 * Two rules hold for every title and meta description on the site:
 *   1. no em dash
 *   2. `|` is the only separator symbol
 *
 * `lib/meta-text.ts` is pure, so both the detector and the rewriter can be
 * exercised directly. The last block asserts the rules survive the seam that
 * matters: `buildMetadata`, which every page's metadata goes through.
 *
 * Run: npx tsx --tsconfig tsconfig.test.json --test tests/content-engine/meta-text.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  findMetaIssues,
  isMetaCompliant,
  normalizeMetaText,
} from "@/lib/meta-text";
import { buildMetadata } from "@/lib/seo";

test("rule 1: an em dash is reported wherever it appears", () => {
  const issues = findMetaIssues("Blog — Page 2");
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.rule, "em-dash");
  assert.equal(issues[0]!.codePoint, "U+2014");

  // En dash, horizontal bar and minus sign are the same violation.
  for (const dash of ["–", "―", "‒", "−"])
    assert.equal(findMetaIssues(`A ${dash} B`)[0]?.rule, "em-dash");
});

test("rule 2: only the pipe passes as a separator", () => {
  assert.ok(isMetaCompliant("Stem Cell Clinics | My Stem Cell Guide"));
  for (const symbol of ["·", "•", "»", "→", ":", ";", "&", "/", "*", "~"])
    assert.equal(
      isMetaCompliant(`A ${symbol} B`),
      false,
      `${symbol} should be reported`,
    );
});

test("sentence punctuation and in-word marks are not violations", () => {
  for (const text of [
    "What Is Stem Cell Therapy? A Beginner's Guide",
    "Stromal Vascular Fraction (SVF)",
    'She said "yes", and it cost $5,000.',
    "Board-certified providers, 40% lower cost.",
  ])
    assert.ok(isMetaCompliant(text), text);
});

test("a title separates with the pipe, a description with a comma", () => {
  assert.equal(normalizeMetaText("Blog — Page 2", "title"), "Blog | Page 2");
  assert.equal(
    normalizeMetaText("Reviews of Acme — 4.6 out of 5.", "description"),
    "Reviews of Acme, 4.6 out of 5.",
  );
  assert.equal(
    normalizeMetaText("Stem Cell Guide · Compare Clinics", "title"),
    "Stem Cell Guide | Compare Clinics",
  );
  assert.equal(
    normalizeMetaText("AgeRejuvenation: Anti-Aging & Cell Therapy", "title"),
    "AgeRejuvenation | Anti-Aging and Cell Therapy",
  );
});

test("a slash separates when spaced and compounds when not", () => {
  assert.equal(
    normalizeMetaText("IV / Systemic Cell Therapy", "title"),
    "IV | Systemic Cell Therapy",
  );
  assert.equal(
    normalizeMetaText("led by a board-certified OB/GYN.", "description"),
    "led by a board-certified OB-GYN.",
  );
});

test("meaning-bearing punctuation survives normalizing", () => {
  assert.equal(
    normalizeMetaText("IV protocols from $5,000.", "description"),
    "IV protocols from $5,000.",
  );
  assert.equal(
    normalizeMetaText("Can Stem Cells Help Knee Pain?", "title"),
    "Can Stem Cells Help Knee Pain?",
  );
});

test("normalizing tidies what the substitutions leave behind", () => {
  // Space before the question mark, and a pipe with no space around it.
  assert.equal(
    normalizeMetaText("Benefits, Treatment & Cost Explained ?", "title"),
    "Benefits, Treatment and Cost Explained?",
  );
  assert.equal(
    normalizeMetaText("Traditional Treatment |the Differences?", "title"),
    "Traditional Treatment | the Differences?",
  );
  // No dangling separator at either end.
  assert.equal(normalizeMetaText("— Clinics —", "title"), "Clinics");
});

test("normalizing is idempotent and leaves clean copy untouched", () => {
  for (const [text, kind] of [
    ["Stem Cell Clinics | My Stem Cell Guide", "title"],
    ["Search clinics, treatments, and conditions.", "description"],
    ["Umbilical Cord | Cord-Blood Therapy", "title"],
  ] as const) {
    assert.equal(normalizeMetaText(text, kind), text);
    assert.equal(normalizeMetaText(normalizeMetaText(text, kind), kind), text);
  }
});

test("every string buildMetadata emits obeys both rules", () => {
  const meta = buildMetadata({
    title: "Umbilical Cord / Cord-Blood Therapy clinics",
    description: "A guide to cord therapy — how it works & what it costs.",
    path: "/treatments/cord-blood-therapy",
    defaults: { titleTemplate: "%s · Brand" },
  });

  const title = (meta.title as { absolute: string }).absolute;
  assert.equal(
    title,
    "Umbilical Cord | Cord-Blood Therapy clinics | Brand",
    "title separators collapse to the pipe",
  );
  assert.equal(
    meta.description,
    "A guide to cord therapy, how it works and what it costs.",
  );

  const og = meta.openGraph as { title: string; description: string };
  const twitter = meta.twitter as { title: string; description: string };
  for (const value of [
    title,
    meta.description!,
    og.title,
    og.description,
    twitter.title,
    twitter.description,
  ])
    assert.ok(isMetaCompliant(value), `off-policy: ${value}`);
});

test("a CMS override is held to the same rules as route copy", () => {
  const meta = buildMetadata({
    seo: {
      metaTitle: "Docere Clinics: Cell Therapy — Park City",
      metaDescription: "Autologous & allogeneic protocols · since 2005.",
      ogTitle: "Docere — Park City",
      ogDescription: "Cell therapy in Utah — since 2005.",
    },
  });

  assert.equal(
    (meta.title as { absolute: string }).absolute,
    "Docere Clinics | Cell Therapy | Park City",
  );
  assert.equal(
    meta.description,
    "Autologous and allogeneic protocols, since 2005.",
  );
  const og = meta.openGraph as { title: string; description: string };
  assert.equal(og.title, "Docere | Park City");
  assert.equal(og.description, "Cell therapy in Utah, since 2005.");
});
