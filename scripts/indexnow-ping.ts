/**
 * IndexNow manual submission — the backfill and repair tool for
 * `lib/indexnow.ts`.
 *
 * The API routes ping on every publish, and
 * `.github/workflows/indexnow.yml` diffs the sitemap after each deploy. This
 * script is for the cases neither covers: a first-time submission of the whole
 * site, a batch of clinics added with `npm run import-clinics`, or re-sending
 * URLs after a spell with a bad key file.
 *
 *   npm run indexnow:ping -- --verify                       # check the key file
 *   npm run indexnow:ping -- /blog/my-post /clinic/acme     # specific URLs
 *   npm run indexnow:ping -- --all                          # every sitemap URL
 *   npm run indexnow:ping -- --all --dry                    # list, submit nothing
 *   npm run indexnow:ping -- --all --url https://example.com # read another host
 *
 * Start with `--verify`. A missing or mismatched `public/<key>.txt` is the one
 * setup mistake that disables IndexNow silently in normal operation (the
 * engines answer 403/422 long after the publish that triggered the ping), so
 * confirming it once is worth more than any amount of log reading.
 *
 * `--all` reads `/sitemap.xml` over HTTP rather than importing
 * `app/sitemap.ts`, which keeps this script free of the React-server module
 * graph and means it submits exactly what a crawler would find.
 *
 * ## The host this submits for
 *
 * `lib/indexnow.ts` derives both `host` and `keyLocation` from
 * `NEXT_PUBLIC_SITE_URL`, so that variable decides which site is being
 * submitted, and it must be the public domain — a localhost value is refused
 * rather than sent. Point it at production explicitly when your `.env.local`
 * is set up for dev:
 *
 *   NEXT_PUBLIC_SITE_URL=https://your-domain.com npm run indexnow:ping -- --all
 *
 * `--url` only changes where the sitemap is *read* from; it never changes the
 * host that is submitted.
 *
 * Unlike the in-request helper, this bypasses the `VERCEL_ENV === "production"`
 * guard (`force: true`): running this command is itself the deliberate act the
 * guard exists to require. Exit code is 1 when a batch was rejected, so it can
 * gate a release step.
 *
 * DNS note (same as import-clinics): if Node can't resolve a host, prefix with
 * SCRIPT_DNS=8.8.8.8,1.1.1.1
 */
import dns from "node:dns";
if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));

const ARGS = process.argv.slice(2);
const has = (flag: string): boolean => ARGS.includes(flag);
const argValue = (flag: string): string | undefined => {
  const i = ARGS.indexOf(flag);
  return i >= 0 ? ARGS[i + 1] : undefined;
};

const ALL = has("--all");
const DRY = has("--dry");
const VERIFY = has("--verify");

/** Positional args are URLs; flags and their values are not. */
const FLAGS_WITH_VALUES = ["--url"];
function positionalUrls(): string[] {
  const out: string[] = [];
  for (let i = 0; i < ARGS.length; i += 1) {
    const arg = ARGS[i]!;
    if (arg.startsWith("--")) {
      if (FLAGS_WITH_VALUES.includes(arg)) i += 1; // skip its value
      continue;
    }
    out.push(arg);
  }
  return out;
}

async function loadEnv(): Promise<void> {
  const mod = await import("@next/env");
  (
    mod.loadEnvConfig ??
    (
      mod as unknown as {
        default?: { loadEnvConfig?: typeof mod.loadEnvConfig };
      }
    ).default?.loadEnvConfig
  )?.(process.cwd());
}

/**
 * Every `<loc>` in a sitemap, reduced to its path.
 *
 * Paths rather than the absolute URLs as written, so that reading the
 * inventory from one host (`--url`) and submitting for the canonical host
 * stays coherent: `absoluteUrl` re-bases each one onto the site being
 * submitted.
 */
