/**
 * Clinic — the central entity (PRD §5.1 / Stage 1.1).
 *
 * Taxonomy fields hold ObjectId refs (Treatment/Condition/CellSource/
 * Accreditation). Rating fields (`ratingAvg`, `ratingBreakdown`, `reviewCount`,
 * `topMentions`) and `sortScore` are denormalized/computed — recomputed by
 * `/lib/ratings.ts` (Stage 3.2) and `/lib/ranking.ts` (Stage 3.1).
 */
import { Schema, type Types } from "mongoose";
import {
  CLINIC_STATUSES,
  CLINIC_TIERS,
  EXTERNAL_SENTIMENTS,
  PRICE_MODELS,
  TEAM_SIZES,
  VERIFICATION_BADGES,
} from "@/lib/enums";
import type {
  ClinicStatus,
  ClinicTier,
  ExternalSentiment,
  PriceModel,
  TeamSize,
  VerificationBadge,
} from "@/lib/enums";
import {
  imageSchema,
  personSchema,
  seoSchema,
  schemaOverrideSchema,
  softDeletePlugin,
  registerModel,
  type ISchemaOverrides,
  type IImage,
  type IPerson,
  type ISeo,
  type SoftDeleteFields,
  type TimestampFields,
} from "@/models/_shared";

// ── Sub-document interfaces ─────────────────────────────────────────────────

export interface IVerification {
  isVerified: boolean;
  verifiedAt?: Date | null;
  badge?: VerificationBadge;
  method?: string;
  notes?: string;
}

/** `{ treatmentId, percent }` — mirrors Clutch's "X% Web Development" split. */
export interface IServiceFocus {
  treatmentId: Types.ObjectId;
  percent: number;
}

export interface IClinicLocation {
  _id?: Types.ObjectId;
  isHQ: boolean;
  addressLine?: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
  phone?: string;
}

export interface ISocial {
  linkedin?: string;
  instagram?: string;
  facebook?: string;
  x?: string;
  youtube?: string;
}

export interface ICaseStudy {
  _id?: Types.ObjectId;
  title: string;
  conditionId?: Types.ObjectId;
  summary?: string;
  outcome?: string;
  images?: IImage[];
  isAnonymized: boolean;
}

export interface IFaq {
  _id?: Types.ObjectId;
  question: string;
  answer: string;
}

/** Denormalized sub-rating averages (PRD §5.1). Keys mirror `SUB_RATING_KEYS`. */
export interface IRatingBreakdown {
  outcome: number;
  communication: number;
  facility: number;
  value: number;
  refer: number;
}

/** Tallied review themes — like Clutch "Timely (30)" (PRD §5.1). */
export interface ITopMention {
  tag: string;
  count: number;
}

/**
 * Editor-authored copy + meta for the clinic's child reviews page
 * (`/clinic/[slug]/reviews`).
 *
 * That route is a distinct URL from the profile with its own query intent
 * ("<clinic> reviews"), so it needs its own overrides: reusing `Clinic.seo`
 * would point this page's canonical at the profile. Every field is optional —
 * unset means "keep the auto-generated copy derived from the clinic's name,
 * location, rating and review count", which is exactly how every existing
 * clinic (which has no `reviewsPage`) already behaves.
 */
export interface IClinicReviewsPage {
  /** H1 override. Default: "<name> reviews". */
  heading?: string;
  /** Intro paragraph shown when the clinic has published reviews. */
  intro?: string;
  /** Intro paragraph shown when it has none yet. */
  introEmpty?: string;
  /** Markdown section rendered under the review list (editorial context). */
  bodyMarkdown?: string;
  /** Sidebar "Been treated here?" card copy. */
  ctaHeading?: string;
  ctaBody?: string;
  /** Meta overrides for this URL only — never inherited from `Clinic.seo`. */
  seo?: ISeo;
}

