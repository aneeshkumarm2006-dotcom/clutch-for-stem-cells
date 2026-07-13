/**
 * Structured-data engine + modular content — behavioural tests.
 *
 * The engine core, the block→schema mapping, the validator, and `buildMetadata`
 * are all pure, so they can be exercised directly with no database. These assert
 * the guarantees the feature actually promises:
 *   - a page's blocks produce its JSON-LD (compose the page → get the schema)
 *   - malformed / incomplete nodes never reach the page
 *   - per-page overrides (disable / field / custom) do what they say
 *   - the extended per-page SEO fields land in the Next.js metadata
 *
 * Run: npx tsx --test tests/content-engine/engine.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildJsonLd, previewJsonLd } from "@/lib/schema/engine";
import { validateNode, dropInvalidNodes, parseCustomJsonLd } from "@/lib/schema/validate";
import { blocksToSchemaOrg } from "@/lib/blocks/schema";
import { blockSchema, blocksSchema } from "@/lib/validation/block";
import { buildMetadata, absoluteUrl } from "@/lib/seo";
import { SITE_URL } from "@/config/site";
import type { SchemaContext, JsonLd } from "@/lib/schema/types";
import type { BlockInput } from "@/lib/validation/block";

/**
 * URLs in emitted nodes come from `absoluteUrl()` (i.e. the `SITE_URL` build
 * constant), not from the context — the context carries *identity* (name, logo,
 * socials), not the origin. Assert against the same helper the engine uses so
 * these tests hold under any `NEXT_PUBLIC_SITE_URL`.
 */
const CTX: SchemaContext = {
  siteName: "TestSite",
  siteUrl: SITE_URL,
  logo: "/logo.png",
  sameAs: ["https://linkedin.com/company/x"],
  organizationType: "Organization",
  searchPath: "/search",
};

const typesOf = (nodes: JsonLd[]) => nodes.map((n) => n["@type"]);
const nodeOf = (nodes: JsonLd[], type: string) =>
  nodes.find((n) => n["@type"] === type);

// ── Schema-aware blocks ─────────────────────────────────────────────────────

test("an FAQ block emits FAQPage; a comparison block emits ItemList", () => {
  const blocks: BlockInput[] = [
    { type: "richText", data: { html: "<p>Prose carries no schema.</p>" } },
    {
      type: "faq",
      data: {
        title: "FAQ",
        items: [{ question: "Is it safe?", answer: "Ask your doctor." }],
      },
    },
    {
      type: "comparisonTable",
      data: {
        title: "Options",
        columns: ["Cost"],
        rows: [
          { label: "Option A", cells: ["$100"], url: "/a" },
          { label: "Option B", cells: ["$200"], url: undefined },
        ],
      },
    },
  ];

  const nodes = blocksToSchemaOrg(blocks);
  assert.deepEqual(typesOf(nodes), ["FAQPage", "ItemList"]);

  const faq = nodeOf(nodes, "FAQPage") as { mainEntity: unknown[] };
  assert.equal(faq.mainEntity.length, 1);

  const list = nodeOf(nodes, "ItemList") as {
    numberOfItems: number;
    itemListElement: { name: string; url?: string }[];
  };
  assert.equal(list.numberOfItems, 2);
  assert.equal(list.itemListElement[0]!.name, "Option A");
  assert.equal(list.itemListElement[0]!.url, absoluteUrl("/a"));
  // A row with no link must simply omit `url` rather than invent one.
  assert.equal("url" in list.itemListElement[1]!, false);
});

test("empty schema-aware blocks emit nothing rather than an empty node", () => {
  const blocks: BlockInput[] = [
    { type: "faq", data: { title: "FAQ", items: [] } },
    { type: "comparisonTable", data: { title: "X", columns: [], rows: [] } },
    // A half-filled FAQ row is not a valid Q&A pair.
    { type: "faq", data: { items: [{ question: "Q?", answer: "   " }] } },
  ];
  assert.deepEqual(blocksToSchemaOrg(blocks), []);
});

