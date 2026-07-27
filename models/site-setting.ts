/**
 * SiteSetting — keyed singleton (PRD §5.8 / Stage 1.8).
 *
 * One document (`key: "global"`) holds runtime-tunable site content: homepage
 * hero, popular searches, featured clinics, testimonials, disclaimers, SEO
 * defaults, contact/social, feature flags, and the admin-tunable ranking
 * weights consumed by `/lib/ranking.ts` (PRD §9). Use `SiteSetting.getGlobal()`.
 */
import { Schema, type Model, type Types } from "mongoose";
import {
  imageSchema,
  seoSchema,
  registerModel,
  type IImage,
  type ISeo,
  type TimestampFields,
} from "@/models/_shared";

export const GLOBAL_SETTINGS_KEY = "global";

export interface IHero {
  headline?: string;
  subhead?: string;
  ctaPrimaryLabel?: string;
  ctaSecondaryLabel?: string;
  backgroundImage?: IImage;
}

export interface IPopularSearch {
  label: string;
  href: string;
}

/**
 * Homepage (landing page) content — everything the `/` route renders that used
 * to be hardcoded in the page component: section headings, the highlight cards,
 * the "how it works" steps, the cost/benefits columns, the trust strip, the
 * for-clinics band and the FAQ that also feeds the page's `FAQPage` JSON-LD.
 *
 * Every field is optional and a blank one means "use the shipped copy" — the
 * merge lives in `config/homepage.ts` (`resolveHomepage`), which is also where
 * the defaults are. That keeps this sub-document a pure overlay: an editor who
 * clears a field restores the shipped string rather than blanking the page.
 *
 * The four pieces that predate it — `hero`, `popularSearches`, `testimonials`,
 * `featuredClinicIds` — deliberately keep their existing top-level storage so no
 * content had to move; `resolveHomepage` stitches both halves together.
 */
export interface IHomepageFeedSection {
  enabled?: boolean;
  eyebrow?: string;
  title?: string;
  description?: string;
  linkLabel?: string;
  linkHref?: string;
  limit?: number;
}

export interface IHomepageCard {
  title?: string;
  body?: string;
  href?: string;
}

export interface IHomepageStep {
  icon?: string;
  title?: string;
  body?: string;
}

export interface IHomepageFaqItem {
  question?: string;
  answer?: string;
}

export interface IHomepageColumn {
  title?: string;
  intro?: string;
  bullets?: string[];
  outro?: string;
  ctaLabel?: string;
  ctaHref?: string;
  disclaimer?: string;
}

export interface IHomepage {
  hero?: {
    ctaPrimaryHref?: string;
    ctaSecondaryHref?: string;
    showSearch?: boolean;
    popularLabel?: string;
  };
  treatments?: IHomepageFeedSection;
  conditions?: IHomepageFeedSection;
  highlights?: {
    enabled?: boolean;
    eyebrow?: string;
    title?: string;
    description?: string;
    cards?: IHomepageCard[];
  };
  destinations?: IHomepageFeedSection;
  featured?: IHomepageFeedSection;
  howItWorks?: {
    enabled?: boolean;
    eyebrow?: string;
    title?: string;
    description?: string;
    steps?: IHomepageStep[];
  };
  costBenefits?: { enabled?: boolean; columns?: IHomepageColumn[] };
  trust?: {
    enabled?: boolean;
    badge?: string;
    title?: string;
    body?: string;
    ctaLabel?: string;
    ctaHref?: string;
    showStats?: boolean;
    clinicsLabel?: string;
    verifiedLabel?: string;
    reviewsLabel?: string;
  };
  testimonials?: {
    enabled?: boolean;
    eyebrow?: string;
    title?: string;
    description?: string;
    note?: string;
  };
  forClinics?: {
    enabled?: boolean;
    title?: string;
    body?: string;
    ctaLabel?: string;
    ctaHref?: string;
  };
  faq?: {
    enabled?: boolean;
    heading?: string;
    items?: IHomepageFaqItem[];
    moreLabel?: string;
    moreHref?: string;
    emitJsonLd?: boolean;
  };
  blog?: IHomepageFeedSection;
  /** `<meta name="keywords">` for `/`; the rest of its meta lives in `pageSeo`. */
  keywords?: string[];
}

export interface ITestimonial {
  _id?: Types.ObjectId;
  quote: string;
  author?: string;
  role?: string;
  location?: string;
  avatar?: IImage;
  rating?: number;
}

export interface IDisclaimers {
  medical?: string;
  results?: string;
  footer?: string;
}

