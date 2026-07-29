/** Temporary read-only probe: dump the SVF treatment's existing editorial body. */
import dns from "node:dns";
if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));

import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Treatment } from "@/models";

async function main(): Promise<void> {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(process.cwd());
  await dbConnect();

  const t = (await Treatment.findOne({ slug: "svf" }).lean()) as Record<
    string,
    unknown
  > | null;
  // eslint-disable-next-line no-console
  console.log("--- body ---\n", t?.body);
  // eslint-disable-next-line no-console
  console.log("--- description ---\n", JSON.stringify(t?.description));
  // eslint-disable-next-line no-console
  console.log("--- shortDescription ---\n", JSON.stringify(t?.shortDescription));
  // eslint-disable-next-line no-console
  console.log("--- category ---\n", JSON.stringify(t?.category));

  await mongoose.disconnect();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
