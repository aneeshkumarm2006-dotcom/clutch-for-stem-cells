/**
 * Ad-hoc: audit every stored Google highlight for the failure modes the scrape
 * can produce silently.
 *
 * The one that matters is a trailing ellipsis on a quote nobody meant to trim:
 * Maps ships review bodies collapsed behind a "See more" button, and reading a
 * node before that click lands captures a stranger's sentence cut in half.
 */
import dns from "node:dns";
if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));

import { dbConnect } from "@/lib/db";
import { Clinic } from "@/models";

async function main() {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(process.cwd());
  await dbConnect();

  const clinics = await Clinic.find({
    isDeleted: { $ne: true },
    "externalReviews.google.highlights.0": { $exists: true },
  })
    .select("slug name externalReviews")
    .sort({ slug: 1 })
    .lean();

  let quotes = 0;
  const issues: string[] = [];

  for (const c of clinics) {
    const hs = c.externalReviews?.google?.highlights ?? [];
    quotes += hs.length;
    const ratings = hs.map((h) => h.rating ?? 0);
    if (hs.length >= 2 && ratings.every((r) => r >= 4)) {
      issues.push(
        `~ ${c.slug}: all ${hs.length} quotes are 4-5 star (praise only)`,
      );
    }
    for (const h of hs) {
      const t = h.text ?? "";
      if (/…$/.test(t))
        issues.push(`… ${c.slug}: "${h.author}" ends in an ellipsis`);
      if (!/[.!?"')\]]$/.test(t.replace(/…$/, "")))
        issues.push(
          `? ${c.slug}: "${h.author}" ends mid-sentence: ...${t.slice(-45)}`,
        );
      if (!h.author?.trim()) issues.push(`! ${c.slug}: a quote has no author`);
      if (t.length > 600)
        issues.push(`! ${c.slug}: "${h.author}" is ${t.length} chars`);
      if (!h.publishedAt && !h.publishedLabel)
        issues.push(`- ${c.slug}: "${h.author}" has no date`);
    }
  }

  console.log(
    `${clinics.length} clinic(s) carry quotes, ${quotes} quote(s) total\n`,
  );
  console.log(issues.length ? issues.join("\n") : "No issues found.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
