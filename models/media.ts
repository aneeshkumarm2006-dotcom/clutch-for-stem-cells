/**
 * Media — uploaded image library (PRD §8.11 / Stage 6.13).
 *
 * Deferred from Stage 1 (images were embedded `imageSchema` sub-docs); the admin
 * media library now persists each upload as its own record so images can be
 * browsed, searched, and reused across clinic forms. `publicId` links
 * back to the storage provider (Cloudinary) for delivery transforms / deletion.
 */
import { Schema, type Types } from "mongoose";
import { registerModel, type TimestampFields } from "@/models/_shared";

export interface IMedia extends TimestampFields {
  _id: Types.ObjectId;
  url: string;
  /** Storage provider id (Cloudinary public_id) — used for transforms/deletion. */
  publicId?: string;
  alt?: string;
  filename?: string;
  /** Logical folder/prefix, e.g. "clinics" or "blog". */
  folder?: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
  /** Admin who uploaded it (audit/attribution). */
  uploadedBy?: Types.ObjectId | null;
}

const MediaSchema = new Schema<IMedia>(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true, index: true },
    alt: { type: String, trim: true },
    filename: { type: String, trim: true },
    folder: { type: String, trim: true, index: true },
    format: { type: String, trim: true },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    bytes: { type: Number, min: 0 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

// Library view: newest first; text search over filename/alt.
MediaSchema.index({ createdAt: -1 });
MediaSchema.index({ filename: "text", alt: "text" });

export const Media = registerModel<IMedia>("Media", MediaSchema);
export default Media;
