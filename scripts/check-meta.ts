/**
 * Meta-tag policy check — enforces `lib/meta-text.ts` across the whole site.
 *
 *   1. no em dash (— – ― ‒ −) in any title or meta description
 *   2. `|` is the only separator symbol a meta tag may carry
 *
 * Nothing here is a hard-coded list of pages: each mode discovers what to check.
 *
 *   npx tsx scripts/check-meta.ts              # source + database (default)
 *   npx tsx scripts/check-meta.ts --source     # repo strings only, no DB
 *   npx tsx scripts/check-meta.ts --db         # stored CMS values only
 *   npx tsx scripts/check-meta.ts --db --fix   # rewrite the stored values
 *   npx tsx scripts/check-meta.ts --crawl [--url http://localhost:3000]
 *
 * `--source` walks every `.ts`/`.tsx` file with the TypeScript AST and checks
 * the string literals that become metadata (anything passed to `pageMetadata`/
 * `buildMetadata`, an `export const metadata` object, or a `metaTitle`/
 * `metaDescription` field), so a new page is covered the day it is written.
 *
 * `--db` reads every collection whose records render a title or description
 * and checks the stored value; `--fix` writes back the normalized string. Only
 * fields that ARE meta fields are rewritten — a taxonomy `name` or a page
 * `intro` is on-page copy and is reported, never edited, because
 * `buildMetadata` already normalizes it on the way into the `<head>`.
 *
 * `--crawl` is the end-to-end proof: it reads `/sitemap.xml` from a running
 * server, fetches every URL, and checks the rendered `<title>`, meta
 * description, and the OG/Twitter twins as a crawler would see them.
 *
 * Exit code is 1 when anything is off-policy, so this can gate a deploy.
 */
import dns from "node:dns";

if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));
else dns.setServers(["8.8.8.8", "1.1.1.1"]);

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import ts from "typescript";

import {
  findMetaIssues,
  normalizeMetaText,
  type MetaTextKind,
} from "@/lib/meta-text";

const ARGS = process.argv.slice(2);
const has = (flag: string): boolean => ARGS.includes(flag);
const argValue = (flag: string): string | undefined => {
  const i = ARGS.indexOf(flag);
  return i >= 0 ? ARGS[i + 1] : undefined;
};

const FIX = has("--fix");
const CRAWL = has("--crawl");
const ONLY_SOURCE = has("--source");
const ONLY_DB = has("--db");
const RUN_SOURCE = ONLY_SOURCE || (!ONLY_DB && !CRAWL);
const RUN_DB = ONLY_DB || (!ONLY_SOURCE && !CRAWL);
const BASE_URL = (argValue("--url") ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

const ROOT = process.cwd();

// ── Reporting ───────────────────────────────────────────────────────────────

interface Finding {
  /** Where the string lives: a file:line, a DB path, or a URL. */
  where: string;
  /** Which meta field it feeds. */
  field: string;
  kind: MetaTextKind;
  text: string;
  /** What the string becomes once the policy is applied. */
  suggested: string;
  rules: string[];
  chars: string[];
  /** Set when `--fix` rewrote a stored value. */
  fixed?: boolean;
  /**
   * On-page copy (an H1, a taxonomy name, a page intro) that a route falls back
   * to when no meta override is set. Informational, not a failure:
   * `buildMetadata` normalizes it on the way into the `<head>`, so the rendered
   * meta tag is compliant while the visible copy stays as authored.
   */
  derived?: boolean;
}

const findings: Finding[] = [];
let checked = 0;

/** Check one string; record a finding when it breaks either rule. */
function check(
  where: string,
  field: string,
  kind: MetaTextKind,
  text: string | null | undefined,
  derived = false,
): Finding | null {
  if (typeof text !== "string" || !text.trim()) return null;
  checked += 1;
  const issues = findMetaIssues(text);
  if (!issues.length) return null;

  const finding: Finding = {
    where,
    field,
    kind,
    text,
    suggested: normalizeMetaText(text, kind),
    rules: [...new Set(issues.map((i) => i.rule))],
    chars: [...new Set(issues.map((i) => `${i.char} (${i.codePoint})`))],
    derived,
  };
  findings.push(finding);
  return finding;
}

// ── 1. Source pass — every metadata string in the repo ──────────────────────

/** Directories that hold renderable code (node_modules/.next are skipped). */
const SOURCE_DIRS = ["app", "components", "config", "lib", "scripts"];
const SOURCE_EXT = /\.tsx?$/;

/** Property names that end up in a `<title>` or a meta description. */
const TITLE_FIELDS = new Set([
  "title",
  "metaTitle",
  "ogTitle",
  "twitterTitle",
  "titleTemplate",
  "template",
  "default",
  "absolute",
]);
const DESCRIPTION_FIELDS = new Set([
  "description",
  "metaDescription",
  "ogDescription",
  "twitterDescription",
]);

/**
 * Field names that are metadata wherever they appear — no context needed. The
 * generic ones (`title`, `description`, `template`) also name on-page copy, so
 * those are only checked inside a metadata context.
 */
const ALWAYS_META_FIELDS = new Set([
  "metaTitle",
  "metaDescription",
  "ogTitle",
  "ogDescription",
  "twitterTitle",
  "twitterDescription",
  "titleTemplate",
]);

/** Calls whose object argument is metadata by definition. */
const META_CALLS = new Set(["pageMetadata", "buildMetadata"]);
/** Variables/arrays that are metadata by definition. */
const META_IDENTIFIERS = new Set([
  "metadata",
  "STATIC_PAGES",
  "PAGE_SEO",
  "TREATMENT_SEO",
  "LANDINGS",
  "seoDefaults",
  "seo",
]);

function* walkFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walkFiles(full);
    else if (SOURCE_EXT.test(entry)) yield full;
  }
}

