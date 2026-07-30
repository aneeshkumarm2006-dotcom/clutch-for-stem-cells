/**
 * Recompute taxonomy `clinicCount` from live published clinics.
 *
 * Thin CLI over `lib/taxonomy-counts.ts` — the same function `/api/cron/recompute`
 * runs nightly. Use this to correct the counts immediately after an import
 * rather than waiting for the cron.
 *
 *   npm run recompute-counts            # write corrected counts
 *   npm run recompute-counts -- --dry   # report drift, write nothing
 *
 * DNS note (same as import-clinics): if Node can't resolve the MongoDB SRV
 * record, prefix with  SCRIPT_DNS=8.8.8.8,1.1.1.1
 */
import dns from "node:dns";
if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));

import mongoose from "mongoose";
import { recomputeAllClinicCounts } from "@/lib/taxonomy-counts";

async function loadEnv(): Promise<void> {
  const mod = await import("@next/env");
  (mod.loadEnvConfig ?? (mod as unknown as { default?: { loadEnvConfig?: typeof mod.loadEnvConfig } }).default?.loadEnvConfig)?.(
    process.cwd(),
  );
}

async function main() {
  await loadEnv();
  const dry = process.argv.includes("--dry");

  const { changed, unchanged, clinics, drift } =
    await recomputeAllClinicCounts({ dry });

  for (const line of drift) console.log(line);
  console.log(
    `\n${dry ? "DRY RUN — " : ""}Done. ${dry ? "would change" : "changed"}=${changed} unchanged=${unchanged} (from ${clinics} published clinics)`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