/** One row of the cost page's price table. */
export interface IClinicPriceItem {
  _id?: Types.ObjectId;
  /** What is being priced, e.g. "Knee, bone marrow concentrate". */
  label: string;
  /** Low end. Omit both bounds for a line the clinic only quotes privately. */
  priceMin?: number;
  priceMax?: number;
  /** Per-row currency override. Defaults to the clinic's `currency`. */
  currency?: string;
  /** What the figure is per, e.g. "per joint", "per month", "one time". */
  unit?: string;
  /** Caveat shown under the row. */
  note?: string;
}

/** A published source a price was taken from, for the "where this came from" list. */
export interface IPriceSource {
  label: string;
  url?: string;
}

/**
 * Editor-authored copy + price data for the clinic's child cost page
 * (`/clinic/[slug]/cost`).
 *
 * Same seam as {@link IClinicReviewsPage}: its own `seo` (reusing `Clinic.seo`
 * would canonicalize this URL at the profile) and every copy field optional so
 * an unset one keeps the derived default. The difference is that this page also
 * owns *data* the profile has nowhere to put — `Clinic.priceMin`/`priceMax` are
 * a single headline range, while a real cost answer is a table of lines plus
 * what the number does and does not cover.
 *
 * `items` is the page's reason to exist: an empty array is a valid state (the
 * clinic quotes everything privately) and the page then answers "how the quote
 * works" instead of "what it costs".
 */
export interface IClinicCostPage {
  /** H1 override. Default: "<name> cost". */
  heading?: string;
  /** Intro paragraph shown when there is a price table. */
  intro?: string;
  /** Intro paragraph shown when there is not. */
  introEmpty?: string;
  /** The price table. */
  items?: IClinicPriceItem[];
  /** What a quoted price covers. */
  includes?: string[];
  /** What it does not, and is billed on top. */
  excludes?: string[];
  /** Insurance / HSA / FSA position. */
  insuranceNote?: string;
  /** Payment plans, deposits, financing partners. */
  financingNote?: string;
  /** Markdown section rendered under the tables (editorial context). */
  bodyMarkdown?: string;
  /** Cost-specific Q&A — rendered on the page and emitted as `FAQPage`. */
  faqs?: IFaq[];
  /** Where the figures came from. */
  sources?: IPriceSource[];
  /** When the figures were last checked against those sources. */
  lastVerifiedAt?: Date | null;
  /** Sidebar card copy. */
  ctaHeading?: string;
  ctaBody?: string;
  /** Meta overrides for this URL only — never inherited from `Clinic.seo`. */
  seo?: ISeo;
}

/** A place a reader can go and check an external summary for themselves. */
export interface IExternalSource {
  label: string;
  url?: string;
}

/**
 * A single Google reviewer's own words, reproduced verbatim and attributed.
 *
 * Short excerpts under the reviewer's real display name, the way an editor
 * quotes a source: the quote is checkable against `IExternalReviewSummary.url`,
 * and `publishedAt` dates it so a two-year-old complaint isn't read as current.
 *
 * Three things a highlight is deliberately not:
 *
 *  - **Not a review on this site.** It never becomes a `Review` document, never
 *    touches `ratingAvg`/`reviewCount`/`sortScore`, and never appears in the
 *    clinic's `Review` or `aggregateRating` JSON-LD. Marking up review content
 *    this site did not collect is the review-snippet abuse Google penalises.
 *  - **Not a rewrite.** `text` is the reviewer's wording, trimmed at most to a
 *    sentence boundary with an ellipsis. Paraphrasing someone's complaint into
 *    softer prose and leaving their name on it misrepresents them.
 *  - **Not a fair summary on its own.** Two quotes are not a reading of two
 *    hundred ratings, which is what `summary` is for. Quote both directions
 *    when the listing runs mixed.
 */