/**
 * The literal strings a metadata expression can evaluate to.
 *
 * A template literal keeps its literal spans with each `${}` hole stood in for
 * by `X` — an interpolated brand name cannot be resolved statically, but the
 * copy around it can still be ruled on. A conditional or `??` chain yields one
 * string per branch, since any branch can be the one that renders.
 */
function literalTexts(node: ts.Node): string[] {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return [node.text];
  if (ts.isTemplateExpression(node))
    return [
      node.head.text +
        node.templateSpans.map((s) => `X${s.literal.text}`).join(""),
    ];
  if (ts.isParenthesizedExpression(node)) return literalTexts(node.expression);
  // A conditional or `??`/`||` chain can render any of its branches.
  if (ts.isConditionalExpression(node))
    return [...literalTexts(node.whenTrue), ...literalTexts(node.whenFalse)];
  if (ts.isBinaryExpression(node))
    return [...literalTexts(node.left), ...literalTexts(node.right)];
  return [];
}

/** Is this property inside something we know renders as metadata? */
function inMetaContext(node: ts.Node, fileIsSeoScript: boolean): boolean {
  if (fileIsSeoScript) return true;
  for (let n: ts.Node | undefined = node; n; n = n.parent) {
    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : "";
      if (META_CALLS.has(name)) return true;
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) {
      if (META_IDENTIFIERS.has(n.name.text)) return true;
      // `export const generateMetadata = (...) => ({ title, description })`
      if (n.name.text === "generateMetadata") return true;
    }
    if (ts.isFunctionDeclaration(n) && n.name?.text === "generateMetadata") {
      return true;
    }
    if (
      ts.isPropertyAssignment(n) &&
      (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) &&
      META_IDENTIFIERS.has(n.name.text)
    ) {
      return true;
    }
  }
  return false;
}

/** Files whose whole point is SEO copy — every string in them is metadata. */
const SEO_SCRIPTS = [join("config", "static-pages.ts")];

