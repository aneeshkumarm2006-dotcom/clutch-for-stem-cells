/**
 * Ad-hoc: dump the current stored state of the pages named in the
 * "extra sections" brief so a merged body/blocks file can be built from it.
 *
 *   npx tsx --conditions=react-server scripts/_dump-targets.ts
 */
import { writeFileSync } from "node:fs";
import dns from "node:dns";

if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));

import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import { BlogPost, Treatment, Condition, Location } from "@/models";

const BLOG = [
  "how-long-do-stem-cells-take-to-work-understanding-the-healing-timeline",
  "how-stem-cell-therapy-works-a-step-by-step-guide-to-the-science-behind-regenerative-medicine",
  "stem-cells-vs-prp-what-s-the-difference-and-which-treatment-is-right-for-you",
  "understanding-stem-cell-therapy-benefits-cost",
  "stem-cell-treatment-for-sma-what-patients-and-families-should-know",
  "stem-cell-shot-cost-what-determines-the-price-of-regenerative-therapy",
  "how-much-do-stem-cell-injections-cost",
];
const TREATMENTS = ["autologous-therapy", "cord-blood-therapy", "exosome-therapy", "msc-therapy"];
const CONDITIONS = ["joint-pain", "anti-aging-longevity"];
const LOCATIONS = ["usa"];

async function main() {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(process.cwd());
  await dbConnect();

  const out: Record<string, unknown> = {};

  for (const slug of BLOG) {
    const p = await BlogPost.findOne({ slug }).lean();
    out[`blog/${slug}`] = p
      ? {
          _id: String(p._id),
          title: p.title,
          visibility: (p as Record<string, unknown>).visibility ?? null,
          status: (p as Record<string, unknown>).status ?? null,
          bodyChars: (p.body ?? "").length,
          body: p.body,
        }
      : null;
  }

  const dumpTerm = async (model: typeof Treatment, kind: string, slugs: string[]) => {
    for (const slug of slugs) {
      const t = await model.findOne({ slug }).lean();
      const r = t as unknown as Record<string, unknown> | null;
      out[`${kind}/${slug}`] = r
        ? {
            _id: String(r._id),
            name: r.name,
            isActive: r.isActive,
            reviewStatus: r.reviewStatus,
            reviewedBy: r.reviewedBy ? String(r.reviewedBy) : null,
            description: r.description,
            body: r.body,
            faqs: r.faqs,
            blocks: r.blocks,
            seo: r.seo,
            clinicCount: r.clinicCount,
          }
        : null;
    }
  };

  await dumpTerm(Treatment, "treatments", TREATMENTS);
  await dumpTerm(Condition as unknown as typeof Treatment, "conditions", CONDITIONS);
  await dumpTerm(Location as unknown as typeof Treatment, "locations", LOCATIONS);

  writeFileSync("scripts/_targets-dump.json", JSON.stringify(out, null, 2));
  console.log("wrote scripts/_targets-dump.json");
  for (const [k, v] of Object.entries(out)) {
    console.log(`${v ? "✓" : "✗ MISSING"}  ${k}`);
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
