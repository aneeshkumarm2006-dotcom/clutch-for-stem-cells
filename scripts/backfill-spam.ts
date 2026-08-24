/**
 * Classify submissions that were stored before the spam guard shipped.
 *
 *   npm run backfill-spam              # dry run — prints, writes nothing
 *   npm run backfill-spam -- --apply   # write the verdicts
 *   npm run backfill-spam -- --apply --quarantine   # also change status
 *
 * Two guarantees, both non-negotiable:
 *
 *  1. It NEVER deletes anything. Existing records are only ever annotated, and
 *     with `--quarantine` moved between statuses. Nothing is removed, and
 *     nothing is copied to the blocked bin — a hard reject is a decision made
 *     at submission time, when the payload is still disposable, not one to
 *     apply retroactively to a lead someone may already have replied to.
 *
 *  2. It NEVER overrides a human. A record whose `spam.overriddenBy` is set
 *     (someone clicked "not spam"), or whose status a person already moved off
 *     the default, is skipped and reported as such.
 *
 * By default it only annotates: statuses stay exactly as they are, so you can
 * see what the filter thinks of your history without it touching the inbox.
 * Add `--quarantine` once the dry run looks right.
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
import { payloadFingerprint } from "@/lib/spam/guard";
import type { SpamAssessment } from "@/lib/spam/types";
import { Lead, Report, Review } from "@/models";

const OPTS = {
  ownHosts: OWN_HOSTS,
  whitelistDomains: WHITELIST_EMAIL_DOMAINS,
};

interface Counters {
  scanned: number;
  clean: number;
  flagged: number;
  skippedHuman: number;
  written: number;
  statusChanged: number;
}

const APPLY = process.argv.includes("--apply");
const QUARANTINE = process.argv.includes("--quarantine");

function report(
  form: string,
  label: string,
  a: SpamAssessment,
  action: string,
): void {
  console.log(
    `  [${form}] ${a.verdict.toUpperCase().padEnd(10)} score=${String(a.score).padStart(2)} ${(a.category ?? "-").padEnd(20)} ${action.padEnd(18)} ${label}`,
  );
  for (const r of a.reasons) console.log(`      · ${r.detail} (+${r.weight})`);
}

/** True when a person has already made a call the backfill must not undo. */
function humanDecided(
  spam: { overriddenBy?: unknown } | undefined,
  statusIsDefault: boolean,
): boolean {
  if (spam?.overriddenBy) return true;
  return !statusIsDefault;
}

async function backfillLeads(c: Counters): Promise<void> {
  const docs = await Lead.find({}).sort({ createdAt: 1 });
  console.log(`\nLEADS (${docs.length})`);

  for (const d of docs) {
    c.scanned += 1;
    // Pre-guard records carry no render stamp. `null` is the honest value and
    // is weighted below quarantine precisely so history isn't punished for it.
    const a = classifySubmission(
      {
        form: "lead",
        name: d.name,
        email: d.email,
        phone: d.phone,
        message: d.message,
        extra: [d.country, d.budgetRange],
        elapsedMs: null,
      },
      OPTS,
    );

    const label = `${d.email} "${(d.message ?? "").slice(0, 50)}"`;

    if (humanDecided(d.spam, d.status === "new")) {
      c.skippedHuman += 1;
      if (a.verdict !== "allow") report("lead", label, a, "SKIP (human)");
      continue;
    }

    if (a.verdict === "allow") {
      c.clean += 1;
      continue;
    }
    c.flagged += 1;

    const willChangeStatus = QUARANTINE;
    report(
      "lead",
      label,
      a,
      APPLY ? (willChangeStatus ? "annotate + spam" : "annotate") : "would flag",
    );

    if (!APPLY) continue;

    d.spam = {
      // A backfill never hard-rejects: `reject` is a submission-time decision.
      verdict: "quarantine",
      score: a.score,
      category: a.category,
      reasons: a.reasons,
      payloadHash: payloadFingerprint({
        name: d.name,
        message: d.message,
        extra: [d.country, d.budgetRange],
      }),
      checkedAt: new Date(),
      overriddenBy: null,
      overriddenAt: null,
    };
    if (willChangeStatus) {
      d.status = "spam";
      c.statusChanged += 1;
    }
    await d.save();
    c.written += 1;
  }
}

