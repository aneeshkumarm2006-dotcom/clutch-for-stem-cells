/**
 * Taxonomy collections (PRD §5.3 / Stage 1.3): Treatment, Condition, CellSource,
 * Accreditation, Location.
 *
 * Each is its own collection (so `Clinic` refs them distinctly and they get
 * independent admin CRUD + SEO pages). They share a base shape via
 * {@link taxonomyBaseFields}; `slug` is unique per collection, `description` is
 * the admin-editable SEO intro for that term's directory page (§8.5).
 */
import { Schema, type SchemaDefinition, type Types } from "mongoose";
import {
  CONTENT_REVIEW_STATUSES,
  EVIDENCE_LEVELS,
  LOCATION_KINDS,
  type ContentReviewStatus,
  type EvidenceLevel,
  type LocationKind,
} from "@/lib/enums";
import {
  imageSchema,
  seoSchema,
  schemaOverrideSchema,
  blockSchema,
  faqSchema,
  keyFactSchema,
  contentFlagSchema,
  registerModel,
  type IBlock,
  type IImage,
  type ISeo,
  type ISchemaOverrides,
  type IFaqEntry,
  type IKeyFact,
  type IContentFlag,
  type TimestampFields,
} from "@/models/_shared";

// ── Shared base ─────────────────────────────────────────────────────────────

export interface ITaxonomyBase extends TimestampFields {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  /** Short admin-editable SEO intro rendered as the directory-page lede (§8.5). */
  description?: string;
  shortDescription?: string;
  /** Lucide icon name (e.g. "Activity") or an image is used instead. */
  icon?: string;
  image?: IImage;
  seo?: ISeo;
  /** Per-page control over the auto-generated JSON-LD (schema engine). */
  schemaOverrides?: ISchemaOverrides;
  parentId?: Types.ObjectId | null;
  order: number;
  isActive: boolean;
  /** Computed — number of published clinics referencing this term (§8.5). */
  clinicCount: number;

  // ── Editorial enrichment (rendered only when reviewStatus === "approved") ──
  /** Long-form markdown body rendered below the intro on the term page. */
  body?: string;
  /**
   * The modular section builder — an ordered composition of reusable content
   * blocks (steps, comparison table, checklist, callout, …) rendered under the
   * body. Same block union the composed-page CMS uses, so a section type added
   * once is available everywhere. Blocks carrying structured meaning wire
   * themselves into the page's JSON-LD (`lib/blocks/schema.ts`).
   */
  blocks: IBlock[];
  /** Scoped Q&A → visible accordion + FAQPage JSON-LD (AEO). */
  faqs: IFaqEntry[];
  /** Sourced facts with visible citations (extractability + E-E-A-T). */
  keyFacts: IKeyFact[];
  /** YMYL review lifecycle — only `approved` editorial content is public. */
  reviewStatus: ContentReviewStatus;
  /** Credentialed reviewer (→ MedicalReviewer). Required before approval. */
  reviewedBy?: Types.ObjectId | null;
  lastReviewedAt?: Date | null;
  /** Cached cure/guarantee scanner hits for the review queue. */
  contentFlags: IContentFlag[];
  /** Reviewer has acknowledged the flags — required to approve flagged content. */
  flagsAcknowledged: boolean;
}

/**
 * Editorial + review-gate fields shared by every taxonomy collection (and
 * structurally mirrored by MatrixPage). Enrichment renders only once the term
 * is `approved`; the term's short `description` still shows regardless.
 */
function editorialFields(): SchemaDefinition {
  return {
    body: { type: String },
    blocks: { type: [blockSchema], default: [] },
    faqs: { type: [faqSchema], default: [] },
    keyFacts: { type: [keyFactSchema], default: [] },
    reviewStatus: {
      type: String,
      enum: CONTENT_REVIEW_STATUSES,
      default: "draft",
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "MedicalReviewer",
      default: null,
    },
    lastReviewedAt: { type: Date, default: null },
    contentFlags: { type: [contentFlagSchema], default: [] },
    flagsAcknowledged: { type: Boolean, default: false },
  };
}

/**
 * Base field definitions shared by every taxonomy collection. `parentId`
 * self-refs the owning collection so hierarchies stay within their kind
 * (e.g. city → country, or "MSC therapy" → "Cell therapies").
 */
function taxonomyBaseFields(refName: string): SchemaDefinition {
  return {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: { type: String },
    shortDescription: { type: String, trim: true },
    icon: { type: String, trim: true },
    image: { type: imageSchema, default: undefined },
    seo: { type: seoSchema, default: undefined },
    schemaOverrides: { type: schemaOverrideSchema, default: undefined },
    parentId: { type: Schema.Types.ObjectId, ref: refName, default: null },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    clinicCount: { type: Number, default: 0, min: 0 },
    ...editorialFields(),
  };
}

