/**
 * IndexNow — behavioural tests for `lib/indexnow.ts`.
 *
 * What is worth testing here is the filtering, not the HTTP call: submitting a
 * `noindex` URL wastes the signal, and submitting a single off-host URL makes
 * the engines reject the whole batch. Both are silent failures in production,
 * so the predicates are pure and tested directly — same reasoning as
 * `indexation.test.ts`, which guards the other half of the same policy.
 *
 * Run: npx tsx --tsconfig tsconfig.test.json --test tests/content-engine/indexnow.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// `config/site.ts` reads NEXT_PUBLIC_SITE_URL when it is first evaluated, so
// the host under test has to be set before the module graph loads. A static
// import is hoisted above this assignment, so the module is pulled in lazily
// instead — and once, since the loader caches it.
process.env.NEXT_PUBLIC_SITE_URL = "https://example.test";

const indexnow = import("@/lib/indexnow");

// ── normalizeIndexNowUrls ───────────────────────────────────────────────────

test("root-relative paths become absolute URLs on our host", async () => {
  const { normalizeIndexNowUrls } = await indexnow;
  assert.deepEqual(normalizeIndexNowUrls("/blog/my-post"), [
    "https://example.test/blog/my-post",
  ]);
  assert.deepEqual(normalizeIndexNowUrls(["/", "/clinics"]), [
    "https://example.test/",
    "https://example.test/clinics",
  ]);
});

test("an already-absolute URL on our host passes through", async () => {
  const { normalizeIndexNowUrls } = await indexnow;
  assert.deepEqual(normalizeIndexNowUrls("https://example.test/clinic/acme"), [
    "https://example.test/clinic/acme",
  ]);
});

test("duplicates collapse, including across path and absolute forms", async () => {
  const { normalizeIndexNowUrls } = await indexnow;
  assert.deepEqual(
    normalizeIndexNowUrls([
      "/blog",
      "/blog",
      "https://example.test/blog",
      " /blog ",
    ]),
    ["https://example.test/blog"],
  );
});

test("faceted and fragment URLs are dropped as non-canonical", async () => {
  const { normalizeIndexNowUrls } = await indexnow;
  // These render `noindex, follow` with a canonical back to the clean path.
  assert.deepEqual(normalizeIndexNowUrls("/clinics?country=mexico"), []);
  assert.deepEqual(normalizeIndexNowUrls("/clinics?page=2"), []);
  assert.deepEqual(normalizeIndexNowUrls("/clinics#results"), []);
});

test("private prefixes are dropped", async () => {
  const { normalizeIndexNowUrls } = await indexnow;
  for (const path of [
    "/admin",
    "/admin/clinics",
    "/api/seoteam/posts",
    "/auth/signin",
    "/account",
    "/seoteam",
    "/analyticshub",
    "/r/abc123",
  ]) {
    assert.deepEqual(
      normalizeIndexNowUrls(path),
      [],
      `expected ${path} dropped`,
    );
  }
});

test("off-host URLs are dropped, which is what keeps a batch from 422ing", async () => {
  const { normalizeIndexNowUrls } = await indexnow;
  assert.deepEqual(normalizeIndexNowUrls("https://evil.test/blog"), []);
  assert.deepEqual(normalizeIndexNowUrls(["https://evil.test/blog", "/blog"]), [
    "https://example.test/blog",
  ]);
});

test("empty and malformed input yields an empty list, never a throw", async () => {
  const { normalizeIndexNowUrls } = await indexnow;
  assert.deepEqual(normalizeIndexNowUrls([]), []);
  assert.deepEqual(normalizeIndexNowUrls(""), []);
  assert.deepEqual(normalizeIndexNowUrls(["", "   "]), []);
  assert.deepEqual(normalizeIndexNowUrls("http://"), []);
});

test("an explicit host overrides the configured one", async () => {
  const { normalizeIndexNowUrls } = await indexnow;
  assert.deepEqual(
    normalizeIndexNowUrls("https://other.test/blog", { host: "other.test" }),
    ["https://other.test/blog"],
  );
});

// ── chunkUrls ───────────────────────────────────────────────────────────────

test("a list at or under the cap is one batch", async () => {
  const { chunkUrls } = await indexnow;
  assert.deepEqual(chunkUrls(["/a", "/b"]), [["/a", "/b"]]);
  assert.deepEqual(chunkUrls([]), []);
});

test("a list over the cap splits without losing or duplicating a URL", async () => {
  const { MAX_URLS_PER_REQUEST, chunkUrls } = await indexnow;
  const urls = Array.from({ length: 25_000 }, (_, i) => `/p/${i}`);
  const chunks = chunkUrls(urls);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0]!.length, MAX_URLS_PER_REQUEST);
  assert.equal(chunks[2]!.length, 5_000);
  assert.deepEqual(chunks.flat(), urls);
});

// ── indexNowConfig ──────────────────────────────────────────────────────────

test("no key means disabled, not an error", async () => {
  const { indexNowConfig } = await indexnow;
  const key = process.env.INDEXNOW_KEY;
  delete process.env.INDEXNOW_KEY;
  const result = indexNowConfig({ force: true });
  assert.equal(result.config, null);
  if (key !== undefined) process.env.INDEXNOW_KEY = key;
});

test("non-production is disabled unless forced", async () => {
  const { indexNowConfig } = await indexnow;
  const { INDEXNOW_KEY: key, VERCEL_ENV: env } = process.env;
  process.env.INDEXNOW_KEY = "test-key";
  process.env.VERCEL_ENV = "preview";

  assert.equal(indexNowConfig().config, null);

  const forced = indexNowConfig({ force: true });
  assert.deepEqual(forced.config, {
    key: "test-key",
    host: "example.test",
    keyLocation: "https://example.test/test-key.txt",
  });

  process.env.VERCEL_ENV = "production";
  assert.equal(indexNowConfig().config?.host, "example.test");

  if (key === undefined) delete process.env.INDEXNOW_KEY;
  else process.env.INDEXNOW_KEY = key;
  if (env === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = env;
});
