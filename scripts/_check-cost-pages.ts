/**
 * Ad-hoc: how much cost-page content each clinic actually has.
 * Usage: npx tsx scripts/_check-cost-pages.ts
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
    .select("name slug status priceMin priceMax costPage")
    .sort({ slug: 1 })
    .lean();

  let noCostPage = 0;
  let emptyItems = 0;
  let withItems = 0;

  for (const c of clinics) {
    const cp = c.costPage;
    const items = cp?.items?.length ?? 0;
    const hasProse = Boolean(
      cp?.intro || cp?.introEmpty || cp?.bodyMarkdown || cp?.insuranceNote,
    );
    const faqs = cp?.faqs?.length ?? 0;
    const range =
      c.priceMin != null || c.priceMax != null
        ? `${c.priceMin ?? "?"}-${c.priceMax ?? "?"}`
        : "-";

    if (!cp) noCostPage++;
    else if (items === 0) emptyItems++;
    else withItems++;

    console.log(
      `${c.slug.padEnd(42)} items:${String(items).padEnd(3)} faqs:${String(faqs).padEnd(3)} prose:${hasProse ? "y" : "n"}  range:${range}`,
    );
  }

  console.log(
    `\ntotal=${clinics.length}  withPriceTable=${withItems}  costPageButNoTable=${emptyItems}  noCostPageAtAll=${noCostPage}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
