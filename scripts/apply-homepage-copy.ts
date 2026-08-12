/**
 * Pushes the homepage's SEO copy refresh into `SiteSetting`.
 *
 * Most of the landing page renders straight from `HOMEPAGE_DEFAULTS`
 * (config/homepage.ts) because the stored overlay holds blank strings for those
 * fields, so editing the config is enough. Four pieces are different: they have
 * real stored values that win over the defaults, and only a write reaches them.
 *
 *   `hero.headline` / `hero.subhead`   legacy top-level storage, seeded in
 *   `homepage.faq.items`               stored by the admin form
 *   `homepage.keywords`                stored by the admin form
 *   `pageSeo["/"]`                     written by /admin/seo
 *
 * Everything it writes comes from `HOMEPAGE_DEFAULTS` (or the constants below)
 * so the config and the database cannot drift, and everything stays editable
 * afterwards at /admin/content/homepage and /admin/seo.
 *
 * Idempotent. Usage:
 *   npx tsx scripts/apply-homepage-copy.ts [--dry]
 */
import dns from "node:dns";
// Node's c-ares resolver refuses SRV queries in this environment even though
// the OS resolves them fine — point it at public DNS so mongodb+srv works.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import { dbConnect } from "@/lib/db";
import { GLOBAL_SETTINGS_KEY, SiteSetting, toPlainObject } from "@/models";
import { HOMEPAGE_DEFAULTS } from "@/config/homepage";
import { findMetaIssues, MAX_META_TITLE_LENGTH } from "@/lib/meta-text";

const DRY = process.argv.includes("--dry");

/** What a description may run to before a SERP truncates it. */
const MAX_META_DESCRIPTION_LENGTH = 160;

const HOME_SEO = {
  path: "/",
  metaTitle: "My Stem Cell Guide | Compare Stem Cell Clinics Worldwide",
  metaDescription:
    "My Stem Cell Guide compares stem cell clinics worldwide by treatment, condition, location, pricing, and verified patient reviews, all in one trusted directory.",
};

async function loadEnv(): Promise<void> {
  const mod = await import("@next/env");
  const ns = mod as unknown as {
    default?: { loadEnvConfig?: typeof mod.loadEnvConfig };
    loadEnvConfig?: typeof mod.loadEnvConfig;
  };
  const loadEnvConfig = ns.default?.loadEnvConfig ?? ns.loadEnvConfig;
  if (typeof loadEnvConfig === "function") loadEnvConfig(process.cwd());
}

/** Fail before writing rather than shipping a tag the audit will flag. */
function assertMetaIsClean(): void {
  const checks: [string, string, number][] = [
    ["title", HOME_SEO.metaTitle, MAX_META_TITLE_LENGTH],
    ["description", HOME_SEO.metaDescription, MAX_META_DESCRIPTION_LENGTH],
  ];
  for (const [label, text, max] of checks) {
    const issues = findMetaIssues(text);
    if (issues.length) {
      throw new Error(
        `meta ${label} is off-policy: ${issues
          .map((i) => `${i.rule} ${i.codePoint}`)
          .join(", ")}`,
      );
    }
    if (text.length > max) {
      throw new Error(
        `meta ${label} is ${text.length} chars, over the ${max} limit`,
      );
    }
    console.log(`  ok  meta ${label} (${text.length}/${max} chars)`);
  }
}

async function main() {
  await loadEnv();
  assertMetaIsClean();
  await dbConnect();

  const settings = await SiteSetting.getGlobal();
  const d = HOMEPAGE_DEFAULTS;

  // Preserve whatever else the SEO panel stored for `/` (noindex, OG image);
  // only the title and description are being replaced. `toPlainObject` is what
  // turns the Mongoose subdocument into something spreadable.
  const existingHome = (settings.pageSeo ?? []).find(
    (e) => e.path === HOME_SEO.path,
  );
  const pageSeo = [
    ...(settings.pageSeo ?? []).filter((e) => e.path !== HOME_SEO.path),
    { ...(toPlainObject(existingHome) ?? {}), ...HOME_SEO },
  ];

  const $set = {
    "hero.headline": d.hero.headline,
    "hero.subhead": d.hero.subhead,
    "homepage.faq.items": d.faq.items,
    "homepage.keywords": d.keywords,
    pageSeo,
  };

  if (!DRY) {
    await SiteSetting.updateOne(
      { key: GLOBAL_SETTINGS_KEY },
      { $set },
      { upsert: true },
    );
  }

  const log = (msg: string) => console.log(`${DRY ? "[dry] " : ""}${msg}`);
  log(`hero.headline       → "${d.hero.headline}"`);
  log(`hero.subhead        → "${d.hero.subhead.slice(0, 60)}..."`);
  log(`homepage.faq.items  → ${d.faq.items.length} questions`);
  for (const f of d.faq.items) log(`                      - ${f.question}`);
  log(`homepage.keywords   → ${d.keywords.join(", ")}`);
  log(`pageSeo["/"]        → "${HOME_SEO.metaTitle}"`);

  console.log(
    DRY
      ? "\nDry run — nothing written. Re-run without --dry to apply."
      : "\nDone. The homepage revalidates within 10 minutes (revalidate = 600).",
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