export interface IContactInfo {
  email?: string;
  phone?: string;
  address?: string;
}

export interface ISocialLinks {
  linkedin?: string;
  instagram?: string;
  facebook?: string;
  x?: string;
  youtube?: string;
}

/** Mirrors `config/site.ts` FEATURES; Settings override the build defaults. */
export interface IFeatureFlags {
  enableCompare: boolean;
  enableProviderSelfServe: boolean;
  enableShortlist: boolean;
  enableMatchingWizard: boolean;
  enableBilling: boolean;
  enableSavedSearches: boolean;
  enableDarkMode: boolean;
}

/** Ranking weights w1..w6 (PRD §9). Admin-tunable; defaults sum to 1.0. */
export interface IRankingWeights {
  rating: number;
  reviewVolume: number;
  recency: number;
  completeness: number;
  accreditation: number;
  tier: number;
}

export interface IAnalyticsConfig {
  ga4Id?: string;
  plausibleDomain?: string;
  posthogKey?: string;
}

export interface ISeoDefaults extends ISeo {
  /** Title template, e.g. "%s | My Stem Cell Guide". */
  titleTemplate?: string;
  twitterHandle?: string;
}

/**
 * Per-route SEO override for a page whose copy lives in **code**, not in a
 * content collection — the homepage, `/clinics`, `/about`, and the other fixed
 * routes (see `config/static-pages.ts`).
 *
 * Those pages have no DB record to hang an `seo` sub-document off, so their
 * `<title>`/meta description used to be editable only by a developer. This
 * keyed list closes that gap: `pageMetadata` looks the route's `path` up here
 * and applies the override, which makes every public page metadata-editable
 * from `/admin/seo`. A record-backed page (clinic, taxonomy term, landing page)
 * still wins with its own `seo` — this only fills the gap where none exists.
 */
export interface IPageSeoOverride extends ISeo {
  /** Root-relative, normalized path with no trailing slash — `/` or `/clinics`. */
  path: string;
}

/**
 * Site identity for the structured-data engine — the runtime overlay on top of
 * `config/content-engine`'s build-time fallback. Lets an admin change the
 * publisher name, its schema.org type, and the logo that appears in every page's
 * `Organization` node without a redeploy. Blank fields fall back to config.
 */
export interface IStructuredData {
  /** Publisher name. Defaults to `SITE_NAME`. */
  organizationName?: string;
  /** schema.org publisher type, e.g. "Organization" / "MedicalOrganization". */
  organizationType?: string;
  /** Logo shown in `Organization.logo`. */
  logo?: IImage;
}

export interface ISiteSetting extends TimestampFields {
  _id: Types.ObjectId;
  key: string;
  hero?: IHero;
  /** Overlay for the rest of the landing page (see {@link IHomepage}). */
  homepage?: IHomepage;
  popularSearches: IPopularSearch[];
  featuredClinicIds: Types.ObjectId[];
  testimonials: ITestimonial[];
  partnerLogos: IImage[];
  seoDefaults?: ISeoDefaults;
  /** Per-route meta overrides for the code-owned (fixed) public routes. */
  pageSeo: IPageSeoOverride[];
  /** Site identity for the structured-data engine (Organization node). */
  structuredData?: IStructuredData;
  disclaimers?: IDisclaimers;
  contact?: IContactInfo;
  social?: ISocialLinks;
  featureFlags?: IFeatureFlags;
  rankingWeights?: IRankingWeights;
  analytics?: IAnalyticsConfig;
}

export interface SiteSettingModel extends Model<ISiteSetting> {
  getGlobal(): Promise<ISiteSetting>;
}

// ── Sub-schemas ─────────────────────────────────────────────────────────────

const heroSchema = new Schema<IHero>(
  {
    headline: { type: String, trim: true },
    subhead: { type: String, trim: true },
    ctaPrimaryLabel: { type: String, trim: true },
    ctaSecondaryLabel: { type: String, trim: true },
    backgroundImage: { type: imageSchema, default: undefined },
  },
  { _id: false },
);

const popularSearchSchema = new Schema<IPopularSearch>(
  {
    label: { type: String, required: true, trim: true },
    href: { type: String, required: true, trim: true },
  },
  { _id: false },
);

// ── Homepage overlay sub-schemas ────────────────────────────────────────────
//
// Nothing is `required` and nothing has a default: an absent field means "fall
// back to the shipped copy", which `resolveHomepage` decides — a schema-level
// default here would shadow that and freeze today's copy into the database.

