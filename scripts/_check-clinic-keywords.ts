/**
 * Ad-hoc audit: does every clinic in the DB end up with a `<meta name="keywords">`?
 * Usage: npx tsx scripts/_check-clinic-keywords.ts
 */
import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import { dbConnect } from "@/lib/db";
import { Clinic } from "@/models";
import { clinicKeywords, clinicReviewsKeywords } from "@/lib/clinic-meta";

async function loadEnv(): Promise<void> {
  const mod = await import("@next/env");
  const ns = mod as unknown as {
    default?: { loadEnvConfig?: typeof mod.loadEnvConfig };
    loadEnvConfig?: typeof mod.loadEnvConfig;
  };
  const loadEnvConfig = ns.default?.loadEnvConfig ?? ns.loadEnvConfig;
  if (typeof loadEnvConfig === "function") loadEnvConfig(process.cwd());
}

async function main() {
  await loadEnv();
  await dbConnect();

  const clinics = await Clinic.find(
    {},
    { name: 1, slug: 1, status: 1, seo: 1, reviewsPage: 1 },
  )
    .sort({ name: 1 })
    .lean();

  console.log(`\nCLINICS IN DB: ${clinics.length}`);

  const missing: string[] = [];
  const missingReviews: string[] = [];
  let storedSeoKeywords = 0;

  for (const c of clinics) {
    const kw = clinicKeywords({ name: c.name });
    const rkw = clinicReviewsKeywords({ name: c.name });
    const ok = kw.length > 0 && kw.every((k) => k && k.trim().length > 0);
    const rok = rkw.length > 0 && rkw.every((k) => k && k.trim().length > 0);
    if (!ok) missing.push(`${c.slug} (${c.status})`);
    if (!rok) missingReviews.push(`${c.slug} (${c.status})`);
    // any stored override object on the doc, for information
    const seo = c.seo as Record<string, unknown> | undefined;
    if (seo && "keywords" in seo) storedSeoKeywords++;
  }

  console.log(`\nprofile keywords present : ${clinics.length - missing.length}/${clinics.length}`);
  console.log(`reviews keywords present : ${clinics.length - missingReviews.length}/${clinics.length}`);
  console.log(`docs carrying a stored seo.keywords field: ${storedSeoKeywords}`);

  if (missing.length) console.log(`\nMISSING (profile):\n- ${missing.join("\n- ")}`);
  if (missingReviews.length)
    console.log(`\nMISSING (reviews):\n- ${missingReviews.join("\n- ")}`);

  console.log("\nSample:");
  for (const c of clinics.slice(0, 100)) {
    console.log(
      `- [${c.status}] ${c.slug} -> keywords="${clinicKeywords({ name: c.name }).join(", ")}" | reviews="${clinicReviewsKeywords({ name: c.name }).join(", ")}"`,
    );
  }

  await (await import("mongoose")).default.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