export interface IExternalReviewHighlight {
  /** The reviewer's Google display name, as shown on the listing. */
  author: string;
  /** That reviewer's own 1-5 star rating, when the listing shows one. */
  rating?: number;
  /** The reviewer's wording, verbatim. */
  text: string;
  /** When they posted, so the excerpt can be dated rather than floating. */
  publishedAt?: Date | null;
  /**
   * The source's own relative wording ("a month ago", "3 years ago") for when
   * that is all it gives.
   *
   * Google Maps publishes relative dates only. Converting "3 years ago" into
   * "August 2023" would invent a precision the source never stated, on a page
   * whose whole claim is that these quotes are checkable, so the vaguer string
   * is the more honest one. Set this OR `publishedAt`, not both; the renderer
   * prefers the exact date when it has one.
   */
  publishedLabel?: string;
  /** Deep link to the individual review, when the source exposes one. */
  url?: string;
}

/**
 * What a clinic's Google Business Profile says, as of the last time we looked.
 *
 * `rating`/`reviewCount` are Google's numbers, restated, not ours — they are
 * deliberately kept out of `ratingAvg`/`reviewCount` and out of the page's
 * `aggregateRating` JSON-LD. Blending a directory's own moderated reviews with
 * a number we cannot audit would misstate both, and marking up a rating this
 * site did not collect is exactly the review-snippet abuse Google penalises.
 *
 * `summary` is written in our own words and stays the primary signal.
 * `highlights` carries verbatim reviewer quotes under the same rule: attributed
 * to Google, dated, linked, and kept out of every number and every schema node
 * this site publishes. See {@link IExternalReviewHighlight}.
 */
export interface IExternalReviewSummary {
  /** Google's published 1-5 average. */
  rating?: number;
  /** How many ratings that average is computed from. */
  reviewCount?: number;
  /** Two or three sentences characterising what reviewers report. */
  summary?: string;
  /** Recurring themes as short noun phrases, strongest first. */
  themes?: string[];
  /** A few of the listing's top reviews, quoted and attributed. */
  highlights?: IExternalReviewHighlight[];
  /** The listing itself, so the claim is checkable. */
  url?: string;
  /** When the figures were last read off the source. */
  checkedAt?: Date | null;
}

/**
 * What people say about the clinic on Reddit, where there is no star rating and
 * the useful signal is whether anyone has reported an actual outcome.
 *
 * Separate from {@link IExternalReviewSummary} because the shape of the
 * evidence is different: threads instead of ratings, and a sentiment read
 * instead of an average. A clinic with no discussion gets `limited`, which the
 * page renders as "not enough to characterise" rather than silence.
 */
export interface IRedditDiscussionSummary {
  /** Two or three sentences on what patients report, hedged where thin. */
  summary?: string;
  /** Distinct threads the summary draws on. */
  threadCount?: number;
  /** How the discussion reads on balance. */
  sentiment?: ExternalSentiment;
  /** Recurring themes as short noun phrases. */
  themes?: string[];
  /** The threads themselves, so a reader can judge the source. */
  sources?: IExternalSource[];
  /** When the threads were last read. */
  checkedAt?: Date | null;
}

/**
 * Third-party reception, shown on `/clinic/[slug]/reviews` beside this site's
 * own reviews and always labelled as coming from somewhere else.
 *
 * This is data, not copy, so it lives on the clinic rather than on
 * `reviewsPage` — same split as `costPage.items`. Every branch is optional: a
 * clinic with no Google listing and no Reddit thread renders exactly what it
 * rendered before this field existed.
 */
export interface IExternalReviews {
  google?: IExternalReviewSummary;
  reddit?: IRedditDiscussionSummary;
}

