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
  enableResources: boolean;
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
  /** Title template, e.g. "%s · StemConnect". */
  titleTemplate?: string;
  twitterHandle?: string;
}

export interface ISiteSetting extends TimestampFields {
  _id: Types.ObjectId;
  key: string;
  hero?: IHero;
  popularSearches: IPopularSearch[];
  featuredClinicIds: Types.ObjectId[];
  testimonials: ITestimonial[];
  partnerLogos: IImage[];
  seoDefaults?: ISeoDefaults;
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
    enableResources: { type: Boolean, default: true },
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
    popularSearches: { type: [popularSearchSchema], default: [] },
    featuredClinicIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Clinic" }],
      default: [],
    },
    testimonials: { type: [testimonialSchema], default: [] },
    partnerLogos: { type: [imageSchema], default: [] },
    seoDefaults: { type: seoDefaultsSchema, default: () => ({}) },
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
