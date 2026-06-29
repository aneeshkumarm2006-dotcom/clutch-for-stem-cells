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
import { LOCATION_KINDS, type LocationKind } from "@/lib/enums";
import {
  imageSchema,
  seoSchema,
  registerModel,
  type IImage,
  type ISeo,
  type TimestampFields,
} from "@/models/_shared";

// ── Shared base ─────────────────────────────────────────────────────────────

export interface ITaxonomyBase extends TimestampFields {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  /** Lucide icon name (e.g. "Activity") or an image is used instead. */
  icon?: string;
  image?: IImage;
  seo?: ISeo;
  parentId?: Types.ObjectId | null;
  order: number;
  isActive: boolean;
  /** Computed — number of published clinics referencing this term (§8.5). */
  clinicCount: number;
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
    parentId: { type: Schema.Types.ObjectId, ref: refName, default: null },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    clinicCount: { type: Number, default: 0, min: 0 },
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
}

const TreatmentSchema = new Schema<ITreatment>(
  {
    ...taxonomyBaseFields("Treatment"),
    category: { type: String, trim: true },
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
}

const ConditionSchema = new Schema<ICondition>(
  {
    ...taxonomyBaseFields("Condition"),
    category: { type: String, trim: true },
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
  },
  { timestamps: true },
);
addTaxonomyIndexes(LocationSchema);
LocationSchema.index({ kind: 1, countryCode: 1 });
export const Location = registerModel<ILocation>("Location", LocationSchema);
