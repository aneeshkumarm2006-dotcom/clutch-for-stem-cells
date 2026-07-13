/**
 * Structured-data engine + modular content — database round-trip.
 *
 * Runs against a real (in-memory) MongoDB so the parts the pure tests can't
 * reach are actually exercised: the Page model's block persistence, the public
 * read layer, the reserved-slug guard, redirect resolution, and the sanitizer.
 *
 * Run: npx tsx --test tests/content-engine/db.test.ts
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// Models don't open a connection on import, so static imports are safe here —
// `before()` establishes the connection that `dbConnect()` then reuses.
import { Page, Redirect } from "@/models";
import {
  getApprovedPage,
  getPageSitemapEntries,
  isReservedSlug,
} from "@/lib/seoteam/page-data";
import { blocksFaqs, blocksScanText, sanitizeBlocks } from "@/lib/blocks/server";
import { buildJsonLd } from "@/lib/schema/engine";
import { resolveRedirect } from "@/lib/redirects";
import { normalizePath } from "@/lib/validation/redirect";
import type { BlockInput } from "@/lib/validation/block";
import type { SchemaContext, JsonLd } from "@/lib/schema/types";

let mongo: MongoMemoryServer;

before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const CTX: SchemaContext = {
  siteName: "TestSite",
  siteUrl: "http://localhost:3000",
  sameAs: [],
  organizationType: "Organization",
};

const BLOCKS: BlockInput[] = [
  { type: "richText", data: { html: "<p>Body copy.</p>" } },
  {
    type: "faq",
    data: { items: [{ question: "Is it safe?", answer: "Consult a doctor." }] },
  },
];

test("a composed page round-trips through Mongo with its blocks intact", async () => {
  await Page.create({
    title: "Recovery guide",
    slug: "recovery-guide",
    intro: "A short answer-first summary of what recovery looks like.",
    blocks: BLOCKS,
    reviewStatus: "approved",
    reviewedBy: new mongoose.Types.ObjectId(),
    publishedAt: new Date(),
  });

  const page = await getApprovedPage("recovery-guide");
  assert.ok(page, "the approved page should be readable");
  assert.equal(page.title, "Recovery guide");
  assert.equal(page.path, "/recovery-guide");
  assert.equal(page.blocks.length, 2);
  assert.equal(page.blocks[0]!.type, "richText");
  assert.equal(page.blocks[1]!.type, "faq");
});

test("the page's blocks drive its JSON-LD end to end", async () => {
  const page = await getApprovedPage("recovery-guide");
  assert.ok(page);

  const nodes: JsonLd[] = buildJsonLd(
    "page",
    {
      page: {
        name: page.title,
        description: page.intro,
        path: page.path,
        datePublished: page.publishedAt,
        dateModified: page.updatedAt,
      },
      blocks: page.blocks,
    },
    CTX,
    page.schemaOverrides,
  );

  const types = nodes.map((n) => n["@type"]);
  assert.deepEqual(types, ["WebPage", "FAQPage"]);

  const faq = nodes.find((n) => n["@type"] === "FAQPage") as {
    mainEntity: { name: string }[];
  };
  assert.equal(faq.mainEntity[0]!.name, "Is it safe?");
});

test("a draft page is not publicly readable", async () => {
  await Page.create({
    title: "Unfinished",
    slug: "unfinished",
    blocks: [],
    reviewStatus: "draft",
  });
  assert.equal(await getApprovedPage("unfinished"), null);
});

test("only approved pages enter the sitemap", async () => {
  const entries = await getPageSitemapEntries();
  const paths = entries.map((e) => e.path);
  assert.ok(paths.includes("/recovery-guide"));
  assert.ok(!paths.includes("/unfinished"));
});

test("reserved slugs are refused, so a page can never shadow a real route", () => {
  assert.equal(isReservedSlug("blog"), true);
  assert.equal(isReservedSlug("clinics"), true);
  assert.equal(isReservedSlug("Admin"), true); // case-insensitive
  assert.equal(isReservedSlug("recovery-guide"), false);
});

test("a reserved slug is unreadable even if one is forced into the DB", async () => {
  await Page.create({
    title: "Shadow",
    slug: "blog",
    blocks: [],
    reviewStatus: "approved",
  });
  // The real /blog route must always win.
  assert.equal(await getApprovedPage("blog"), null);
});

// ── Sanitization + the YMYL scanner ─────────────────────────────────────────

test("block HTML is sanitized — scripts never survive a save", () => {
  const dirty: BlockInput[] = [
    {
      type: "richText",
      data: { html: '<p>Safe</p><script>alert("xss")</script>' },
    },
  ];
  const clean = sanitizeBlocks(dirty);
  const html = (clean[0]!.data as { html: string }).html;
  assert.ok(!/<script/i.test(html), "script tag must be stripped");
  assert.ok(/Safe/.test(html), "legitimate content must survive");
});

test("block text is exposed to the cure/guarantee scanner", () => {
  const blocks: BlockInput[] = [
    { type: "richText", data: { html: "<p>This will <b>cure</b> you.</p>" } },
    { type: "faq", data: { items: [{ question: "Q?", answer: "A." }] } },
  ];
  const text = blocksScanText(blocks);
  // Tags stripped, prose preserved — otherwise a claim inside markup would
  // sail past the approval gate.
  assert.ok(/cure/.test(text));
  assert.ok(!/<b>/.test(text));

  assert.equal(blocksFaqs(blocks).length, 1);
});

// ── Redirects ───────────────────────────────────────────────────────────────

test("normalizePath lowercases, strips query/hash and the trailing slash", () => {
  assert.equal(normalizePath("/Old-Page/"), "/old-page");
  assert.equal(normalizePath("/a?b=1#c"), "/a");
  assert.equal(normalizePath("/"), "/");
});

test("a redirect chain collapses to its final destination", async () => {
  await Redirect.create({ from: "/a", to: "/b", statusCode: 301 });
  await Redirect.create({ from: "/b", to: "/c", statusCode: 301 });
  await Redirect.create({ from: "/loop-x", to: "/loop-y", statusCode: 301 });
  await Redirect.create({ from: "/loop-y", to: "/loop-x", statusCode: 301 });

  const hit = await resolveRedirect("/a");
  assert.ok(hit);
  // One hop for the browser, not three.
  assert.equal(hit.to, "/c");
  assert.equal(hit.statusCode, 301);
});

test("a redirect cycle terminates instead of hanging", async () => {
  const hit = await resolveRedirect("/loop-x");
  // It must return *something* and, crucially, return at all.
  assert.ok(hit);
});

test("an unknown path has no redirect", async () => {
  assert.equal(await resolveRedirect("/nothing-here"), null);
});
