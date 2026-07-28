/**
 * Ad-hoc audit: check every clinic's `website` link and report which resolve.
 * Usage: npx tsx scripts/_check-clinic-websites.ts
 */
import dns from "node:dns";
// Node's c-ares resolver refuses SRV queries in this environment even though
// the OS resolves them fine — point it at public DNS so mongodb+srv works.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import { dbConnect } from "@/lib/db";
import { Clinic } from "@/models";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

type Check = {
  name: string;
  slug: string;
  status: string;
  website: string;
  ok: boolean;
  code: number | null;
  finalUrl: string | null;
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

async function check(c: {
  name: string;
  slug: string;
  status?: string;
  website?: string;
}): Promise<Check> {
  const base = {
    name: c.name,
    slug: c.slug,
    status: c.status ?? "?",
    website: c.website ?? "",
  };
  if (!c.website || !c.website.trim()) {
    return { ...base, ok: false, code: null, finalUrl: null, note: "NO WEBSITE SET" };
  }
  let url = c.website.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  for (const method of ["HEAD", "GET"] as const) {
    try {
      const res = await probe(url, method);
      // Some servers reject HEAD (405/403/501) but serve GET fine — retry.
      if (method === "HEAD" && [403, 405, 404, 500, 501].includes(res.status)) continue;
      return {
        ...base,
        ok: res.ok,
        code: res.status,
        finalUrl: res.url || url,
        note: res.ok
          ? res.url && res.url.replace(/\/$/, "") !== url.replace(/\/$/, "")
            ? `redirected -> ${res.url}`
            : "ok"
          : `HTTP ${res.status} ${res.statusText}`,
      };
    } catch (err) {
      const e = err as Error & { cause?: { code?: string; message?: string } };
      const reason =
        e.name === "AbortError"
          ? "TIMEOUT (20s)"
          : (e.cause?.code ?? e.cause?.message ?? e.message);
      if (method === "HEAD") continue;
      return { ...base, ok: false, code: null, finalUrl: null, note: `FETCH FAILED: ${reason}` };
    }
  }
  return { ...base, ok: false, code: null, finalUrl: null, note: "FETCH FAILED" };
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

  console.log(`Checking ${clinics.length} clinics…\n`);

  const results: Check[] = [];
  const CONCURRENCY = 6;
  for (let i = 0; i < clinics.length; i += CONCURRENCY) {
    const batch = clinics.slice(i, i + CONCURRENCY);
    results.push(...(await Promise.all(batch.map(check))));
  }

  const broken = results.filter((r) => !r.ok);
  const good = results.filter((r) => r.ok);

  console.log(`=== BROKEN / SUSPECT (${broken.length}) ===`);
  for (const r of broken) {
    console.log(`- ${r.name} [${r.slug}] (${r.status})`);
    console.log(`    website: ${r.website || "(empty)"}`);
    console.log(`    result : ${r.note}`);
  }

  console.log(`\n=== WORKING (${good.length}) ===`);
  for (const r of good) {
    console.log(`- ${r.name} [${r.slug}] -> ${r.code} ${r.note}`);
  }

  console.log(`\nTOTAL ${results.length} | ok ${good.length} | broken ${broken.length}`);

  await (await import("mongoose")).default.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
