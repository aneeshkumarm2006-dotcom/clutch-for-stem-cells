/**
 * Redirect — an editor-managed URL redirect (part of the per-page SEO layer).
 *
 * When content moves or a slug changes, an editor records the old path here and
 * the site 301s it to the new one, so accumulated link equity and bookmarks
 * survive. Managed in `/admin` (role-gated + audited) because a redirect is a
 * site-wide routing change, not per-record content.
 *
 * Resolution happens server-side in the not-found boundary and the `/[slug]`
 * catch-all (`lib/redirects.ts`) rather than in Edge middleware — middleware
 * can't open a Mongoose connection. That covers the case redirects exist for: a
 * URL that no longer resolves.
 */
import { Schema, type Types } from "mongoose";

import { REDIRECT_STATUS_CODES, type RedirectStatusCode } from "@/lib/enums";
import { registerModel, type TimestampFields } from "@/models/_shared";

export interface IRedirect extends TimestampFields {
  _id: Types.ObjectId;
  /** Root-relative source path, always stored normalized (leading slash, no trailing). */
  from: string;
  /** Destination — a root-relative path or an absolute URL. */
  to: string;
  /** 301 permanent (default, passes equity) or 302 temporary. */
  statusCode: RedirectStatusCode;
  /** Admin who created it (audit context). */
  createdBy?: Types.ObjectId | null;
  /** Bumped whenever the redirect fires — helps spot dead rules. */
  hits: number;
}

const RedirectSchema = new Schema<IRedirect>(
  {
    from: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    to: { type: String, required: true, trim: true },
    statusCode: {
      type: Number,
      enum: REDIRECT_STATUS_CODES,
      default: 301,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    hits: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

export const Redirect = registerModel<IRedirect>("Redirect", RedirectSchema);
export default Redirect;
