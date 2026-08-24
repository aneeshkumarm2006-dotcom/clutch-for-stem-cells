/**
 * Run the spam classifier over every real submission in the database and print
 * the verdict for each. Read-only — it never writes.
 *
 *   npm run check:spam
 *
 * **Run this before and after changing any rule in `lib/spam/classify.ts`.**
 * The unit tests cover the cases someone thought to write down; this covers
 * everything the site has actually received. A rule change that turns a real
 * submission from PASS into anything else is a regression, no matter how much
 * junk the new rule catches.
 *
 * It is also how the current rule set was tuned: the first pass quarantined a
 * genuine negative review for saying "Other practitioners offer 35% discount",
 * which is why the retail-promo rule now requires offer-direction.
 *
 * DNS note (same as the other scripts): if Node can't resolve the MongoDB SRV
 * record, prefix with  SCRIPT_DNS=8.8.8.8,1.1.1.1
 */
import dns from "node:dns";
if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));

import mongoose from "mongoose";
import { OWN_HOSTS, WHITELIST_EMAIL_DOMAINS } from "@/config/spam";
import { dbConnect } from "@/lib/db";
import { classifySubmission } from "@/lib/spam/classify";
import { Lead, Review, Report } from "@/models";

const opts = {
  ownHosts: OWN_HOSTS,
  whitelistDomains: WHITELIST_EMAIL_DOMAINS,
};

function line(
  label: string,
  verdict: string,
  score: number,
  category: string | null,
  reasons: string[],
): void {
  const mark = verdict === "allow" ? "PASS" : verdict.toUpperCase();
  console.log(
    `${mark.padEnd(10)} score=${String(score).padStart(2)} ${(category ?? "-").padEnd(20)} ${label}`,
  );
  for (const r of reasons) console.log(`${" ".repeat(12)}· ${r}`);
}

async function main() {
  const mod = await import("@next/env");
  (mod.loadEnvConfig ?? (mod as never as { default?: { loadEnvConfig?: unknown } }).default?.loadEnvConfig)?.(
    process.cwd(),
  );
  await dbConnect();

  console.log(`ownHosts=${JSON.stringify(OWN_HOSTS)}`);
  console.log(`whitelist=${JSON.stringify(WHITELIST_EMAIL_DOMAINS)}\n`);

  const tally = { allow: 0, quarantine: 0, reject: 0 };

  // ── Leads ────────────────────────────────────────────────────────────────
  const leads = await Lead.find({}).sort({ createdAt: 1 }).lean();
  console.log(`── LEADS (${leads.length}) ─────────────────────────────────`);
  for (const l of leads) {
    // Real submissions predate the render stamp, so they have none. That is the
    // worst case for them and exactly what we want to test against.
    const a = classifySubmission(
      {
        form: "lead",
        name: l.name,
        email: l.email,
        phone: l.phone,
        message: l.message,
        extra: [l.country, l.budgetRange],
        elapsedMs: null,
      },
      opts,
    );
    tally[a.verdict] += 1;
    line(
      `${l.email} "${(l.message ?? "").slice(0, 60)}" [${l.source ?? "?"}]`,
      a.verdict,
      a.score,
      a.category,
      a.reasons.map((r) => `${r.code} (+${r.weight}) ${r.detail}`),
    );
  }

  // ── Reviews ──────────────────────────────────────────────────────────────
  const reviews = await Review.find({}).sort({ createdAt: 1 }).lean();
  console.log(`\n── REVIEWS (${reviews.length}) ───────────────────────────`);
  let quiet = 0;
  for (const r of reviews) {
    const body = (r.body ?? {}) as Record<string, string | undefined>;
    const text = [
      body.condition,
      body.whyChosen,
      body.treatmentDescription,
      body.outcome,
      body.experience,
      body.improvement,
    ].filter(Boolean) as string[];

    const a = classifySubmission(
      {
        form: "review",
        name: r.reviewer?.displayName,
        email: r.reviewer?.email,
        subject: r.headline,
        message: text.join("\n\n"),
        extra: [r.reviewer?.country, ...(r.whyChosenTags ?? [])],
        elapsedMs: null,
      },
      opts,
    );
    tally[a.verdict] += 1;
    if (a.verdict === "allow") {
      quiet += 1;
      continue; // Only print the ones that would be touched.
    }
    line(
      `"${(r.headline ?? "").slice(0, 50)}" — ${(text.join(" ") || "(empty)").slice(0, 70)}`,
      a.verdict,
      a.score,
      a.category,
      a.reasons.map((x) => `${x.code} (+${x.weight}) ${x.detail}`),
    );
  }
  console.log(`(${quiet} reviews passed silently)`);

  const reports = await Report.countDocuments({});
  console.log(`\n── REPORTS (${reports}) ──`);

  console.log(
    `\nTOTAL  allow=${tally.allow}  quarantine=${tally.quarantine}  reject=${tally.reject}`,
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
