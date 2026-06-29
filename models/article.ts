/**
 * Article — blog / education hub entry (PRD §5.5 / Stage 1.5).
 *
 * `body` holds rich text / MDX. `categories`/`tags` are slug-like strings
 * (category drives `/resources/category/[slug]`). Soft-deleted per PRD §5.
 */
import { Schema, type Types } from "mongoose";
import { ARTICLE_STATUSES, type ArticleStatus } from "@/lib/enums";
import {
  imageSchema,
  seoSchema,
  softDeletePlugin,
  registerModel,
  type IImage,
  type ISeo,
  type SoftDeleteFields,
  type TimestampFields,
} from "@/models/_shared";

export interface IArticleAuthor {
  name: string;
  avatar?: IImage;
  bio?: string;
}

export interface IArticle extends TimestampFields, SoftDeleteFields {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  status: ArticleStatus;
  excerpt?: string;
  body?: string;
  coverImage?: IImage;
  author?: IArticleAuthor;
  categories: string[];
  tags: string[];
  relatedConditionIds: Types.ObjectId[];
  relatedTreatmentIds: Types.ObjectId[];
  readingTime?: number;
  publishedAt?: Date | null;
  seo?: ISeo;
}

const articleAuthorSchema = new Schema<IArticleAuthor>(
  {
    name: { type: String, required: true, trim: true },
    avatar: { type: imageSchema, default: undefined },
    bio: { type: String, trim: true },
  },
  { _id: false },
);

const ArticleSchema = new Schema<IArticle>(
  {
    title: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ARTICLE_STATUSES,
      default: "draft",
      index: true,
    },
    excerpt: { type: String, trim: true },
    body: { type: String },
    coverImage: { type: imageSchema, default: undefined },
    author: { type: articleAuthorSchema, default: undefined },
    categories: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    relatedConditionIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Condition" }],
      default: [],
    },
    relatedTreatmentIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Treatment" }],
      default: [],
    },
    readingTime: { type: Number, min: 0 },
    publishedAt: { type: Date, default: null },
    seo: { type: seoSchema, default: undefined },
  },
  { timestamps: true },
);

softDeletePlugin(ArticleSchema);

// Hub index: published articles, newest first.
ArticleSchema.index({ status: 1, isDeleted: 1, publishedAt: -1 });
ArticleSchema.index({ categories: 1 });
ArticleSchema.index({ tags: 1 });
ArticleSchema.index(
  { title: "text", excerpt: "text" },
  { name: "article_text", weights: { title: 10, excerpt: 2 } },
);

export const Article = registerModel<IArticle>("Article", ArticleSchema);
export default Article;
