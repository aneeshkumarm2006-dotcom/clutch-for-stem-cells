/**
 * Clinic landing-page admin read layer — `/admin/content/clinic-landings`.
 *
 * Mirrors `lib/admin/taxonomy.ts`: returns plain serializable rows (never a
 * hydrated Mongoose doc) and includes inactive records, because an editor has to
 * be able to see and re-activate what they turned off.
 */
import "server-only";

import { dbConnect } from "@/lib/db";
import { id } from "@/lib/admin/serialize";
import { ClinicLanding } from "@/models";

export interface AdminClinicLandingRow {
  id: string;
  slug: string;
  name: string;
  heading: string;
  intro: string;
  path: string;
  filters: {
    country: string;
    region: string;
    city: string;
    treatments: string[];
    conditions: string[];
  };
  metaTitle: string;
  metaDescription: string;
  noindex: boolean;
  faqs: { question: string; answer: string }[];
  order: number;
  isActive: boolean;
  updatedAt: string;
}

export async function getAdminClinicLandings(): Promise<
  AdminClinicLandingRow[]
> {
  await dbConnect();
  const docs = await ClinicLanding.find({})
    .sort({ order: 1, name: 1 })
    .lean();

  return docs.map((d) => ({
    id: id(d._id),
    slug: d.slug,
    name: d.name,
    heading: d.heading ?? "",
    intro: d.intro ?? "",
    path: `/clinics/${d.slug}`,
    filters: {
      country: d.filters?.country ?? "",
      region: d.filters?.region ?? "",
      city: d.filters?.city ?? "",
      treatments: d.filters?.treatments ?? [],
      conditions: d.filters?.conditions ?? [],
    },
    metaTitle: d.seo?.metaTitle ?? "",
    metaDescription: d.seo?.metaDescription ?? "",
    noindex: Boolean(d.seo?.noindex),
    faqs: (d.faqs ?? []).map((f) => ({
      question: f.question,
      answer: f.answer,
    })),
    order: d.order ?? 0,
    isActive: d.isActive,
    updatedAt: d.updatedAt.toISOString(),
  }));
}
