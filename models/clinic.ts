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
  PRICE_MODELS,
  TEAM_SIZES,
  VERIFICATION_BADGES,
} from "@/lib/enums";
import type {
  ClinicStatus,
  ClinicTier,
  PriceModel,
  TeamSize,
  VerificationBadge,
} from "@/lib/enums";
import {
  imageSchema,
  personSchema,
  seoSchema,
  softDeletePlugin,
  registerModel,
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
