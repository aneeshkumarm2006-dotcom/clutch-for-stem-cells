/**
 * Shared domain enums — Stage 1 / PRD §5.
 *
 * Mongoose-free on purpose: both the Mongoose models (`/models`) and the Zod
 * schemas (`/lib/validation`) import these. Zod schemas are bundled into client
 * forms, so this module must never pull in `mongoose`.
 *
 * Each enum is a readonly tuple (usable as a Mongoose `enum` and a Zod
 * `z.enum`) paired with a derived union type.
 */

// ── Clinic (PRD §5.1) ───────────────────────────────────────────────────────
export const CLINIC_STATUSES = [
  "draft",
  "published",
  "pending",
  "archived",
] as const;
export type ClinicStatus = (typeof CLINIC_STATUSES)[number];

export const CLINIC_TIERS = ["basic", "verified", "featured"] as const;
export type ClinicTier = (typeof CLINIC_TIERS)[number];

export const VERIFICATION_BADGES = ["verified", "premier"] as const;
export type VerificationBadge = (typeof VERIFICATION_BADGES)[number];

export const PRICE_MODELS = [
  "per_treatment",
  "per_session",
  "package",
  "consult_to_quote",
] as const;
export type PriceModel = (typeof PRICE_MODELS)[number];

export const TEAM_SIZES = ["1-10", "11-50", "51-200", "200+"] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];

// ── Review (PRD §5.2) ───────────────────────────────────────────────────────
export const REVIEW_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "spam",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_VERIFICATION_METHODS = [
  "online_form",
  "phone",
  "document",
  "email_confirmed",
] as const;
export type ReviewVerificationMethod =
  (typeof REVIEW_VERIFICATION_METHODS)[number];

/**
 * The five sub-rating axes (PRD §5.2 / Clutch "Quality/Schedule/Cost/Refer").
 * Used by `Review.ratings` and the denormalized `Clinic.ratingBreakdown`.
 */
export const SUB_RATING_KEYS = [
  "outcome",
  "communication",
  "facility",
  "value",
  "refer",
] as const;
export type SubRatingKey = (typeof SUB_RATING_KEYS)[number];

// ── Lead (PRD §5.4) ─────────────────────────────────────────────────────────
export const LEAD_TYPES = [
  "consultation",
  "quote",
  "message",
  "match",
] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const LEAD_TIMEFRAMES = [
  "asap",
  "1-3mo",
  "3-6mo",
  "researching",
] as const;
export type LeadTimeframe = (typeof LEAD_TIMEFRAMES)[number];

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "closed",
  "spam",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

// ── Article (PRD §5.5) ──────────────────────────────────────────────────────
// PRD-ASSUMPTION: §5.5 lists draft|published; `scheduled` is added to support
// the CMS schedule/publish flow in §8.6 (publishedAt in the future).
export const ARTICLE_STATUSES = ["draft", "published", "scheduled"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

// ── User (PRD §3, §5.6) ─────────────────────────────────────────────────────
// "Visitor" (PRD §3) is the unauthenticated state — never persisted on a User
// record — so it is intentionally absent from the stored role enum.
export const USER_ROLES = [
  "member",
  "provider",
  "editor",
  "admin",
  "superadmin",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Privilege ranking for `requireRole`-style checks (Stage 2.4 `/lib/auth`). */
export const ROLE_RANK: Record<UserRole, number> = {
  member: 0,
  provider: 1,
  editor: 2,
  admin: 3,
  superadmin: 4,
};

/** Roles allowed into the `/admin` panel — module-level gating per PRD §3. */
export const ADMIN_ROLES = ["editor", "admin", "superadmin"] as const;

/** `true` when `role` ranks at or above `min` (mongoose-free; Edge-safe). */
export function roleAtLeast(role: UserRole, min: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** `true` for any role with admin-panel access (Editor | Admin | SuperAdmin). */
export function isAdminRole(role: UserRole): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

export const USER_STATUSES = ["active", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const AUTH_PROVIDERS = ["credentials", "google"] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

// ── Plan (PRD §5.7) ─────────────────────────────────────────────────────────
export const PLAN_KEYS = ["basic", "verified", "featured"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

// ── Taxonomy (PRD §5.3) ─────────────────────────────────────────────────────
export const TAXONOMY_KINDS = [
  "treatment",
  "condition",
  "cellSource",
  "accreditation",
  "location",
] as const;
export type TaxonomyKind = (typeof TAXONOMY_KINDS)[number];

/** `Location` taxonomy is a country/city dataset (PRD §5.3). */
export const LOCATION_KINDS = ["country", "city"] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

// ── Currency ────────────────────────────────────────────────────────────────
// Suggested options for currency dropdowns. Validation accepts any ISO-4217
// 3-letter code, so this list stays advisory (admin can extend).
export const SUPPORTED_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "MXN",
  "THB",
  "INR",
  "AED",
  "JPY",
  "KRW",
] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
