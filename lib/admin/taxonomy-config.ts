/**
 * Taxonomy module config (PRD §8.5 / Stage 6.7).
 *
 * Maps each URL segment (`/admin/taxonomy/<segment>`) to its Mongoose model,
 * validation schemas, and the `Clinic` ref field used for the delete-in-use
 * guard. Drives the generic taxonomy page + API across all five kinds.
 */
import "server-only";
import type { Model } from "mongoose";
import type { ZodTypeAny } from "zod";

import {
  Accreditation,
  CellSource,
  Condition,
  Location,
  Treatment,
  type ITaxonomyBase,
} from "@/models";
import {
  treatmentCreateSchema,
  treatmentUpdateSchema,
  conditionCreateSchema,
  conditionUpdateSchema,
  cellSourceCreateSchema,
  cellSourceUpdateSchema,
  accreditationCreateSchema,
  accreditationUpdateSchema,
  locationCreateSchema,
  locationUpdateSchema,
} from "@/lib/validation/taxonomy";
import type { TaxonomyKind } from "@/lib/enums";

export interface TaxonomyConfig {
  segment: string;
  kind: TaxonomyKind;
  label: string;
  singular: string;
  model: Model<ITaxonomyBase>;
  createSchema: ZodTypeAny;
  updateSchema: ZodTypeAny;
  /** `Clinic` ObjectId-ref field for the in-use guard (undefined for locations). */
  clinicField?: string;
  hasCategory?: boolean;
  hasIssuingBody?: boolean;
  isLocation?: boolean;
}

const asBase = (m: unknown) => m as Model<ITaxonomyBase>;

export const TAXONOMY_CONFIG: Record<string, TaxonomyConfig> = {
  treatments: {
    segment: "treatments",
    kind: "treatment",
    label: "Treatments",
    singular: "treatment",
    model: asBase(Treatment),
    createSchema: treatmentCreateSchema,
    updateSchema: treatmentUpdateSchema,
    clinicField: "treatmentTypes",
    hasCategory: true,
  },
  conditions: {
    segment: "conditions",
    kind: "condition",
    label: "Conditions",
    singular: "condition",
    model: asBase(Condition),
    createSchema: conditionCreateSchema,
    updateSchema: conditionUpdateSchema,
    clinicField: "conditionsTreated",
    hasCategory: true,
  },
  "cell-sources": {
    segment: "cell-sources",
    kind: "cellSource",
    label: "Cell sources",
    singular: "cell source",
    model: asBase(CellSource),
    createSchema: cellSourceCreateSchema,
    updateSchema: cellSourceUpdateSchema,
    clinicField: "cellSources",
  },
  accreditations: {
    segment: "accreditations",
    kind: "accreditation",
    label: "Accreditations",
    singular: "accreditation",
    model: asBase(Accreditation),
    createSchema: accreditationCreateSchema,
    updateSchema: accreditationUpdateSchema,
    clinicField: "accreditations",
    hasIssuingBody: true,
  },
  locations: {
    segment: "locations",
    kind: "location",
    label: "Locations",
    singular: "location",
    model: asBase(Location),
    createSchema: locationCreateSchema,
    updateSchema: locationUpdateSchema,
    isLocation: true,
  },
};

export const TAXONOMY_SEGMENTS = Object.keys(TAXONOMY_CONFIG);

export function getTaxonomyConfig(segment: string): TaxonomyConfig | null {
  return TAXONOMY_CONFIG[segment] ?? null;
}
