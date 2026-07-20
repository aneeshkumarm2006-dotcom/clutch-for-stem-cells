/**
 * Ad-hoc query: list all clinics and all taxonomy "categories" from the DB.
 * Usage: npx tsx scripts/list-clinics-categories.ts
 */
import dns from "node:dns";
// Node's c-ares resolver refuses SRV queries in this environment even though
// the OS resolves them fine — point it at public DNS so mongodb+srv works.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import { dbConnect } from "@/lib/db";
import {
  Clinic,
  Treatment,
  Condition,
  CellSource,
  Accreditation,
  Location,
} from "@/models";

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

  const clinics = await Clinic.find({}, { name: 1, slug: 1, status: 1 })
    .sort({ name: 1 })
    .lean();

  console.log(`\n=== CLINICS (${clinics.length}) ===`);
  for (const c of clinics) {
    console.log(`- ${c.name}  [${c.slug}]  (${c.status ?? "?"})`);
  }

  const taxonomies: [string, typeof Treatment][] = [
    ["Treatments", Treatment],
    ["Conditions", Condition],
    ["Cell Sources", CellSource],
    ["Accreditations", Accreditation],
    ["Locations", Location],
  ];

  for (const [label, Model] of taxonomies) {
    const items = await Model.find(
      {},
      { name: 1, slug: 1, clinicCount: 1, isActive: 1 },
    )
      .sort({ name: 1 })
      .lean();
    console.log(`\n=== ${label.toUpperCase()} (${items.length}) ===`);
    for (const t of items) {
      console.log(
        `- ${t.name}  [${t.slug}]  clinics=${t.clinicCount ?? 0}  active=${t.isActive}`,
      );
    }
  }

  await (await import("mongoose")).default.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