async function backfillReviews(c: Counters): Promise<void> {
  const docs = await Review.find({}).sort({ createdAt: 1 });
  console.log(`\nREVIEWS (${docs.length})`);

  for (const d of docs) {
    c.scanned += 1;
    const body = (d.body ?? {}) as Record<string, string | undefined>;
    const text = [
      body.condition,
      body.whyChosen,
      body.treatmentDescription,
      body.outcome,
      body.experience,
      body.improvement,
    ].filter((s): s is string => Boolean(s));

    const a = classifySubmission(
      {
        form: "review",
        name: d.reviewer?.displayName,
        email: d.reviewer?.email,
        subject: d.headline,
        message: text.join("\n\n"),
        extra: [d.reviewer?.country, ...(d.whyChosenTags ?? [])],
        elapsedMs: null,
      },
      OPTS,
    );

    const label = `"${(d.headline ?? text.join(" ")).slice(0, 55)}"`;

    // An approved or rejected review was moderated by a person. Only `pending`
    // is still the machine's to touch.
    if (humanDecided(d.spam, d.status === "pending")) {
      c.skippedHuman += 1;
      if (a.verdict !== "allow") report("review", label, a, "SKIP (moderated)");
      continue;
    }

    if (a.verdict === "allow") {
      c.clean += 1;
      continue;
    }
    c.flagged += 1;

    const willChangeStatus = QUARANTINE;
    report(
      "review",
      label,
      a,
      APPLY ? (willChangeStatus ? "annotate + spam" : "annotate") : "would flag",
    );

    if (!APPLY) continue;

    d.spam = {
      verdict: "quarantine",
      score: a.score,
      category: a.category,
      reasons: a.reasons,
      payloadHash: payloadFingerprint({
        name: d.reviewer?.displayName,
        subject: d.headline,
        message: text.join("\n\n"),
      }),
      checkedAt: new Date(),
      overriddenBy: null,
      overriddenAt: null,
    };
    if (willChangeStatus) {
      d.status = "spam";
      c.statusChanged += 1;
    }
    await d.save();
    c.written += 1;
  }
}

async function backfillReports(c: Counters): Promise<void> {
  const docs = await Report.find({}).select("+reporterEmail").sort({ createdAt: 1 });
  console.log(`\nREPORTS (${docs.length})`);

  for (const d of docs) {
    c.scanned += 1;
    const a = classifySubmission(
      {
        form: "report",
        email: d.reporterEmail,
        subject: d.reason,
        message: d.details,
        elapsedMs: null,
      },
      OPTS,
    );

    const label = `${d.reason} "${(d.details ?? "").slice(0, 45)}"`;

    if (humanDecided(d.spam, d.status === "open")) {
      c.skippedHuman += 1;
      if (a.verdict !== "allow") report("report", label, a, "SKIP (triaged)");
      continue;
    }

    if (a.verdict === "allow") {
      c.clean += 1;
      continue;
    }
    c.flagged += 1;

    report("report", label, a, APPLY ? "annotate" : "would flag");
    if (!APPLY) continue;

    d.spam = {
      verdict: "quarantine",
      score: a.score,
      category: a.category,
      reasons: a.reasons,
      payloadHash: payloadFingerprint({ subject: d.reason, message: d.details }),
      checkedAt: new Date(),
      overriddenBy: null,
      overriddenAt: null,
    };
    if (QUARANTINE) {
      d.status = "dismissed";
      c.statusChanged += 1;
    }
    await d.save();
    c.written += 1;
  }
}

async function main(): Promise<void> {
  const mod = await import("@next/env");
  (
    mod.loadEnvConfig ??
    (mod as unknown as { default?: { loadEnvConfig?: typeof mod.loadEnvConfig } })
      .default?.loadEnvConfig
  )?.(process.cwd());

  await dbConnect();

  console.log(
    APPLY
      ? `APPLYING${QUARANTINE ? " (statuses will change)" : " (annotate only)"}`
      : "DRY RUN — nothing will be written. Add --apply to write.",
  );
  console.log(`ownHosts=${JSON.stringify(OWN_HOSTS)}`);
  console.log(`whitelist=${JSON.stringify(WHITELIST_EMAIL_DOMAINS)}`);

  const c: Counters = {
    scanned: 0,
    clean: 0,
    flagged: 0,
    skippedHuman: 0,
    written: 0,
    statusChanged: 0,
  };

  await backfillLeads(c);
  await backfillReviews(c);
  await backfillReports(c);

  console.log(
    `\n${APPLY ? "Done" : "DRY RUN"}. scanned=${c.scanned} clean=${c.clean} flagged=${c.flagged} skipped-human=${c.skippedHuman} written=${c.written} status-changed=${c.statusChanged}`,
  );
  if (!APPLY && c.flagged) {
    console.log("Re-run with --apply to store these verdicts.");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