export interface IClinic extends TimestampFields, SoftDeleteFields {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  status: ClinicStatus;
  tier: ClinicTier;
  verification: IVerification;
  tagline?: string;
  description?: string;
  logo?: IImage;
  coverImage?: IImage;
  gallery: IImage[];
  videoUrl?: string;
  treatmentTypes: Types.ObjectId[];
  conditionsTreated: Types.ObjectId[];
  cellSources: Types.ObjectId[];
  serviceFocus: IServiceFocus[];
  accreditations: Types.ObjectId[];
  priceMin?: number;
  priceMax?: number;
  currency: string;
  priceModel?: PriceModel;
  priceNote?: string;
  foundedYear?: number;
  teamSize?: TeamSize;
  physiciansCount?: number;
  medicalDirector?: IPerson;
  team: IPerson[];
  languages: string[];
  locations: IClinicLocation[];
  website?: string;
  social: ISocial;
  contactEmail?: string;
  caseStudies: ICaseStudy[];
  faqs: IFaq[];
  highlights: string[];
  ratingAvg: number;
  ratingBreakdown: IRatingBreakdown;
  reviewCount: number;
  topMentions: ITopMention[];
  ownerUserId?: Types.ObjectId | null;
  isClaimed: boolean;
  seo?: ISeo;
  /** Copy + meta for the child `/clinic/[slug]/reviews` page. */
  reviewsPage?: IClinicReviewsPage;
  /** Price data + copy for the child `/clinic/[slug]/cost` page. */
  costPage?: IClinicCostPage;
  /** Google + Reddit reception, summarised. Never folded into `ratingAvg`. */
  externalReviews?: IExternalReviews;
  /** Per-page control over the auto-generated JSON-LD (schema engine). */
  schemaOverrides?: ISchemaOverrides;
  sortScore: number;
}

// ── Sub-schemas ─────────────────────────────────────────────────────────────

