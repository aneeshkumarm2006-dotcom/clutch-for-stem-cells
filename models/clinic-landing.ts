/**
 * ClinicLanding — a curated directory landing page served at `/clinics/{slug}`.
 *
 * The taxonomy routes (`/treatments/…`, `/locations/{country}/{city}`) cover the
 * dimensions the data model already has a term for. This covers the ones it
 * doesn't: a US state, a metro area, a "city, ST" page, or any hand-picked cut
 * of the directory an editor wants to rank for — without inventing a fake
 * taxonomy term that would then pollute the filter rails and hub pages.
 *
 * A landing page is nothing but a heading, an intro, meta copy, and a set of
 * **pinned filters** that are applied to the same `getDirectoryData` query every
 * other directory page runs. It owns no clinic data of its own, so it can never
 * drift from the directory it summarizes.
 *
 * Like every other public content type, `isActive: false` takes it offline and
 * an incomplete page can be held back from the index with `noindex` on `seo`.
 */
import { Schema, type Types } from "mongoose";

import {
  imageSchema,
  seoSchema,
  schemaOverrideSchema,
  faqSchema,
  registerModel,
  type IFaqEntry,
  type IImage,
  type ISchemaOverrides,
  type ISeo,
  type TimestampFields,
} from "@/models/_shared";

/**
 * The directory cut this page represents. Every field is matched against the
 * clinic's own `locations[]` entries (case-insensitively) or its taxonomy refs,
 * exactly as the equivalent query-string filter would be.
 */
export interface IClinicLandingFilters {
  /** `locations.country` — the country *name*, e.g. "United States". */
  country?: string;
  /** `locations.region` — state/province, e.g. "Florida". */
  region?: string;
  /** `locations.city`, e.g. "Denver". */
  city?: string;
  /** Treatment term slugs (OR within). */
  treatments?: string[];
  /** Condition term slugs (OR within). */
  conditions?: string[];
}

export interface IClinicLanding extends TimestampFields {
  _id: Types.ObjectId;
  /** URL segment — the page is served at `/clinics/{slug}`. */
  slug: string;
  /** Admin-facing name and default `<h1>` when `heading` is blank. */
  name: string;
  /** On-page `<h1>`, e.g. "Stem cell clinics in Denver". */
  heading?: string;
  /** Lede under the H1 — also the fallback meta description. */
  intro?: string;
  image?: IImage;
  filters: IClinicLandingFilters;
  seo?: ISeo;
  schemaOverrides?: ISchemaOverrides;
  /** Scoped Q&A → visible accordion + FAQPage JSON-LD (AEO). */
  faqs: IFaqEntry[];
  order: number;
  isActive: boolean;
}

const filtersSchema = new Schema<IClinicLandingFilters>(
  {
    country: { type: String, trim: true },
    region: { type: String, trim: true },
    city: { type: String, trim: true },
    treatments: { type: [String], default: undefined },
    conditions: { type: [String], default: undefined },
  },
  { _id: false },
);

const ClinicLandingSchema = new Schema<IClinicLanding>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    heading: { type: String, trim: true, maxlength: 200 },
    intro: { type: String, trim: true, maxlength: 2000 },
    image: { type: imageSchema, default: undefined },
    filters: { type: filtersSchema, default: () => ({}) },
    seo: { type: seoSchema, default: undefined },
    schemaOverrides: { type: schemaOverrideSchema, default: undefined },
    faqs: { type: [faqSchema], default: [] },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

// Public list/sitemap read: active pages in editor-defined order.
ClinicLandingSchema.index({ isActive: 1, order: 1 });

export const ClinicLanding = registerModel<IClinicLanding>(
  "ClinicLanding",
  ClinicLandingSchema,
);
export default ClinicLanding;
