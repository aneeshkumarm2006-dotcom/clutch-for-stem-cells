/**
 * Ad-hoc: read back what `externalReviews` actually holds, so the import can be
 * checked against the source file rather than against the importer's own log.
 * Usage: npx tsx scripts/_verify-reputation.ts
 */
import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import { dbConnect } from "@/lib/db";
import { Clinic } from "@/models";

async function main() {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(process.cwd());
  await dbConnect();

  const clinics = await Clinic.find({ isDeleted: { $ne: true } })
    .select("name slug externalReviews")
    .sort({ slug: 1 })
    .lean();

  let withGoogle = 0;
  let withReddit = 0;
  let withRating = 0;
  const dashes: string[] = [];

  for (const c of clinics) {
    const g = c.externalReviews?.google;
    const r = c.externalReviews?.reddit;
    if (g) withGoogle++;
    if (r) withReddit++;
    if (g?.rating != null) withRating++;

    for (const s of [g?.summary, r?.summary, ...(g?.themes ?? []), ...(r?.themes ?? [])]) {
      if (typeof s === "string" && /[—–]/.test(s)) dashes.push(c.slug);
    }

    console.log(
      `${c.slug.padEnd(42)} G:${String(g?.rating ?? "-").padEnd(4)}${String(g?.reviewCount ?? "-").padEnd(6)} R:${(r?.sentiment ?? "-").padEnd(9)}${r?.threadCount ?? "-"}t/${r?.sources?.length ?? 0}src`,
    );
  }

  console.log(
    `\nclinics=${clinics.length} google=${withGoogle} (rating=${withRating}) reddit=${withReddit} dashViolations=${dashes.length}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