// ── The engine: composing a page produces its graph ──────────────────────────

const PAGE_BLOCKS: BlockInput[] = [
  {
    type: "faq",
    data: { items: [{ question: "How long?", answer: "About a week." }] },
  },
];

test("composing a page yields WebPage + the blocks' nodes", () => {
  const nodes = buildJsonLd(
    "page",
    {
      page: { name: "Recovery guide", description: "A guide.", path: "/recovery" },
      blocks: PAGE_BLOCKS,
    },
    CTX,
  );

  assert.deepEqual(typesOf(nodes), ["WebPage", "FAQPage"]);
  const page = nodeOf(nodes, "WebPage") as { url: string; name: string };
  assert.equal(page.url, absoluteUrl("/recovery"));
  assert.equal(page.name, "Recovery guide");
});

test("disabling a node removes it from the output", () => {
  const nodes = buildJsonLd(
    "page",
    { page: { name: "P", path: "/p" }, blocks: PAGE_BLOCKS },
    CTX,
    { disabledNodes: ["FAQPage"] },
  );
  assert.deepEqual(typesOf(nodes), ["WebPage"]);
});

test("a field override replaces one key without wiping the rest of the node", () => {
  const nodes = buildJsonLd(
    "page",
    { page: { name: "Original", description: "Kept", path: "/p" }, blocks: [] },
    CTX,
    { fieldOverrides: { WebPage: { name: "Overridden" } } },
  );

  const page = nodeOf(nodes, "WebPage") as {
    name: string;
    description: string;
    url: string;
  };
  assert.equal(page.name, "Overridden");
  // The override must not clobber the siblings.
  assert.equal(page.description, "Kept");
  assert.equal(page.url, absoluteUrl("/p"));
});

test("custom JSON-LD is appended, and invalid JSON is dropped rather than emitted", () => {
  const withCustom = buildJsonLd(
    "page",
    { page: { name: "P", path: "/p" }, blocks: [] },
    CTX,
    { customJsonLd: '{"@context":"https://schema.org","@type":"Event","name":"Webinar"}' },
  );
  assert.deepEqual(typesOf(withCustom), ["WebPage", "Event"]);

  // Malformed JSON must never reach the page.
  const broken = buildJsonLd(
    "page",
    { page: { name: "P", path: "/p" }, blocks: [] },
    CTX,
    { customJsonLd: "{ not json" },
  );
  assert.deepEqual(typesOf(broken), ["WebPage"]);
});

// ── Validation: nothing malformed reaches a crawler ─────────────────────────

test("a node missing a required field is an error and is stripped at render", () => {
  // A Review with no author + no rating is invalid per schema.org.
  const bad: JsonLd = { "@type": "Review", name: "Nice" };
  const issues = validateNode(bad);
  assert.equal(issues.filter((i) => i.level === "error").length, 2);

  const good: JsonLd = {
    "@type": "Review",
    author: { "@type": "Person", name: "A" },
    reviewRating: { "@type": "Rating", ratingValue: 5 },
  };
  assert.deepEqual(dropInvalidNodes([bad, good]), [good]);
});

test("AggregateRating requires both a value and a count", () => {
  const missingCount: JsonLd = {
    "@type": "AggregateRating",
    ratingValue: 4.5,
  };
  assert.ok(validateNode(missingCount).some((i) => i.level === "error"));

  const complete: JsonLd = {
    "@type": "AggregateRating",
    ratingValue: 4.5,
    reviewCount: 12,
  };
  assert.deepEqual(validateNode(complete), []);
});

test("preview reports issues instead of silently dropping the node", () => {
  const { nodes, issues } = previewJsonLd(
    "page",
    // No name → WebPage is invalid.
    { page: { name: "", path: "/p" }, blocks: [] },
    CTX,
  );
  // The editor must still SEE the broken node, with the reason.
  assert.equal(nodes.length, 1);
  assert.ok(issues.some((i) => i.level === "error" && /name/.test(i.message)));
});

