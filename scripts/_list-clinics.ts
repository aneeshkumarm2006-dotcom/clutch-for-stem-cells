/**
 * Ad-hoc: dump every clinic as JSON so research agents have name + address to
 * search with. Usage: npx tsx scripts/_list-clinics.ts > /tmp/clinics.json
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
    .select("name slug status website locations externalReviews")
    .sort({ name: 1 })
    .lean();

  const rows = clinics.map((c) => {
    const hq =
      (c.locations ?? []).find((l) => l.isHQ) ?? (c.locations ?? [])[0] ?? null;
    return {
      name: c.name,
      slug: c.slug,
      status: c.status,
      website: c.website ?? null,
      city: hq?.city ?? null,
      region: hq?.region ?? null,
      country: hq?.country ?? null,
      addressLine: hq?.addressLine ?? null,
      hasExternalReviews: Boolean(
        (c as Record<string, unknown>).externalReviews,
      ),
    };
  });

  process.stdout.write(JSON.stringify(rows, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