function scanSources(): void {
  for (const dir of SOURCE_DIRS) {
    const abs = join(ROOT, dir);
    let exists = true;
    try {
      statSync(abs);
    } catch {
      exists = false;
    }
    if (!exists) continue;

    for (const file of walkFiles(abs)) {
      const rel = relative(ROOT, file);
      if (rel.includes(`${sep}check-meta.ts`) || rel.endsWith("meta-text.ts"))
        continue;
      const source = ts.createSourceFile(
        rel,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        rel.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      const isSeoScript = SEO_SCRIPTS.some((s) => rel.endsWith(s));

      const visit = (node: ts.Node): void => {
        if (
          ts.isPropertyAssignment(node) &&
          (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
        ) {
          const key = node.name.text;
          const isTitle = TITLE_FIELDS.has(key);
          const isDescription = DESCRIPTION_FIELDS.has(key);
          const isMeta =
            ALWAYS_META_FIELDS.has(key) || inMetaContext(node, isSeoScript);
          if ((isTitle || isDescription) && isMeta) {
            const { line } = source.getLineAndCharacterOfPosition(
              node.getStart(source),
            );
            for (const text of literalTexts(node.initializer)) {
              check(
                `${rel}:${line + 1}`,
                key,
                isTitle ? "title" : "description",
                text,
              );
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  }
}

// ── 2. Database pass — every stored string that can reach a meta tag ────────

/** `seo` sub-document fields, present on most content models. */
const SEO_FIELDS: [string, MetaTextKind][] = [
  ["metaTitle", "title"],
  ["ogTitle", "title"],
  ["metaDescription", "description"],
  ["ogDescription", "description"],
];

/**
 * Collections that render a public page, with the fields that can end up in
 * its `<head>`. `writable` fields are true meta fields (`--fix` rewrites them);
 * `derived` fields are on-page copy that a route falls back to when no meta
 * override exists — reported for visibility, never rewritten, because
 * `buildMetadata` normalizes them on the way out.
 */
const DB_SOURCES: {
  collection: string;
  label: string;
  derived: [string, MetaTextKind][];
  /** Extra `seo`-shaped sub-documents beyond the top-level `seo`. */
  seoPaths?: string[];
}[] = [
  {
    collection: "clinics",
    label: "clinic",
    derived: [
      ["name", "title"],
      ["tagline", "description"],
    ],
    seoPaths: ["seo", "reviewsPage.seo", "costPage.seo"],
  },
  {
    collection: "cliniclandings",
    label: "clinic landing",
    derived: [
      ["name", "title"],
      ["heading", "title"],
      ["intro", "description"],
    ],
  },
  {
    collection: "treatments",
    label: "treatment",
    derived: [
      ["name", "title"],
      ["shortDescription", "description"],
    ],
  },
  {
    collection: "conditions",
    label: "condition",
    derived: [
      ["name", "title"],
      ["shortDescription", "description"],
    ],
  },
  {
    collection: "cellsources",
    label: "cell source",
    derived: [
      ["name", "title"],
      ["shortDescription", "description"],
    ],
  },
  {
    collection: "accreditations",
    label: "accreditation",
    derived: [
      ["name", "title"],
      ["shortDescription", "description"],
    ],
  },
  {
    collection: "locations",
    label: "location",
    derived: [
      ["name", "title"],
      ["shortDescription", "description"],
    ],
  },
  {
    collection: "pages",
    label: "page",
    derived: [
      ["title", "title"],
      ["intro", "description"],
    ],
  },
  {
    collection: "blogposts",
    label: "blog post",
    derived: [
      ["title", "title"],
      ["excerpt", "description"],
    ],
    // `metaTitle` sits at the document root on a blog post, not under `seo`.
  },
  {
    collection: "matricespage",
    label: "combination page",
    derived: [
      ["title", "title"],
      ["intro", "description"],
    ],
  },
  {
    collection: "medicalreviewers",
    label: "reviewer",
    derived: [
      ["name", "title"],
      ["title", "description"],
    ],
  },
];

const get = (doc: Record<string, unknown>, path: string): unknown =>
  path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, doc);

async function scanDatabase(): Promise<void> {
  const envMod = await import("@next/env");
  const ns = envMod as unknown as {
    default?: { loadEnvConfig?: typeof envMod.loadEnvConfig };
    loadEnvConfig?: typeof envMod.loadEnvConfig;
  };
  (ns.default?.loadEnvConfig ?? ns.loadEnvConfig)?.(ROOT);

  const mongoose = (await import("mongoose")).default;
  const { dbConnect } = await import("@/lib/db");
  await dbConnect();
  const db = mongoose.connection.db!;

  // Site-wide defaults + the per-route overrides edited at /admin/seo.
  const settings = await db.collection("sitesettings").findOne({});
  if (settings) {
    const defaults = (settings.seoDefaults ?? {}) as Record<string, unknown>;
    const updates: Record<string, string> = {};

    const template = check(
      "sitesettings.seoDefaults",
      "titleTemplate",
      "title",
      defaults.titleTemplate as string,
    );
    if (template) updates["seoDefaults.titleTemplate"] = template.suggested;

    for (const [field, kind] of SEO_FIELDS) {
      const f = check(
        "sitesettings.seoDefaults",
        field,
        kind,
        defaults[field] as string,
      );
      if (f) updates[`seoDefaults.${field}`] = f.suggested;
    }

    const pageSeo = (settings.pageSeo ?? []) as Record<string, unknown>[];
    pageSeo.forEach((entry, i) => {
      for (const [field, kind] of SEO_FIELDS) {
        const f = check(
          `sitesettings.pageSeo[${entry.path}]`,
          field,
          kind,
          entry[field] as string,
        );
        if (f) updates[`pageSeo.${i}.${field}`] = f.suggested;
      }
    });

    if (FIX && Object.keys(updates).length) {
      await db
        .collection("sitesettings")
        .updateOne({ _id: settings._id }, { $set: updates });
      for (const f of findings)
        if (f.where.startsWith("sitesettings")) f.fixed = true;
    }
  }

  for (const source of DB_SOURCES) {
    const docs = await db.collection(source.collection).find({}).toArray();
    for (const doc of docs) {
      const id = (doc.slug as string) ?? String(doc._id);
      const where = `${source.collection}/${id}`;
      const updates: Record<string, string> = {};

      // True meta fields — rewritable.
      for (const seoPath of source.seoPaths ?? ["seo"]) {
        for (const [field, kind] of SEO_FIELDS) {
          const path = `${seoPath}.${field}`;
          const f = check(where, path, kind, get(doc, path) as string);
          if (f) updates[path] = f.suggested;
        }
      }
      // A blog post keeps its meta title at the root.
      if (source.collection === "blogposts") {
        const f = check(where, "metaTitle", "title", doc.metaTitle as string);
        if (f) updates.metaTitle = f.suggested;
      }
      // A combination page carries its own meta pair at the root too.
      if (source.collection === "matricespage") {
        for (const [field, kind] of [
          ["metaTitle", "title"],
          ["metaDescription", "description"],
        ] as [string, MetaTextKind][]) {
          const f = check(where, field, kind, doc[field] as string);
          if (f) updates[field] = f.suggested;
        }
      }

      // On-page copy a route falls back to — reported, never rewritten.
      for (const [field, kind] of source.derived) {
        check(
          `${where} (on-page copy)`,
          field,
          kind,
          doc[field] as string,
          true,
        );
      }

      if (FIX && Object.keys(updates).length) {
        await db
          .collection(source.collection)
          .updateOne({ _id: doc._id }, { $set: updates });
        for (const f of findings) if (f.where === where) f.fixed = true;
      }
    }
  }

  await mongoose.disconnect();
}

// ── 3. Crawl pass — the rendered `<head>` of every URL in the sitemap ───────

const decodeEntities = (s: string): string =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    );

function metaContent(html: string, selector: RegExp): string | undefined {
  const match = html.match(selector);
  return match ? decodeEntities(match[1]!.trim()) : undefined;
}

/**
 * Every fixed route in the app router, read off the file tree: a directory
 * holding a `page.tsx`, minus route groups like `(public)`. Segments with a
 * `[param]` are skipped — those pages are reached through the sitemap, which
 * lists the real slugs. This is what covers the routes a sitemap never
 * mentions: `/search`, `/account`, the auth pages, the admin shell.
 */
function staticRoutesFromAppRouter(): string[] {
  const appDir = join(ROOT, "app");
  const routes = new Set<string>();

  const walk = (dir: string, segments: string[]): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry.startsWith("[") || entry.startsWith("@")) continue;
        // `(public)` and friends group files without adding a URL segment.
        const isGroup = entry.startsWith("(") && entry.endsWith(")");
        walk(full, isGroup ? segments : [...segments, entry]);
      } else if (/^page\.tsx?$/.test(entry)) {
        routes.add(`/${segments.join("/")}`.replace(/\/+$/, "") || "/");
      }
    }
  };

  walk(appDir, []);
  return [...routes].sort();
}

async function crawl(): Promise<void> {
  const sitemapRes = await fetch(`${BASE_URL}/sitemap.xml`);
  if (!sitemapRes.ok)
    throw new Error(
      `GET ${BASE_URL}/sitemap.xml -> ${sitemapRes.status}. Is the site running?`,
    );
  const xml = await sitemapRes.text();
  const sitemapUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    // The sitemap is absolute against NEXT_PUBLIC_SITE_URL; crawl the host we
    // were pointed at so this works against dev, preview, or production.
    m[1]!.replace(/^https?:\/\/[^/]+/, BASE_URL),
  );
  if (!sitemapUrls.length) throw new Error("sitemap.xml listed no URLs");

  const urls = [
    ...new Set([
      ...sitemapUrls,
      ...staticRoutesFromAppRouter().map((r) => `${BASE_URL}${r}`),
      // A 404 renders its own metadata too.
      `${BASE_URL}/this-route-does-not-exist`,
    ]),
  ];

  console.log(
    `Crawling ${urls.length} URLs (${sitemapUrls.length} from sitemap.xml, ` +
      `the rest fixed routes from the app router)\n`,
  );

  for (const url of urls) {
    const res = await fetch(url, { headers: { "user-agent": "meta-check" } });
    // A 404 still renders metadata worth checking; anything else non-OK (a
    // gated admin route redirecting, say) has nothing of ours in its head.
    if (!res.ok && res.status !== 404) {
      console.log(`  skipped ${url} -> HTTP ${res.status}`);
      continue;
    }
    const html = await res.text();
    const path = url.replace(BASE_URL, "") || "/";

    const fields: [string, MetaTextKind, string | undefined][] = [
      [
        "<title>",
        "title",
        metaContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
      ],
      [
        'meta[name="description"]',
        "description",
        metaContent(
          html,
          /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
        ),
      ],
      [
        "og:title",
        "title",
        metaContent(
          html,
          /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i,
        ),
      ],
      [
        "og:description",
        "description",
        metaContent(
          html,
          /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
        ),
      ],
      [
        "twitter:title",
        "title",
        metaContent(
          html,
          /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']*)["']/i,
        ),
      ],
      [
        "twitter:description",
        "description",
        metaContent(
          html,
          /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']*)["']/i,
        ),
      ],
    ];

    for (const [field, kind, value] of fields) check(path, field, kind, value);
  }
}