/** Common indexes for every taxonomy collection (slug unique via field). */
function addTaxonomyIndexes(schema: Schema): void {
  schema.index({ parentId: 1, order: 1 });
  schema.index({ isActive: 1 });
  schema.index({ name: "text" });
}

// ── Treatment ───────────────────────────────────────────────────────────────

export interface ITreatment extends ITaxonomyBase {
  /** Flat group label for browse grids (e.g. "Cell therapies"). */
  category?: string;
  /** How the therapy works (markdown). */
  mechanism?: string;
  /** Neutral strength-of-evidence signal (never inflate). */
  evidenceLevel?: EvidenceLevel;
  /** Sourced summary of the clinical evidence (markdown). */
  evidenceSummary?: string;
  /** Indicative cost range copy (markdown). */
  costRange?: string;
  /** Typical recovery/aftercare timeline (markdown). */
  recoveryTimeline?: string;
  /** Known risks / contraindications (markdown). */
  risks?: string;
}

const TreatmentSchema = new Schema<ITreatment>(
  {
    ...taxonomyBaseFields("Treatment"),
    category: { type: String, trim: true },
    mechanism: { type: String },
    evidenceLevel: { type: String, enum: EVIDENCE_LEVELS },
    evidenceSummary: { type: String },
    costRange: { type: String },
    recoveryTimeline: { type: String },
    risks: { type: String },
  },
  { timestamps: true },
);
addTaxonomyIndexes(TreatmentSchema);
export const Treatment = registerModel<ITreatment>(
  "Treatment",
  TreatmentSchema,
);

// ── Condition ───────────────────────────────────────────────────────────────

export interface ICondition extends ITaxonomyBase {
  /** Body-system / category group label (e.g. "Orthopedic/Musculoskeletal"). */
  category?: string;
  /** Plain-language overview of the condition (markdown). */
  overview?: string;
  /** Conventional standard of care (markdown) — anchors expectations. */
  standardOfCare?: string;
  /** Sourced, cautious summary of cell-therapy evidence for this condition. */
  evidenceForCellTherapy?: string;
  /** Common symptoms (for entity clarity + AEO). */
  symptoms: string[];
}

const ConditionSchema = new Schema<ICondition>(
  {
    ...taxonomyBaseFields("Condition"),
    category: { type: String, trim: true },
    overview: { type: String },
    standardOfCare: { type: String },
    evidenceForCellTherapy: { type: String },
    symptoms: { type: [String], default: [] },
  },
  { timestamps: true },
);
addTaxonomyIndexes(ConditionSchema);
export const Condition = registerModel<ICondition>(
  "Condition",
  ConditionSchema,
);

// ── CellSource ──────────────────────────────────────────────────────────────

export type ICellSource = ITaxonomyBase;

const CellSourceSchema = new Schema<ICellSource>(
  { ...taxonomyBaseFields("CellSource") },
  { timestamps: true },
);
addTaxonomyIndexes(CellSourceSchema);
export const CellSource = registerModel<ICellSource>(
  "CellSource",
  CellSourceSchema,
);

// ── Accreditation ───────────────────────────────────────────────────────────

export interface IAccreditation extends ITaxonomyBase {
  /** Issuing body / certifier (PRD §5.3). The `image` field holds the logo. */
  issuingBody?: string;
}

const AccreditationSchema = new Schema<IAccreditation>(
  {
    ...taxonomyBaseFields("Accreditation"),
    issuingBody: { type: String, trim: true },
  },
  { timestamps: true },
);
addTaxonomyIndexes(AccreditationSchema);
export const Accreditation = registerModel<IAccreditation>(
  "Accreditation",
  AccreditationSchema,
);

// ── Location ────────────────────────────────────────────────────────────────
// Managed country/city dataset (PRD §5.3). A city's `parentId` refs its country.

export interface ILocation extends ITaxonomyBase {
  kind: LocationKind;
  countryCode?: string;
  region?: string;
  lat?: number;
  lng?: number;
  /** Emoji flag or asset reference for countries. */
  flag?: string;
  /** Medical-travel regulatory context, e.g. COFEPRIS status (markdown). */
  regulatoryStatus?: string;
  /** Travel logistics: visas, typical trip length, getting there (markdown). */
  logistics?: string;
  /** Practical destination notes (markdown). */
  travelNotes?: string;
}

const LocationSchema = new Schema<ILocation>(
  {
    ...taxonomyBaseFields("Location"),
    kind: {
      type: String,
      enum: LOCATION_KINDS,
      required: true,
      default: "country",
    },
    countryCode: { type: String, trim: true, uppercase: true },
    region: { type: String, trim: true },
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
    flag: { type: String, trim: true },
    regulatoryStatus: { type: String },
    logistics: { type: String },
    travelNotes: { type: String },
  },
  { timestamps: true },
);
addTaxonomyIndexes(LocationSchema);
LocationSchema.index({ kind: 1, countryCode: 1 });
export const Location = registerModel<ILocation>("Location", LocationSchema);