const homepageFeedSectionSchema = new Schema<IHomepageFeedSection>(
  {
    enabled: { type: Boolean },
    eyebrow: { type: String, trim: true },
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    linkLabel: { type: String, trim: true },
    linkHref: { type: String, trim: true },
    limit: { type: Number, min: 1, max: 24 },
  },
  { _id: false },
);

const homepageCardSchema = new Schema<IHomepageCard>(
  {
    title: { type: String, trim: true },
    body: { type: String, trim: true },
    href: { type: String, trim: true },
  },
  { _id: false },
);

const homepageStepSchema = new Schema<IHomepageStep>(
  {
    icon: { type: String, trim: true },
    title: { type: String, trim: true },
    body: { type: String, trim: true },
  },
  { _id: false },
);

const homepageFaqItemSchema = new Schema<IHomepageFaqItem>(
  {
    question: { type: String, trim: true },
    answer: { type: String, trim: true },
  },
  { _id: false },
);

const homepageColumnSchema = new Schema<IHomepageColumn>(
  {
    title: { type: String, trim: true },
    intro: { type: String, trim: true },
    bullets: { type: [String], default: undefined },
    outro: { type: String, trim: true },
    ctaLabel: { type: String, trim: true },
    ctaHref: { type: String, trim: true },
    disclaimer: { type: String, trim: true },
  },
  { _id: false },
);

const homepageSchema = new Schema<IHomepage>(
  {
    hero: {
      type: new Schema(
        {
          ctaPrimaryHref: { type: String, trim: true },
          ctaSecondaryHref: { type: String, trim: true },
          showSearch: { type: Boolean },
          popularLabel: { type: String, trim: true },
        },
        { _id: false },
      ),
      default: undefined,
    },
    treatments: { type: homepageFeedSectionSchema, default: undefined },
    conditions: { type: homepageFeedSectionSchema, default: undefined },
    highlights: {
      type: new Schema(
        {
          enabled: { type: Boolean },
          eyebrow: { type: String, trim: true },
          title: { type: String, trim: true },
          description: { type: String, trim: true },
          cards: { type: [homepageCardSchema], default: undefined },
        },
        { _id: false },
      ),
      default: undefined,
    },
    destinations: { type: homepageFeedSectionSchema, default: undefined },
    featured: { type: homepageFeedSectionSchema, default: undefined },
    howItWorks: {
      type: new Schema(
        {
          enabled: { type: Boolean },
          eyebrow: { type: String, trim: true },
          title: { type: String, trim: true },
          description: { type: String, trim: true },
          steps: { type: [homepageStepSchema], default: undefined },
        },
        { _id: false },
      ),
      default: undefined,
    },
    costBenefits: {
      type: new Schema(
        {
          enabled: { type: Boolean },
          columns: { type: [homepageColumnSchema], default: undefined },
        },
        { _id: false },
      ),
      default: undefined,
    },
    trust: {
      type: new Schema(
        {
          enabled: { type: Boolean },
          badge: { type: String, trim: true },
          title: { type: String, trim: true },
          body: { type: String, trim: true },
          ctaLabel: { type: String, trim: true },
          ctaHref: { type: String, trim: true },
          showStats: { type: Boolean },
          clinicsLabel: { type: String, trim: true },
          verifiedLabel: { type: String, trim: true },
          reviewsLabel: { type: String, trim: true },
        },
        { _id: false },
      ),
      default: undefined,
    },
    testimonials: {
      type: new Schema(
        {
          enabled: { type: Boolean },
          eyebrow: { type: String, trim: true },
          title: { type: String, trim: true },
          description: { type: String, trim: true },
          note: { type: String, trim: true },
        },
        { _id: false },
      ),
      default: undefined,
    },
    forClinics: {
      type: new Schema(
        {
          enabled: { type: Boolean },
          title: { type: String, trim: true },
          body: { type: String, trim: true },
          ctaLabel: { type: String, trim: true },
          ctaHref: { type: String, trim: true },
        },
        { _id: false },
      ),
      default: undefined,
    },
    faq: {
      type: new Schema(
        {
          enabled: { type: Boolean },
          heading: { type: String, trim: true },
          items: { type: [homepageFaqItemSchema], default: undefined },
          moreLabel: { type: String, trim: true },
          moreHref: { type: String, trim: true },
          emitJsonLd: { type: Boolean },
        },
        { _id: false },
      ),
      default: undefined,
    },
    blog: { type: homepageFeedSectionSchema, default: undefined },
    keywords: { type: [String], default: undefined },
  },
  { _id: false },
);

