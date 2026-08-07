/**
 * PageContent — the editor's overlay on a route whose copy lives in code.
 *
 * One document per editable route (see `config/editable-pages.ts`), keyed on the
 * normalized `path`. Every field is optional and a blank one means "use the
 * shipped copy": the merge lives in `config/editable-pages.ts` + `lib/page-content.ts`,
 * which is also where the defaults are. That keeps this collection a pure
 * overlay, so an editor who clears a field restores the shipped string rather
 * than blanking a live page, and a route with no row here renders exactly as it
 * did before this collection existed.
 *
 * Deliberately *not* the `Page` model. A `Page` is a whole page an editor
 * authored into existence at a slug it chose, and it carries the YMYL review
 * gate because nobody saw it before it shipped. These rows edit copy on routes
 * that already exist, already shipped, and already went through review, so
 * gating them behind an approval step would mean a typo fix on the privacy
 * policy sits in `draft` while the old text stays live. Admin RBAC is the
 * control here; the audit log is the record.
 *
 * `blocks` reuses the same discriminated union as `Page` and taxonomy sections
 * (`lib/validation/block.ts`), sanitized on write by `sanitizeBlocks`.
 */
import { Schema, type Types } from "mongoose";

import {
  blockSchema,
  registerModel,
  type IBlock,
  type TimestampFields,
} from "@/models/_shared";

export interface IPageContent extends TimestampFields {
  _id: Types.ObjectId;
  /** Normalized root-relative path, e.g. `/about`. Unique. */
  path: string;
  /** H1 override. */
  title?: string;
  /** Lead paragraph override. Sanitized inline HTML, so links survive. */
  lead?: string;
  /** "Last updated" line, on the pages that show one. */
  updated?: string;
  /** Show the "flagged for legal review" notice. Tri-state: unset = shipped default. */
  legalReview?: boolean | null;
  /** Primary body composition. */
  blocks: IBlock[];
  /** Secondary composition, on the pages with two body slots. */
  blocksAfter: IBlock[];
  /** Per-page one-off strings, keyed by the registry's `extras[].key`. */
  extras: Map<string, string>;
}

const PageContentSchema = new Schema<IPageContent>(
  {
    path: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Nothing is `required` and nothing has a default: an absent field means
    // "fall back to the shipped copy", which the resolver decides. A
    // schema-level default here would shadow that and freeze today's copy into
    // the database.
    title: { type: String, trim: true },
    lead: { type: String, trim: true },
    updated: { type: String, trim: true },
    legalReview: { type: Boolean, default: null },
    blocks: { type: [blockSchema], default: [] },
    blocksAfter: { type: [blockSchema], default: [] },
    extras: { type: Map, of: String, default: () => new Map() },
  },
  { timestamps: true },
);

export const PageContent = registerModel<IPageContent>(
  "PageContent",
  PageContentSchema,
);
export default PageContent;