// ── Report ──────────────────────────────────────────────────────────────────

function printGroup(list: Finding[]): void {
  const byWhere = new Map<string, Finding[]>();
  for (const f of list) {
    const group = byWhere.get(f.where) ?? [];
    group.push(f);
    byWhere.set(f.where, group);
  }
  for (const [where, group] of byWhere) {
    console.log(where);
    for (const f of group) {
      const tag = f.fixed ? "FIXED" : "     ";
      console.log(`  ${tag} ${f.field} [${f.chars.join(" ")}]`);
      console.log(`        - ${f.text}`);
      console.log(`        + ${f.suggested}`);
    }
    console.log("");
  }
}

function report(): void {
  const scopes =
    [RUN_SOURCE && "source", RUN_DB && "database", CRAWL && "rendered pages"]
      .filter(Boolean)
      .join(" + ") || "nothing";
  console.log(`\nChecked ${checked} meta strings across ${scopes}.`);

  const failures = findings.filter((f) => !f.derived && !f.fixed);
  const fixed = findings.filter((f) => f.fixed);
  const informational = findings.filter((f) => f.derived);

  if (failures.length) {
    const emDash = failures.filter((f) => f.rules.includes("em-dash")).length;
    const symbols = failures.filter((f) =>
      f.rules.includes("disallowed-symbol"),
    ).length;
    console.log(
      `FAIL — ${failures.length} meta field(s) off-policy ` +
        `(${emDash} with an em dash, ${symbols} with a disallowed symbol).\n`,
    );
    printGroup(failures);
  } else {
    console.log("PASS — no em dashes, no separator symbols other than `|`.\n");
  }

  if (fixed.length) {
    console.log(`Rewrote ${fixed.length} stored value(s):\n`);
    printGroup(fixed);
  }

  if (informational.length) {
    console.log(
      `${informational.length} on-page string(s) carry a symbol the meta rules ` +
        `ban. These are headings/names/intros, left as authored — a route that ` +
        `falls back to one still emits a normalized meta tag:\n`,
    );
    printGroup(informational);
  }

  if (failures.length && RUN_DB && !FIX)
    console.log("Re-run with --db --fix to write the suggested values.\n");
}

async function main(): Promise<void> {
  if (RUN_SOURCE) scanSources();
  if (RUN_DB) await scanDatabase();
  if (CRAWL) await crawl();
  report();
  process.exitCode = findings.some((f) => !f.fixed && !f.derived) ? 1 : 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
