# Structured-Data Engine & Modular Content/SEO Layer

Two additive upgrades, both driven by **one config file**:

1. **Structured-data engine** — every public page emits valid, server-rendered
   schema.org JSON-LD, auto-selected by content type, with full per-page override
   in the admin.
2. **Modular content & per-page SEO** — non-technical editors compose pages from
   reusable blocks and control per-page SEO, instead of filling fixed forms.

---

## 1. The config file (the portability seam)

**`config/content-engine.ts`** is the only file that knows what this site is
*about*. It holds:

| Key | What it controls |
|---|---|
| `siteIdentity` | Name, logo, `sameAs` socials, default OG image, publisher `@type`. Build-time fallback — admin Settings overlay it at runtime. |
| `contentTypes` | The content-type → schema.org-node map. Each entry declares the `@type`s it may emit and the builder that produces them. |
| `blocks` | Which block types editors may compose pages from. |
| `seoDefaults` | Global title template, Twitter card, robots. |

The engine core (`lib/schema/engine.ts`, `validate.ts`, `types.ts`) contains **no
domain concept** — it never mentions a clinic or a treatment. The functions that
read *this app's* model shapes live in one adapter file
(`lib/schema/adapters.ts`).

### Porting to another dashboard

> Run discovery on the new repo, then rewrite **`config/content-engine.ts`** (site
> identity, the content-type→schema-node map, the enabled block list, SEO
> defaults) and its thin companion **`lib/schema/adapters.ts`** (map the new
> repo's models onto the generic node builders). The engine core, the shared
> `<SchemaPanel>` / `<SeoPanel>` / `<BlockEditor>` components, the `Page` and
> `Redirect` models, the block registry, and the migration all carry over
> unchanged — no site-specific concept lives in engine code, so a new dashboard
> is a config edit, not a fork.

---

## 2. Structured-data engine

### How a page gets its JSON-LD

```ts
const ctx = await getSchemaContext();          // identity: Settings → config fallback
const jsonLd = buildJsonLd(
  "clinic",                                     // content type (key in the config)
  { clinic: clinic.raw, reviews },              // the record
  ctx,
  clinic.raw.schemaOverrides,                   // the editor's per-page overrides
);
return <JsonLd data={jsonLd} />;                // server-rendered <script type="application/ld+json">
```

`buildJsonLd` looks the type up in the config, runs its builder (which delegates
to the existing generators in `lib/seo.ts` — the engine adds orchestration, it
does not re-implement a single node), applies the record's overrides, then
**drops any node that fails its required-field rules**. A malformed node can
never reach a crawler.

### Site-wide base schema

`<BaseSchema>` is mounted once in `app/(public)/layout.tsx`, so **every** public
page carries `Organization` + `WebSite` (+ `SearchAction`), linked by stable
`@id`s into one connected graph. Identity comes from admin Settings, so changing
the logo or adding a social profile updates every page with no deploy.

### Content-type map (as shipped)

| Content type | Emits |
|---|---|
| `clinic` | `MedicalClinic` (+ nested `AggregateRating`) + `Review` |
| `blogPost` | `BlogPosting` |
| `taxonomyTerm` / `matrixPage` | `MedicalWebPage` + `FAQPage` + `ItemList` |
| `directory` | `CollectionPage` + `ItemList` |
| `page` | `WebPage` + whatever its blocks contribute |
| `reviewer` | `Person` |
| `faqPage` | `WebPage` + `FAQPage` |

`BreadcrumbList` is deliberately **not** in the map: the shared `<Breadcrumbs>`
component emits it alongside the visible trail, which keeps the UI and the markup
impossible to desync. Emitting it here too would put two on every page.

### The admin schema panel

`<SchemaPanel>` drops into any record editor. It gives the editor:

- a **live preview** of the exact JSON-LD the page will emit (built by the server
  running the *real* engine — never a browser re-implementation, which would
  drift);
- **per-node on/off toggles**;
- **field overrides** on any auto-filled scalar;
- a **custom JSON-LD** box for advanced cases;
- **validation** — missing required fields are blocking errors (the editor cannot
  save), missing recommended fields are warnings.

---

## 3. Modular content & per-page SEO

### Blocks

A `Page` is an ordered list of typed blocks. Shipped set: `richText`, `faq`,
`comparisonTable`, `featureGrid`, `prosCons`, `cta`, `media`, `rawHtml`.

**Schema-aware blocks wire themselves into the engine**: an `faq` block emits
`FAQPage`, a `comparisonTable` emits an `ItemList`. Editors get structured data
*for free* by composing the page — the badge in the editor marks which blocks do
this.

**Adding a block type** is an isolated, three-line change:
1. add its schema to `lib/validation/block.ts` (the discriminated union),
2. add its renderer to `components/blocks/renderers.tsx` and a `case` in
   `block-renderer.tsx` + `block-editor.tsx` (both switches are exhaustive, so a
   missing case is a **compile error**, not a blank space on a live page),
3. list it in `config/content-engine.ts`.

Optionally map it to a schema.org node in `lib/blocks/schema.ts`.

### Editor UX

`/seoteam/pages` — add / remove / **reorder** (up-down buttons: keyboard- and
screen-reader-accessible, no new dependency, works on touch), each block with its
own small form, live SERP + OG previews, and the schema panel.

### Per-page SEO

The shared embedded `seo` sub-document now carries: `metaTitle`,
`metaDescription`, `ogImage`, `canonicalUrl`, `noindex`, **`ogTitle`**,
**`ogDescription`**, **`twitterCard`**, **`focusKeyword`**, **`robots {index, follow}`**.

Every added field is optional, so **existing documents keep resolving exactly as
before**. Precedence is unchanged: per-page `seo` → `SiteSetting.seoDefaults` →
`config/site.ts`.

### Redirects

`/admin/redirects` (Admin+, audited). Renaming a page in the CMS **records its
301 automatically**, so a renamed page never orphans its old URL.

Redirects resolve server-side at the moment a URL fails to resolve (the catch-all
route + the dynamic content routes) — *not* in Edge middleware, which cannot open
a Mongoose connection and would tax every request on the site to serve a handful
of rules. A live page always wins over a redirect pointing at it.

---

## 4. Migration

```bash
npm run migrate              # apply
npm run migrate -- --dry     # report, change nothing
npm run migrate -- --down    # roll back (refuses to destroy content without --force)
```

`up` creates indexes for the two new collections and pre-fills the structured-data
settings. **There is no backfill**: every added field is optional and MongoDB is
schemaless, so existing documents already read correctly without them — the risky
part of a migration simply doesn't exist here.

`down` drops `pages` + `redirects` and `$unset`s every field this feature added,
returning each document to its exact pre-migration shape. Because `up` renames and
removes nothing, `down` is a genuine inverse.

---

## 5. QA checklist

| Check | Status |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run lint` | ✅ clean |
| `npx next build` (against a live DB) | ✅ green, all 66 pages generated |
| `npm test` | ✅ 28/28 (16 engine + 12 DB round-trip) |
| JSON-LD is **server-rendered** (present in prerendered HTML, not client-injected) | ✅ verified in `.next/server/app/*.html` |
| `Organization` + `WebSite` on **every** public page (was: homepage only) | ✅ verified on `/`, `/faq`, `/about`, `/privacy` |
| Connected graph — `WebSite.publisher` → `Organization` via stable `@id` | ✅ |
| Missing fields **omitted**, never emitted as `null` | ✅ (logo/`sameAs` absent when unset) |
| Blocks reorder + save; FAQ block → `FAQPage`, comparison → `ItemList` | ✅ covered by tests |
| Per-page SEO overrides render into `<head>` | ✅ covered by tests |
| Invalid JSON-LD blocks saving; invalid nodes stripped at render | ✅ covered by tests |
| Block HTML sanitized (scripts stripped) | ✅ covered by tests |
| Reserved slugs cannot shadow a real route | ✅ covered by tests |
| Redirect chains collapse; cycles terminate | ✅ covered by tests |
| Migration up → down round-trip | ✅ run against a live DB |
| No existing route, model, or admin screen broken | ✅ build + typecheck + existing tests green |

**Still to do by hand** (needs a public URL, so it can't be automated here):
validate a sample of each page type in [Google's Rich Results
Test](https://search.google.com/test/rich-results) and the [Schema Markup
Validator](https://validator.schema.org/) once deployed, and confirm
rich-result eligibility.