test("preview flags unparseable custom JSON-LD as a blocking error", () => {
  const { issues } = previewJsonLd(
    "page",
    { page: { name: "P", path: "/p" }, blocks: [] },
    CTX,
    { customJsonLd: "{oops" },
  );
  assert.ok(issues.some((i) => i.level === "error"));
});

test("parseCustomJsonLd accepts an object or an array, rejects anything else", () => {
  assert.equal(parseCustomJsonLd('{"@type":"Thing"}')?.length, 1);
  assert.equal(parseCustomJsonLd('[{"@type":"A"},{"@type":"B"}]')?.length, 2);
  assert.equal(parseCustomJsonLd("[1,2]"), null);
  assert.equal(parseCustomJsonLd("nope"), null);
  assert.equal(parseCustomJsonLd(""), null);
});

// ── Block validation ────────────────────────────────────────────────────────

test("an unknown block type is rejected", () => {
  assert.equal(
    blockSchema.safeParse({ type: "nope", data: {} }).success,
    false,
  );
});

test("a block with a malformed payload is rejected", () => {
  // `cta` requires a title + buttonLabel + buttonHref.
  assert.equal(
    blockSchema.safeParse({ type: "cta", data: { title: "" } }).success,
    false,
  );
  assert.equal(
    blocksSchema.safeParse([
      { type: "richText", data: { html: "<p>ok</p>" } },
    ]).success,
    true,
  );
});

// ── Per-page SEO → <head> ───────────────────────────────────────────────────

test("per-page SEO overrides win over the derived values", () => {
  const meta = buildMetadata({
    title: "Derived title",
    description: "Derived description",
    path: "/thing",
    seo: {
      metaTitle: "Override title",
      metaDescription: "Override description",
      ogTitle: "Social title",
      ogDescription: "Social description",
      twitterCard: "summary",
      canonicalUrl: "https://example.com/canonical",
    },
    defaults: { titleTemplate: "%s | Brand" },
  });

  assert.equal((meta.title as { absolute: string }).absolute, "Override title | Brand");
  assert.equal(meta.description, "Override description");
  assert.equal(meta.alternates?.canonical, "https://example.com/canonical");
  assert.equal(meta.openGraph?.title, "Social title");
  assert.equal(meta.openGraph?.description, "Social description");
  assert.equal((meta.twitter as { card: string }).card, "summary");
});

test("OG copy falls back to the meta copy when not overridden", () => {
  const meta = buildMetadata({
    title: "T",
    description: "D",
    defaults: { titleTemplate: "%s" },
  });
  assert.equal(meta.openGraph?.title, "T");
  assert.equal(meta.openGraph?.description, "D");
  assert.equal((meta.twitter as { card: string }).card, "summary_large_image");
});

test("robots: granular index/follow resolve correctly", () => {
  // Fully indexable → emit no robots tag at all.
  assert.equal(buildMetadata({ title: "T" }).robots, undefined);

  // index:false via the granular control.
  const noIndex = buildMetadata({ title: "T", seo: { robots: { index: false } } });
  assert.deepEqual(noIndex.robots, { index: false, follow: true });

  // The legacy coarse flag still works.
  const legacy = buildMetadata({ title: "T", seo: { noindex: true } });
  assert.deepEqual(legacy.robots, { index: false, follow: true });

  // index, nofollow — expressible only via the new granular field.
  const noFollow = buildMetadata({ title: "T", seo: { robots: { follow: false } } });
  assert.deepEqual(noFollow.robots, { index: true, follow: false });

  // A thin/filtered route stays noindex, follow so equity still flows.
  const thin = buildMetadata({ title: "T", noindex: true });
  assert.deepEqual(thin.robots, { index: false, follow: true });
});