async function sitemapUrls(baseUrl: string): Promise<string[]> {
  const target = `${baseUrl.replace(/\/$/, "")}/sitemap.xml`;
  const res = await fetch(target);
  if (!res.ok) {
    throw new Error(`GET ${target} -> ${res.status}. Is the site reachable?`);
  }
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
    const loc = m[1]!.trim();
    try {
      const { pathname, search } = new URL(loc);
      return `${pathname}${search}`;
    } catch {
      return loc;
    }
  });
  if (!urls.length) throw new Error(`${target} listed no URLs`);
  return urls;
}

async function main(): Promise<void> {
  await loadEnv();

  // Imported only now: `config/site.ts` reads NEXT_PUBLIC_SITE_URL at module
  // evaluation, so a static import would capture it before `.env.local` loads.
  const { normalizeIndexNowUrls, submitIndexNow } =
    await import("@/lib/indexnow");

  if (VERIFY) {
    const { indexNowConfig } = await import("@/lib/indexnow");
    const resolved = indexNowConfig({ force: true });
    if (!resolved.config) {
      console.error(`Not configured: ${resolved.reason}.`);
      process.exit(1);
    }
    const { key, host, keyLocation } = resolved.config;
    console.log(`host:        ${host}\nkeyLocation: ${keyLocation}`);
    const res = await fetch(keyLocation);
    const body = res.ok ? (await res.text()).trim() : "";
    if (!res.ok) {
      console.error(
        `\nFAIL — GET ${keyLocation} returned HTTP ${res.status}. ` +
          `Commit public/${key}.txt and deploy.`,
      );
      process.exit(1);
    }
    if (body !== key) {
      console.error(
        `\nFAIL — ${keyLocation} is reachable but contains ${JSON.stringify(
          body.slice(0, 80),
        )}, not the key. The file must hold exactly the INDEXNOW_KEY value.`,
      );
      process.exit(1);
    }
    console.log("\nOK — key file is reachable and matches INDEXNOW_KEY.");
    process.exit(0);
  }

  const explicit = positionalUrls();
  if (!ALL && !explicit.length) {
    console.error(
      "Nothing to submit. Pass URLs, or --all to read every sitemap URL.\n" +
        "  npm run indexnow:ping -- /blog/my-post\n" +
        "  npm run indexnow:ping -- --all",
    );
    process.exit(1);
  }

  const readFrom = argValue("--url") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (ALL && !/^https?:\/\//.test(readFrom)) {
    console.error(
      "--all needs a site to read /sitemap.xml from. Set NEXT_PUBLIC_SITE_URL " +
        "or pass --url https://your-domain.com",
    );
    process.exit(1);
  }
  const requested = ALL ? await sitemapUrls(readFrom) : explicit;

  // Report the filtering before submitting: a typo'd path silently vanishing
  // is the one thing that makes this tool feel broken.
  const submittable = normalizeIndexNowUrls(requested);
  const dropped = requested.length - submittable.length;
  console.log(
    `${requested.length} URL(s) requested${ALL ? ` from ${readFrom}/sitemap.xml` : ""}, ` +
      `${submittable.length} submittable` +
      (dropped > 0
        ? ` (${dropped} dropped: off-host, private, or carrying a query string)`
        : ""),
  );
  if (DRY) for (const url of submittable) console.log(`  ${url}`);

  const result = await submitIndexNow(requested, { force: true, dryRun: DRY });

  if (result.skipped) {
    console.log(`\nNothing submitted — ${result.reason}.`);
    // A dry run doing nothing is the expected outcome, not a failure.
    process.exit(DRY ? 0 : 1);
  }

  const failed = result.batches.filter((b) => !b.ok);
  console.log(
    `\nDone. submitted=${result.submitted} batches=${result.batches.length}` +
      (failed.length ? ` failed=${failed.length}` : ""),
  );
  for (const batch of failed) {
    console.error(
      `  batch of ${batch.count} rejected: HTTP ${batch.status}${batch.error ? ` (${batch.error})` : ""}`,
    );
  }

  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
