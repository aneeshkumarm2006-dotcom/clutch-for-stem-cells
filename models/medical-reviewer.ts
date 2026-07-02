/**
 * MedicalReviewer — a credentialed person who medically reviews YMYL content
 * (taxonomy editorial bodies + combination pages). One reviewer signs many
 * pages, so this is its own collection referenced by `reviewedBy` on those
 * records; it also powers the "Medically reviewed by …" byline and the
 * `reviewedBy` Person node in `MedicalWebPage` JSON-LD (E-E-A-T).
 *
 * Compliance: a record here must be a REAL person who actually reviewed the
 * content. Attribution is only populated once a genuine reviewer is supplied —
 * we never fabricate one (see the content approval gate).
 */
import { Schema, type Types } from "mongoose";

import {
  imageSchema,
  registerModel,
  type IImage,
  type TimestampFields,
} from "@/models/_shared";

export interface IMedicalReviewer extends TimestampFields {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  /** Post-nominal credentials, e.g. "MD, PhD". */
  credentials?: string;
  /** Role/title, e.g. "Regenerative Medicine Physician". */
  title?: string;
  bio?: string;
  photo?: IImage;
  /** Authoritative profile URLs (medical registry, ORCID, LinkedIn) → schema `sameAs`. */
  sameAs: string[];
  isActive: boolean;
}

const MedicalReviewerSchema = new Schema<IMedicalReviewer>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    credentials: { type: String, trim: true, maxlength: 120 },
    title: { type: String, trim: true, maxlength: 160 },
    bio: { type: String, trim: true },
    photo: { type: imageSchema, default: undefined },
    sameAs: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const MedicalReviewer = registerModel<IMedicalReviewer>(
  "MedicalReviewer",
  MedicalReviewerSchema,
);
export default MedicalReviewer;