const verificationSchema = new Schema<IVerification>(
  {
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
    badge: { type: String, enum: VERIFICATION_BADGES },
    method: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { _id: false },
);

const serviceFocusSchema = new Schema<IServiceFocus>(
  {
    treatmentId: {
      type: Schema.Types.ObjectId,
      ref: "Treatment",
      required: true,
    },
    percent: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false },
);

const clinicLocationSchema = new Schema<IClinicLocation>({
  isHQ: { type: Boolean, default: false },
  addressLine: { type: String, trim: true },
  city: { type: String, trim: true },
  region: { type: String, trim: true },
  country: { type: String, trim: true },
  countryCode: { type: String, trim: true, uppercase: true },
  postalCode: { type: String, trim: true },
  lat: { type: Number, min: -90, max: 90 },
  lng: { type: Number, min: -180, max: 180 },
  phone: { type: String, trim: true },
});

const socialSchema = new Schema<ISocial>(
  {
    linkedin: { type: String, trim: true },
    instagram: { type: String, trim: true },
    facebook: { type: String, trim: true },
    x: { type: String, trim: true },
    youtube: { type: String, trim: true },
  },
  { _id: false },
);

const caseStudySchema = new Schema<ICaseStudy>({
  title: { type: String, required: true, trim: true },
  conditionId: { type: Schema.Types.ObjectId, ref: "Condition" },
  summary: { type: String, trim: true },
  outcome: { type: String, trim: true },
  images: { type: [imageSchema], default: [] },
  // Trust & safety §8.2: results vary; case studies anonymized by default.
  isAnonymized: { type: Boolean, default: true },
});

const faqSchema = new Schema<IFaq>({
  question: { type: String, required: true, trim: true },
  answer: { type: String, required: true, trim: true },
});

const ratingBreakdownSchema = new Schema<IRatingBreakdown>(
  {
    outcome: { type: Number, default: 0, min: 0, max: 5 },
    communication: { type: Number, default: 0, min: 0, max: 5 },
    facility: { type: Number, default: 0, min: 0, max: 5 },
    value: { type: Number, default: 0, min: 0, max: 5 },
    refer: { type: Number, default: 0, min: 0, max: 5 },
  },
  { _id: false },
);

const topMentionSchema = new Schema<ITopMention>(
  {
    tag: { type: String, required: true, trim: true },
    count: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const clinicReviewsPageSchema = new Schema<IClinicReviewsPage>(
  {
    heading: { type: String, trim: true, maxlength: 200 },
    intro: { type: String, trim: true, maxlength: 2000 },
    introEmpty: { type: String, trim: true, maxlength: 2000 },
    bodyMarkdown: { type: String },
    ctaHeading: { type: String, trim: true, maxlength: 200 },
    ctaBody: { type: String, trim: true, maxlength: 1000 },
    seo: { type: seoSchema, default: undefined },
  },
  { _id: false },
);

const priceItemSchema = new Schema<IClinicPriceItem>({
  label: { type: String, required: true, trim: true, maxlength: 200 },
  priceMin: { type: Number, min: 0 },
  priceMax: { type: Number, min: 0 },
  currency: { type: String, uppercase: true, trim: true },
  unit: { type: String, trim: true, maxlength: 60 },
  note: { type: String, trim: true, maxlength: 500 },
});

const priceSourceSchema = new Schema<IPriceSource>(
  {
    label: { type: String, required: true, trim: true, maxlength: 200 },
    url: { type: String, trim: true },
  },
  { _id: false },
);

const clinicCostPageSchema = new Schema<IClinicCostPage>(
  {
    heading: { type: String, trim: true, maxlength: 200 },
    intro: { type: String, trim: true, maxlength: 2000 },
    introEmpty: { type: String, trim: true, maxlength: 2000 },
    items: { type: [priceItemSchema], default: [] },
    includes: { type: [String], default: [] },
    excludes: { type: [String], default: [] },
    insuranceNote: { type: String, trim: true, maxlength: 1000 },
    financingNote: { type: String, trim: true, maxlength: 1000 },
    bodyMarkdown: { type: String },
    faqs: { type: [faqSchema], default: [] },
    sources: { type: [priceSourceSchema], default: [] },
    lastVerifiedAt: { type: Date, default: null },
    ctaHeading: { type: String, trim: true, maxlength: 200 },
    ctaBody: { type: String, trim: true, maxlength: 1000 },
    seo: { type: seoSchema, default: undefined },
  },
  { _id: false },
);

const externalSourceSchema = new Schema<IExternalSource>(
  {
    label: { type: String, required: true, trim: true, maxlength: 200 },
    url: { type: String, trim: true },
  },
  { _id: false },
);

const externalReviewHighlightSchema = new Schema<IExternalReviewHighlight>(
  {
    author: { type: String, required: true, trim: true, maxlength: 120 },
    rating: { type: Number, min: 1, max: 5 },
    // Capped well below a full Google review. A highlight is an excerpt; if a
    // quote needs more than this, the point belongs in `summary` instead.
    text: { type: String, required: true, trim: true, maxlength: 600 },
    publishedAt: { type: Date, default: null },
    publishedLabel: { type: String, trim: true, maxlength: 60 },
    url: { type: String, trim: true },
  },
  { _id: false },
);

const externalReviewSummarySchema = new Schema<IExternalReviewSummary>(
  {
    rating: { type: Number, min: 0, max: 5 },
    reviewCount: { type: Number, min: 0 },
    summary: { type: String, trim: true, maxlength: 1200 },
    themes: { type: [String], default: [] },
    highlights: { type: [externalReviewHighlightSchema], default: [] },
    url: { type: String, trim: true },
    checkedAt: { type: Date, default: null },
  },
  { _id: false },
);

const redditDiscussionSummarySchema = new Schema<IRedditDiscussionSummary>(
  {
    summary: { type: String, trim: true, maxlength: 1200 },
    threadCount: { type: Number, min: 0 },
    sentiment: { type: String, enum: EXTERNAL_SENTIMENTS },
    themes: { type: [String], default: [] },
    sources: { type: [externalSourceSchema], default: [] },
    checkedAt: { type: Date, default: null },
  },
  { _id: false },
);

const externalReviewsSchema = new Schema<IExternalReviews>(
  {
    google: { type: externalReviewSummarySchema, default: undefined },
    reddit: { type: redditDiscussionSummarySchema, default: undefined },
  },
  { _id: false },
);

// ── Clinic schema ───────────────────────────────────────────────────────────

const ClinicSchema = new Schema<IClinic>(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: CLINIC_STATUSES,
      default: "draft",
      index: true,
    },
    tier: { type: String, enum: CLINIC_TIERS, default: "basic" },
    verification: {
      type: verificationSchema,
      default: () => ({ isVerified: false }),
    },
    tagline: { type: String, trim: true },
    description: { type: String },
    logo: { type: imageSchema, default: undefined },
    coverImage: { type: imageSchema, default: undefined },
    gallery: { type: [imageSchema], default: [] },
    videoUrl: { type: String, trim: true },

    treatmentTypes: {
      type: [{ type: Schema.Types.ObjectId, ref: "Treatment" }],
      default: [],
    },
    conditionsTreated: {
      type: [{ type: Schema.Types.ObjectId, ref: "Condition" }],
      default: [],
    },
    cellSources: {
      type: [{ type: Schema.Types.ObjectId, ref: "CellSource" }],
      default: [],
    },
    serviceFocus: { type: [serviceFocusSchema], default: [] },
    accreditations: {
      type: [{ type: Schema.Types.ObjectId, ref: "Accreditation" }],
      default: [],
    },

    priceMin: { type: Number, min: 0 },
    priceMax: { type: Number, min: 0 },
    currency: { type: String, default: "USD", uppercase: true, trim: true },
    priceModel: { type: String, enum: PRICE_MODELS },
    priceNote: { type: String, trim: true },

    foundedYear: { type: Number, min: 1800, max: 2200 },
    teamSize: { type: String, enum: TEAM_SIZES },
    physiciansCount: { type: Number, min: 0 },
    medicalDirector: { type: personSchema, default: undefined },
    team: { type: [personSchema], default: [] },
    languages: { type: [String], default: [] },

    // PRD §5.1: at least one location required.
    locations: {
      type: [clinicLocationSchema],
      default: [],
      validate: {
        validator: (v: IClinicLocation[]) => Array.isArray(v) && v.length >= 1,
        message: "A clinic must have at least one location.",
      },
    },

    website: { type: String, trim: true },
    social: { type: socialSchema, default: () => ({}) },
    contactEmail: { type: String, trim: true, lowercase: true },

    caseStudies: { type: [caseStudySchema], default: [] },
    faqs: { type: [faqSchema], default: [] },
    highlights: { type: [String], default: [] },

    // Computed — see /lib/ratings.ts (Stage 3.2).
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingBreakdown: { type: ratingBreakdownSchema, default: () => ({}) },
    reviewCount: { type: Number, default: 0, min: 0 },
    topMentions: { type: [topMentionSchema], default: [] },

    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isClaimed: { type: Boolean, default: false },
    seo: { type: seoSchema, default: undefined },
    reviewsPage: { type: clinicReviewsPageSchema, default: undefined },
    costPage: { type: clinicCostPageSchema, default: undefined },
    externalReviews: { type: externalReviewsSchema, default: undefined },
    schemaOverrides: { type: schemaOverrideSchema, default: undefined },

    // Computed — see /lib/ranking.ts (Stage 3.1).
    sortScore: { type: Number, default: 0 },
  },
  { timestamps: true },
);

softDeletePlugin(ClinicSchema);

// ── Indexes (PRD §5.1) ──────────────────────────────────────────────────────
// `slug` unique index is created by the field's `unique: true`.
ClinicSchema.index(
  { name: "text", tagline: "text", description: "text" },
  { name: "clinic_text", weights: { name: 10, tagline: 5, description: 1 } },
);
ClinicSchema.index({ treatmentTypes: 1 });
ClinicSchema.index({ conditionsTreated: 1 });
ClinicSchema.index({ cellSources: 1 });
ClinicSchema.index({ "locations.country": 1 });
ClinicSchema.index({ "locations.city": 1 });
ClinicSchema.index({ tier: 1 });
ClinicSchema.index({ ratingAvg: -1 });
ClinicSchema.index({ sortScore: -1 });
// Hot path: published directory listing ordered by ranking score.
ClinicSchema.index({ status: 1, isDeleted: 1, sortScore: -1 });

export const Clinic = registerModel<IClinic>("Clinic", ClinicSchema);
export default Clinic;
