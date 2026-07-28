/**
 * Ad-hoc repair pass for clinic `website` links.
 *
 * The profile page renders "Visit website" only when `clinic.website` is set, so
 * a dead or placeholder URL is the one case that produces a broken button. This
 * probes every clinic's stored URL and unsets the ones that cannot serve a page
 * (placeholder hosts like example.com, DNS/connection failures, 4xx/5xx), which
 * makes the button disappear rather than lead nowhere.
 *
 * Usage:
 *   npx tsx scripts/_fix-clinic-websites.ts           # dry run, prints the plan
 *   npx tsx scripts/_fix-clinic-websites.ts --apply   # writes the changes
 */
import dns from "node:dns";
// Node's c-ares resolver refuses SRV queries in this environment even though
// the OS resolves them fine — point it at public DNS so mongodb+srv works.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import { dbConnect } from "@/lib/db";
import { Clinic } from "@/models";

const APPLY = process.argv.includes("--apply");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Hosts that are documentation placeholders, never a real clinic site. */
const PLACEHOLDER_HOSTS = [
  "example.com",
  "example.org",
  "example.net",
  "localhost",
  "test.com",
];

type Verdict = {
  name: string;
  slug: string;
  status: string;
  website: string;
  keep: boolean;
  note: string;
};

async function probe(url: string, method: "HEAD" | "GET") {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    return await fetch(url, {
      method,
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function judge(c: {
  name: string;
  slug: string;
  status?: string;
  website?: string;
}): Promise<Verdict> {
  const base = {
    name: c.name,
    slug: c.slug,
    status: c.status ?? "?",
    website: c.website?.trim() ?? "",
  };
  // Nothing stored → button is already hidden, nothing to do.
  if (!base.website) return { ...base, keep: true, note: "no website set (button hidden)" };

  let url = base.website;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return { ...base, keep: false, note: "unparseable URL" };
  }
  if (PLACEHOLDER_HOSTS.includes(host)) {
    return { ...base, keep: false, note: `placeholder host (${host})` };
  }

  for (const method of ["HEAD", "GET"] as const) {
    try {
      const res = await probe(url, method);
      // Some servers reject HEAD (405/403/501) but serve GET fine — retry.
      if (method === "HEAD" && [403, 405, 404, 500, 501].includes(res.status)) continue;
      return {
        ...base,
        keep: res.ok,
        note: res.ok ? `HTTP ${res.status} ok` : `HTTP ${res.status} ${res.statusText}`,
      };
    } catch (err) {
      const e = err as Error & { cause?: { code?: string; message?: string } };
      const reason =
        e.name === "AbortError"
          ? "TIMEOUT (20s)"
          : (e.cause?.code ?? e.cause?.message ?? e.message);
      if (method === "HEAD") continue;
      return { ...base, keep: false, note: `unreachable: ${reason}` };
    }
  }
  return { ...base, keep: false, note: "unreachable" };
}

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

  const clinics = await Clinic.find({}, { name: 1, slug: 1, status: 1, website: 1 })
    .sort({ name: 1 })
    .lean<{ name: string; slug: string; status?: string; website?: string }[]>();

  console.log(`Probing ${clinics.length} clinics (${APPLY ? "APPLY" : "DRY RUN"})…\n`);

  const verdicts: Verdict[] = [];
  const CONCURRENCY = 6;
  for (let i = 0; i < clinics.length; i += CONCURRENCY) {
    const batch = clinics.slice(i, i + CONCURRENCY);
    verdicts.push(...(await Promise.all(batch.map(judge))));
  }

  const toClear = verdicts.filter((v) => !v.keep);
  const kept = verdicts.filter((v) => v.keep && v.website);
  const alreadyEmpty = verdicts.filter((v) => v.keep && !v.website);

  console.log(`=== KEEP — link works (${kept.length}) ===`);
  for (const v of kept) console.log(`- ${v.name} [${v.slug}] -> ${v.website} (${v.note})`);

  console.log(`\n=== ALREADY NO WEBSITE — button already hidden (${alreadyEmpty.length}) ===`);
  for (const v of alreadyEmpty) console.log(`- ${v.name} [${v.slug}]`);

  console.log(`\n=== CLEAR — dead link, button will be hidden (${toClear.length}) ===`);
  for (const v of toClear) console.log(`- ${v.name} [${v.slug}] -> ${v.website} (${v.note})`);

  if (!APPLY) {
    console.log(`\nDry run. Re-run with --apply to unset ${toClear.length} website field(s).`);
  } else {
    for (const v of toClear) {
      await Clinic.updateOne({ slug: v.slug }, { $unset: { website: "" } });
      console.log(`cleared: ${v.slug}`);
    }
    console.log(`\nApplied. Cleared ${toClear.length} website field(s).`);
  }

  await (await import("mongoose")).default.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
