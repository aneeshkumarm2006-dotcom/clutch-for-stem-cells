/**
 * One-off companion to `_url-inventory.ts` — pulls the stored target keywords
 * and per-record SEO overrides that never reach `<meta name="keywords">`, so an
 * indexing sheet can carry a real target-keyword column instead of blanks.
 *
 *   SCRIPT_DNS=8.8.8.8,1.1.1.1 npx tsx scripts/_url-keywords.ts
 */
import dns from "node:dns";
if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));
else dns.setServers(["8.8.8.8", "1.1.1.1"]);

import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import {
  BlogPost,
  Treatment,
  Condition,
  Location,
  ClinicLanding,
  Page,
  SiteSetting,
} from "@/models";

async function loadEnv(): Promise<void> {
  const mod = await import("@next/env");
  (
    mod.loadEnvConfig ??
    (mod as unknown as { default?: { loadEnvConfig?: typeof mod.loadEnvConfig } })
      .default?.loadEnvConfig
  )?.(process.cwd());
}

async function main() {
  await loadEnv();
  await dbConnect();

  const out: Record<string, { keywords: string[]; focus?: string }> = {};

  const posts = await BlogPost.find()
    .select("slug keywords seo")
    .lean<any[]>();
  for (const p of posts) {
    out[`/blog/${p.slug}`] = {
      keywords: (p.keywords ?? []).map((k: any) => k.keyword).filter(Boolean),
      focus: p.seo?.focusKeyword ?? undefined,
    };
  }

  for (const [Model, prefix] of [
    [Treatment, "/treatments/"],
    [Condition, "/conditions/"],
  ] as const) {
    const docs = await (Model as any)
      .find()
      .select("slug seo name")
      .lean<any[]>();
    for (const d of docs)
      out[`${prefix}${d.slug}`] = {
        keywords: d.seo?.keywords ?? [],
        focus: d.seo?.focusKeyword ?? undefined,
      };
  }

  const locs = await Location.find()
    .select("slug seo kind parentId")
    .lean<any[]>();
  const countryBy = new Map(
    locs.filter((l) => l.kind === "country").map((l) => [String(l._id), l.slug]),
  );
  for (const l of locs) {
    const path =
      l.kind === "country"
        ? `/locations/${l.slug}`
        : `/locations/${countryBy.get(String(l.parentId))}/${l.slug}`;
    out[path] = {
      keywords: l.seo?.keywords ?? [],
      focus: l.seo?.focusKeyword ?? undefined,
    };
  }

  const landings = await ClinicLanding.find().select("slug seo").lean<any[]>();
  for (const l of landings)
    out[`/clinics/${l.slug}`] = {
      keywords: l.seo?.keywords ?? [],
      focus: l.seo?.focusKeyword ?? undefined,
    };

  const pages = await Page.find().select("slug seo").lean<any[]>();
  for (const p of pages)
    out[`/${p.slug}`] = {
      keywords: p.seo?.keywords ?? [],
      focus: p.seo?.focusKeyword ?? undefined,
    };

  // Site-wide: homepage keywords + every stored per-path pageSeo override.
  const setting = await SiteSetting.findOne().lean<any>();
  if (setting?.keywords?.length)
    out["/"] = { keywords: setting.keywords };
  if (setting?.pageSeo) {
    for (const [key, val] of Object.entries<any>(setting.pageSeo)) {
      if (val?.keywords?.length || val?.focusKeyword)
        out[`pageSeo:${key}`] = {
          keywords: val.keywords ?? [],
          focus: val.focusKeyword,
        };
    }
  }

  process.stdout.write(JSON.stringify(out, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
