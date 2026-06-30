/**
 * BlogPost — SEO-team blog entry (/seoteam dashboard → public /blog).
 *
 * A self-contained content type, separate from {@link Article} (the role-based
 * education hub at /resources). Published by the non-technical SEO team behind a
 * shared-password session; writes render instantly on /blog with no redeploy.
 *
 * `body` holds **sanitized HTML** (Tiptap output, cleaned with `sanitize-html`
 * on save). Keyword backlinks are stored as data and woven into the body at
 * render time (lib/seoteam/keyword-links.ts) so editing stays clean and rel/
 * keyword changes take effect immediately.
 */
import { Schema, type Types } from "mongoose";

import {
  BLOG_POST_STATUSES,
  BLOG_TEMPLATE_KEYS,
  KEYWORD_RELS,
  type BlogPostStatus,
  type BlogTemplateKey,
  type KeywordRel,
} from "@/lib/enums";
import {
  imageSchema,
  registerModel,
  type IImage,
  type TimestampFields,
} from "@/models/_shared";

/** One keyword → target URL backlink (the §4 link mechanism). */
export interface IBlogKeyword {
  keyword: string;
  url: string;
  rel: KeywordRel;
}

export interface IBlogPost extends TimestampFields {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  template: BlogTemplateKey;
  status: BlogPostStatus;
  /** Sanitized HTML body. */
  body: string;
  /** Doubles as the meta description. */
  excerpt?: string;
  /** Defaults to `title` when blank. */
  metaTitle?: string;
  coverImage?: IImage;
  keywords: IBlogKeyword[];
  /** Link only the first occurrence of each keyword (avoids over-optimization). */
  linkFirstOnly: boolean;
  author?: string;
  readingTime?: number;
  views: number;
  publishedAt?: Date | null;
}

const blogKeywordSchema = new Schema<IBlogKeyword>(
  {
    keyword: { type: String, required: true, trim: true, maxlength: 120 },
    url: { type: String, required: true, trim: true },
    rel: { type: String, enum: KEYWORD_RELS, default: "dofollow" },
  },
  { _id: false },
);

const BlogPostSchema = new Schema<IBlogPost>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    template: {
      type: String,
      enum: BLOG_TEMPLATE_KEYS,
      default: "generic",
    },
    status: {
      type: String,
      enum: BLOG_POST_STATUSES,
      default: "draft",
      index: true,
    },
    body: { type: String, default: "" },
    excerpt: { type: String, trim: true, maxlength: 500 },
    metaTitle: { type: String, trim: true, maxlength: 120 },
    coverImage: { type: imageSchema, default: undefined },
    keywords: { type: [blogKeywordSchema], default: [] },
    linkFirstOnly: { type: Boolean, default: true },
    author: { type: String, trim: true, maxlength: 160 },
    readingTime: { type: Number, min: 0 },
    views: { type: Number, default: 0, min: 0 },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Public index: published posts, newest first.
BlogPostSchema.index({ status: 1, publishedAt: -1 });
// Dashboard search.
BlogPostSchema.index({ title: "text" }, { name: "blogpost_title_text" });

export const BlogPost = registerModel<IBlogPost>("BlogPost", BlogPostSchema);
export default BlogPost;
