/**
 * Models barrel — Stage 1.
 *
 * Importing this module registers every Mongoose model, so `populate()` can
 * resolve string refs (e.g. "Treatment") regardless of import order. App code
 * and the seed script import models from here: `import { Clinic } from "@/models"`.
 */
export {
  imageSchema,
  seoSchema,
  personSchema,
  softDeletePlugin,
  registerModel,
} from "@/models/_shared";
export type {
  IImage,
  ISeo,
  IPerson,
  SoftDeleteFields,
  TimestampFields,
} from "@/models/_shared";

export { Clinic, default as ClinicModel } from "@/models/clinic";
export type {
  IClinic,
  IVerification,
  IServiceFocus,
  IClinicLocation,
  ISocial,
  ICaseStudy,
  IFaq,
  IRatingBreakdown,
  ITopMention,
} from "@/models/clinic";

export { Review, default as ReviewModel } from "@/models/review";
export type {
  IReview,
  IReviewer,
  IReviewCost,
  IReviewRatings,
  IReviewBody,
  IProviderResponse,
  IModeration,
} from "@/models/review";

export {
  Treatment,
  Condition,
  CellSource,
  Accreditation,
  Location,
} from "@/models/taxonomy";
export type {
  ITaxonomyBase,
  ITreatment,
  ICondition,
  ICellSource,
  IAccreditation,
  ILocation,
} from "@/models/taxonomy";

export { Lead, default as LeadModel } from "@/models/lead";
export type { ILead, ILeadNote } from "@/models/lead";

export { Report, default as ReportModel } from "@/models/report";
export type { IReport } from "@/models/report";

export { Article, default as ArticleModel } from "@/models/article";
export type { IArticle, IArticleAuthor } from "@/models/article";

export { BlogPost, default as BlogPostModel } from "@/models/blog-post";
export type { IBlogPost, IBlogKeyword } from "@/models/blog-post";

export { User, default as UserModel } from "@/models/user";
export type { IUser, ISavedSearch } from "@/models/user";

export { Plan, default as PlanModel } from "@/models/plan";
export type { IPlan } from "@/models/plan";

export {
  SiteSetting,
  default as SiteSettingModel,
  GLOBAL_SETTINGS_KEY,
} from "@/models/site-setting";
export type {
  ISiteSetting,
  SiteSettingModel as SiteSettingModelType,
  IHero,
  IPopularSearch,
  ITestimonial,
  IDisclaimers,
  IContactInfo,
  ISocialLinks,
  IFeatureFlags,
  IRankingWeights,
  IAnalyticsConfig,
  ISeoDefaults,
} from "@/models/site-setting";

export { AuditLog, default as AuditLogModel } from "@/models/audit-log";
export type { IAuditLog } from "@/models/audit-log";

export { Media, default as MediaModel } from "@/models/media";
export type { IMedia } from "@/models/media";

export {
  AnalyticsEvent,
  default as AnalyticsEventModel,
  ANALYTICS_EVENT_NAMES,
  ANALYTICS_TTL_SECONDS,
} from "@/models/analytics-event";
export type {
  IAnalyticsEvent,
  AnalyticsEventName,
} from "@/models/analytics-event";
