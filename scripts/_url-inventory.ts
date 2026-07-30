/**
 * One-off URL inventory — dumps every URL-producing record in the database,
 * published or not, so a Google indexing sheet can be built from the full set
 * rather than only what `sitemap.xml` currently emits.
 *
 *   SCRIPT_DNS=8.8.8.8,1.1.1.1 npx tsx scripts/_url-inventory.ts
 *
 * Output is JSON on stdout: { path, name, kind, live, note }[]
 */
import dns from "node:dns";
if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));
else dns.setServers(["8.8.8.8", "1.1.1.1"]);

import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import {
  Clinic,
  Treatment,
  Condition,
  Location,
  BlogPost,
  MatrixPage,
  MedicalReviewer,
  Page,
  ClinicLanding,
} from "@/models";
import { matrixPagePath } from "@/lib/matrix";
import { isMatrixIndexable } from "@/lib/seo-indexation";

interface Row {
  path: string;
  name: string;
  kind: string;
  live: boolean;
  note: string;
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

async function main() {
  await loadEnv();
  await dbConnect();

  const rows: Row[] = [];

  // ── Clinics ───────────────────────────────────────────────────────────────
  const clinics = await Clinic.find({ isDeleted: false })
    .select("slug name status reviewCount")
    .lean<
      { slug: string; name: string; status: string; reviewCount?: number }[]
    >();
  for (const c of clinics) {
    const live = c.status === "published";
    rows.push({
      path: `/clinic/${c.slug}`,
      name: c.name,
      kind: "clinic",
      live,
      note: live ? "" : `status=${c.status}`,
    });
    rows.push({
      path: `/clinic/${c.slug}/reviews`,
      name: `${c.name} reviews`,
      kind: "clinic-reviews",
      live,
      note: live ? `${c.reviewCount ?? 0} approved` : `status=${c.status}`,
    });
  }

  // ── Taxonomy ──────────────────────────────────────────────────────────────
  const treatments = await Treatment.find()
    .select("slug name isActive")
    .lean<{ slug: string; name: string; isActive: boolean }[]>();
  for (const t of treatments)
    rows.push({
      path: `/treatments/${t.slug}`,
      name: t.name,
      kind: "treatment",
      live: t.isActive,
      note: t.isActive ? "" : "inactive",
    });

  const conditions = await Condition.find()
    .select("slug name isActive")
    .lean<{ slug: string; name: string; isActive: boolean }[]>();
  for (const c of conditions)
    rows.push({
      path: `/conditions/${c.slug}`,
      name: c.name,
      kind: "condition",
      live: c.isActive,
      note: c.isActive ? "" : "inactive",
    });

  const locations = await Location.find()
    .select("slug name kind isActive parentId")
    .lean<
      {
        _id: unknown;
        slug: string;
        name: string;
        kind: string;
        isActive: boolean;
        parentId?: unknown;
      }[]
    >();
  const countrySlugById = new Map(
    locations
      .filter((l) => l.kind === "country")
      .map((l) => [String(l._id), l.slug] as const),
  );
  for (const l of locations) {
    if (l.kind === "country") {
      rows.push({
        path: `/locations/${l.slug}`,
        name: l.name,
        kind: "country",
        live: l.isActive,
        note: l.isActive ? "" : "inactive",
      });
    } else if (l.kind === "city") {
      const country = countrySlugById.get(String(l.parentId));
      if (!country) continue;
      rows.push({
        path: `/locations/${country}/${l.slug}`,
        name: l.name,
        kind: "city",
        live: l.isActive,
        note: l.isActive ? "" : "inactive",
      });
    }
  }

  // ── Blog ──────────────────────────────────────────────────────────────────
  const posts = await BlogPost.find()
    .select("slug title visibility status publishedAt")
    .lean<
      {
        slug: string;
        title: string;
        visibility?: string;
        status?: string;
        publishedAt?: Date;
      }[]
    >();
  for (const p of posts) {
    const vis = p.visibility ?? p.status ?? "";
    const live = vis === "visible" || vis === "published";
    rows.push({
      path: `/blog/${p.slug}`,
      name: p.title,
      kind: "blog",
      live,
      note: live ? "" : `visibility=${vis || "unknown"}`,
    });
  }

  // ── Combination (matrix) pages ────────────────────────────────────────────
  const matrix = await MatrixPage.find()
    .select(
      "kind slugA slugB title intro body faqs keyFacts reviewedBy reviewStatus",
    )
    .lean<any[]>();
  for (const m of matrix) {
    const path = matrixPagePath(m.kind, m.slugA, m.slugB);
    const indexable = m.reviewStatus === "approved" && isMatrixIndexable(m);
    rows.push({
      path,
      name: m.title || `${m.slugA} x ${m.slugB}`,
      kind: `matrix:${m.kind}`,
      live: indexable,
      note: indexable
        ? ""
        : m.reviewStatus !== "approved"
          ? `reviewStatus=${m.reviewStatus} (404s)`
          : "approved but thin (noindex)",
    });
  }

  // ── Reviewers ─────────────────────────────────────────────────────────────
  const reviewers = await MedicalReviewer.find()
    .select("slug name isActive")
    .lean<{ slug: string; name: string; isActive: boolean }[]>();
  for (const r of reviewers)
    rows.push({
      path: `/reviewers/${r.slug}`,
      name: r.name,
      kind: "reviewer",
      live: r.isActive,
      note: r.isActive ? "" : "inactive",
    });

  // ── Editor-composed pages ─────────────────────────────────────────────────
  const pages = await Page.find()
    .select("slug title reviewStatus")
    .lean<{ slug: string; title: string; reviewStatus: string }[]>();
  for (const p of pages)
    rows.push({
      path: `/${p.slug}`,
      name: p.title,
      kind: "cms-page",
      live: p.reviewStatus === "approved",
      note:
        p.reviewStatus === "approved" ? "" : `reviewStatus=${p.reviewStatus}`,
    });

  // ── Curated clinic landings ───────────────────────────────────────────────
  const landings = await ClinicLanding.find()
    .select("slug title heading isActive seo")
    .lean<any[]>();
  for (const l of landings)
    rows.push({
      path: `/clinics/${l.slug}`,
      name: l.title || l.heading || l.slug,
      kind: "clinic-landing",
      live: Boolean(l.isActive) && !l.seo?.noindex,
      note: !l.isActive ? "inactive" : l.seo?.noindex ? "noindex" : "",
    });

  process.stdout.write(JSON.stringify(rows, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
