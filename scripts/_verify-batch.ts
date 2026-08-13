/**
 * THROWAWAY — post-import verification for the 10-clinic batch.
 *
 * For each slug: confirms the doc is published and linked to the right taxonomy,
 * confirms no stored meta copy is shadowing the lib/clinic-meta formula, renders
 * the real generated meta for all three clinic URLs, and runs findMetaIssues +
 * scanContentFlags over everything.
 *
 * Usage:  SCRIPT_DNS=8.8.8.8,1.1.1.1 npx tsx scripts/_verify-batch.ts <slug> [...]
 */
import dns from "node:dns";

if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));

import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Clinic } from "@/models";
import {
  clinicMetaTitle,
  clinicMetaDescription,
  clinicReviewsMetaTitle,
  clinicReviewsMetaDescription,
  clinicCostMetaTitle,
  clinicCostMetaDescription,
} from "@/lib/clinic-meta";
import { findMetaIssues, normalizeMetaText } from "@/lib/meta-text";
import { scanContentFlags } from "@/lib/content-flags";

/** Every prose string on the record, for the compliance scan. */
function allProse(c: any): string[] {
  const out: (string | undefined)[] = [
    c.name,
    c.tagline,
    c.description,
    c.priceNote,
    c.medicalDirector?.bio,
    c.medicalDirector?.title,
    c.medicalDirector?.credentials,
    ...(c.highlights ?? []),
    ...(c.team ?? []).flatMap((t: any) => [t.title, t.credentials, t.bio]),
    ...(c.faqs ?? []).flatMap((f: any) => [f.question, f.answer]),
    c.reviewsPage?.heading,
    c.reviewsPage?.intro,
    c.reviewsPage?.introEmpty,
    c.reviewsPage?.bodyMarkdown,
    c.reviewsPage?.ctaHeading,
    c.reviewsPage?.ctaBody,
    c.costPage?.heading,
    c.costPage?.intro,
    c.costPage?.introEmpty,
    c.costPage?.bodyMarkdown,
    c.costPage?.insuranceNote,
    c.costPage?.financingNote,
    c.costPage?.ctaHeading,
    c.costPage?.ctaBody,
    ...(c.costPage?.includes ?? []),
    ...(c.costPage?.excludes ?? []),
    ...(c.costPage?.items ?? []).flatMap((i: any) => [i.label, i.unit, i.note]),
    ...(c.costPage?.faqs ?? []).flatMap((f: any) => [f.question, f.answer]),
    ...(c.logo ? [c.logo.alt] : []),
    ...(c.coverImage ? [c.coverImage.alt] : []),
    ...(c.gallery ?? []).map((g: any) => g.alt),
  ];
  return out.filter((s): s is string => typeof s === "string" && s.length > 0);
}

/** Em dash sweep over on-page prose (site-wide policy, not just meta). */
const EM_DASH_RE = /[—–―‒]/;

async function main() {
  const mod = await import("@next/env");
  (mod.loadEnvConfig ?? (mod as any).default?.loadEnvConfig)?.(process.cwd());

  const slugs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!slugs.length) {
    console.error("Usage: npx tsx scripts/_verify-batch.ts <slug> [...]");
    process.exit(1);
  }

  await dbConnect();
  let problems = 0;

  for (const slug of slugs) {
    const c: any = await Clinic.findOne({ slug })
      .populate("conditionsTreated", "name slug")
      .populate("treatmentTypes", "name slug")
      .lean();

    console.log(`\n${"=".repeat(78)}\n${slug}`);
    if (!c) {
      console.log("  ✗ NOT FOUND");
      problems++;
      continue;
    }

    const bad = (msg: string) => {
      console.log(`  ✗ ${msg}`);
      problems++;
    };

    // ── State ────────────────────────────────────────────────────────────────
    if (c.status !== "published") bad(`status is "${c.status}", expected published`);
    if (c.isDeleted) bad("isDeleted is true");
    if (!(c.conditionsTreated ?? []).length) bad("no conditionsTreated");
    if (!(c.locations ?? []).length) bad("no locations");

    // ── Stored meta must NOT shadow the formula ──────────────────────────────
    for (const [label, seo] of [
      ["seo", c.seo],
      ["reviewsPage.seo", c.reviewsPage?.seo],
      ["costPage.seo", c.costPage?.seo],
    ] as const) {
      if (seo?.metaTitle) bad(`${label}.metaTitle is set ("${seo.metaTitle}") — must be absent`);
      if (seo?.metaDescription) bad(`${label}.metaDescription is set — must be absent`);
    }

    // ── Images must be Cloudinary ────────────────────────────────────────────
    for (const [label, img] of [
      ["logo", c.logo],
      ["coverImage", c.coverImage],
      ...(c.gallery ?? []).map((g: any, i: number) => [`gallery[${i}]`, g] as const),
    ] as [string, any][]) {
      if (!img) {
        console.log(`  · ${label}: (none)`);
        continue;
      }
      if (!/^https:\/\/res\.cloudinary\.com\//.test(img.url ?? "")) {
        bad(`${label} is not a Cloudinary URL: ${img.url}`);
      } else {
        console.log(`  · ${label}: ok`);
      }
    }

    // ── Generated meta ───────────────────────────────────────────────────────
    const input = {
      name: c.name,
      locations: c.locations,
      conditions: (c.conditionsTreated ?? []).map((x: any) => ({ name: x.name })),
      priceMin: c.priceMin,
      priceMax: c.priceMax,
      currency: c.currency,
    };

    const rendered: [string, string][] = [
      ["profile  title", clinicMetaTitle(input)],
      ["profile  desc ", clinicMetaDescription(input)],
      ["reviews  title", clinicReviewsMetaTitle(input)],
      ["reviews  desc ", clinicReviewsMetaDescription(input)],
      ["cost     title", clinicCostMetaTitle(input)],
      ["cost     desc ", clinicCostMetaDescription(input)],
    ];

    for (const [label, raw] of rendered) {
      const kind = label.includes("title") ? "title" : "description";
      const emitted = normalizeMetaText(raw, kind as "title" | "description");
      console.log(`  ${label} (${String(emitted.length).padStart(3)}) ${emitted}`);
      const issues = findMetaIssues(emitted);
      if (issues.length) {
        bad(
          `${label} meta issues: ${issues
            .map((i) => `${i.rule} ${i.char} ${i.codePoint}`)
            .join(", ")}`,
        );
      }
    }

    // ── Compliance + em dashes ───────────────────────────────────────────────
    const prose = allProse(c);
    const flags = scanContentFlags(prose);
    if (flags.length) {
      bad(
        `content flags: ${flags.map((f) => `"${f.phrase}" in …${f.context}…`).join(" | ")}`,
      );
    }
    const dashed = prose.filter((s) => EM_DASH_RE.test(s));
    if (dashed.length) {
      bad(`em dash in ${dashed.length} field(s), first: ${dashed[0].slice(0, 90)}`);
    }

    console.log(
      `  conditions: ${(c.conditionsTreated ?? []).map((x: any) => x.slug).join(", ")}`,
    );
    console.log(
      `  treatments: ${(c.treatmentTypes ?? []).map((x: any) => x.slug).join(", ")}`,
    );
  }

  console.log(
    `\n${"=".repeat(78)}\n${problems === 0 ? "ALL CLEAN" : `${problems} problem(s) found`}`,
  );
  await mongoose.disconnect();
  process.exit(problems === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