const testimonialSchema = new Schema<ITestimonial>({
  quote: { type: String, required: true, trim: true },
  author: { type: String, trim: true },
  role: { type: String, trim: true },
  location: { type: String, trim: true },
  avatar: { type: imageSchema, default: undefined },
  rating: { type: Number, min: 1, max: 5 },
});

const disclaimersSchema = new Schema<IDisclaimers>(
  {
    medical: { type: String, trim: true },
    results: { type: String, trim: true },
    footer: { type: String, trim: true },
  },
  { _id: false },
);

const contactSchema = new Schema<IContactInfo>(
  {
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
  },
  { _id: false },
);

const socialLinksSchema = new Schema<ISocialLinks>(
  {
    linkedin: { type: String, trim: true },
    instagram: { type: String, trim: true },
    facebook: { type: String, trim: true },
    x: { type: String, trim: true },
    youtube: { type: String, trim: true },
  },
  { _id: false },
);

const featureFlagsSchema = new Schema<IFeatureFlags>(
  {
    enableCompare: { type: Boolean, default: false },
    enableProviderSelfServe: { type: Boolean, default: false },
    enableShortlist: { type: Boolean, default: true },
    enableMatchingWizard: { type: Boolean, default: true },
    enableBilling: { type: Boolean, default: false },
    enableSavedSearches: { type: Boolean, default: false },
    enableDarkMode: { type: Boolean, default: false },
  },
  { _id: false },
);

const rankingWeightsSchema = new Schema<IRankingWeights>(
  {
    rating: { type: Number, default: 0.4, min: 0 },
    reviewVolume: { type: Number, default: 0.15, min: 0 },
    recency: { type: Number, default: 0.1, min: 0 },
    completeness: { type: Number, default: 0.15, min: 0 },
    accreditation: { type: Number, default: 0.1, min: 0 },
    tier: { type: Number, default: 0.1, min: 0 },
  },
  { _id: false },
);

const analyticsSchema = new Schema<IAnalyticsConfig>(
  {
    ga4Id: { type: String, trim: true },
    plausibleDomain: { type: String, trim: true },
    posthogKey: { type: String, trim: true },
  },
  { _id: false },
);

const seoDefaultsSchema = new Schema<ISeoDefaults>(
  {
    ...seoSchema.obj,
    titleTemplate: { type: String, trim: true },
    twitterHandle: { type: String, trim: true },
  },
  { _id: false },
);

const pageSeoOverrideSchema = new Schema<IPageSeoOverride>(
  {
    ...seoSchema.obj,
    path: { type: String, required: true, trim: true, lowercase: true },
  },
  { _id: false },
);

const structuredDataSchema = new Schema<IStructuredData>(
  {
    organizationName: { type: String, trim: true },
    organizationType: { type: String, trim: true },
    logo: { type: imageSchema, default: undefined },
  },
  { _id: false },
);

// ── SiteSetting schema ──────────────────────────────────────────────────────

const SiteSettingSchema = new Schema<ISiteSetting, SiteSettingModel>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: GLOBAL_SETTINGS_KEY,
    },
    hero: { type: heroSchema, default: () => ({}) },
    homepage: { type: homepageSchema, default: () => ({}) },
    popularSearches: { type: [popularSearchSchema], default: [] },
    featuredClinicIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Clinic" }],
      default: [],
    },
    testimonials: { type: [testimonialSchema], default: [] },
    partnerLogos: { type: [imageSchema], default: [] },
    seoDefaults: { type: seoDefaultsSchema, default: () => ({}) },
    pageSeo: { type: [pageSeoOverrideSchema], default: [] },
    structuredData: { type: structuredDataSchema, default: () => ({}) },
    disclaimers: { type: disclaimersSchema, default: () => ({}) },
    contact: { type: contactSchema, default: () => ({}) },
    social: { type: socialLinksSchema, default: () => ({}) },
    featureFlags: { type: featureFlagsSchema, default: () => ({}) },
    rankingWeights: { type: rankingWeightsSchema, default: () => ({}) },
    analytics: { type: analyticsSchema, default: () => ({}) },
  },
  { timestamps: true },
);

/** Fetch (or lazily create) the singleton global settings document. */
SiteSettingSchema.statics.getGlobal = async function getGlobal(
  this: SiteSettingModel,
): Promise<ISiteSetting> {
  const existing = await this.findOne({ key: GLOBAL_SETTINGS_KEY });
  if (existing) return existing;
  return this.create({ key: GLOBAL_SETTINGS_KEY });
};

export const SiteSetting = registerModel<ISiteSetting>(
  "SiteSetting",
  SiteSettingSchema as Schema<ISiteSetting>,
) as SiteSettingModel;
export default SiteSetting;
