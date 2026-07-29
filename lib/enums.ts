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

// ── Report / flag (PRD §14 / Stage 8.7) ─────────────────────────────────────
/** What a user can flag for admin review. */
export const REPORT_ENTITY_TYPES = ["review", "clinic"] as const;
export type ReportEntityType = (typeof REPORT_ENTITY_TYPES)[number];

/** Why the content was flagged. `other` pairs with a free-text detail. */
export const REPORT_REASONS = [
  "inaccurate",
  "spam",
  "offensive",
  "fake",
  "unsupported_claim",
  "privacy",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Human labels for the report-reason picker + admin queue. */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  inaccurate: "Inaccurate or misleading",
  spam: "Spam or advertising",
  offensive: "Offensive or abusive",
  fake: "Fake or not a real patient",
  unsupported_claim: "Unsupported medical claim",
  privacy: "Privacy / personal information",
  other: "Something else",
};

/** Moderation lifecycle of a flag. */
export const REPORT_STATUSES = [
  "open",
  "reviewing",
  "resolved",
  "dismissed",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

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

// ── Blog (SEO team dashboard — /seoteam + /blog) ─────────────────────────────
// Self-contained content system published by the non-technical SEO team behind
// a shared-password session (separate from the role-based admin above). Drives
// the `BlogPost` model, its Zod validation, and the editor UI.

/** Publish state — drafts are never public (no `pending`/`scheduled` here). */
export const BLOG_POST_STATUSES = ["draft", "published"] as const;
export type BlogPostStatus = (typeof BLOG_POST_STATUSES)[number];

/**
 * `rel` for a keyword backlink. `dofollow` is the absence of a `nofollow`/
 * `sponsored` token (we still always emit `noopener`); the other two append the
 * matching token so the team can disclose paid/UGC links per Google guidance.
 */
export const KEYWORD_RELS = ["dofollow", "nofollow", "sponsored"] as const;
export type KeywordRel = (typeof KEYWORD_RELS)[number];

/** Ready-made SEO post templates the team picks from (pre-fills the editor). */
export const BLOG_TEMPLATE_KEYS = [
  "how-to",
  "listicle",
  "comparison",
  "review",
  "news",
  "generic",
] as const;
export type BlogTemplateKey = (typeof BLOG_TEMPLATE_KEYS)[number];

// ── Editorial content review (taxonomy enrichment + combination pages) ───────
// YMYL content carries a human-review lifecycle. Only `approved` records are
// public and eligible for indexing; the approval gate additionally requires a
// real `reviewedBy` reviewer and that every cure/guarantee flag is acknowledged
// (see lib/content-flags.ts + lib/seo-indexation.ts).

/** Review lifecycle for editorial content. Only `approved` is ever public. */
export const CONTENT_REVIEW_STATUSES = [
  "draft",
  "in_review",
  "changes_requested",
  "approved",
] as const;
export type ContentReviewStatus = (typeof CONTENT_REVIEW_STATUSES)[number];

/**
 * How strong the clinical evidence is for a therapy — shown as a neutral,
 * non-promotional signal. Ordered weakest → strongest. Never inflate this.
 */
export const EVIDENCE_LEVELS = [
  "preclinical",
  "early-clinical",
  "mixed",
  "established",
] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

/** Human labels for the evidence-level badge. */
export const EVIDENCE_LEVEL_LABELS: Record<EvidenceLevel, string> = {
  preclinical: "Preclinical / early research",
  "early-clinical": "Early clinical trials",
  mixed: "Mixed / emerging evidence",
  established: "Established for some uses",
};

/** The three combination-page axes (see the MatrixPage model). */
export const MATRIX_KINDS = [
  "treatment_condition",
  "treatment_country",
  "condition_country",
] as const;
export type MatrixKind = (typeof MATRIX_KINDS)[number];

// ── Structured-data / SEO engine (config-driven schema.org + per-page SEO) ────
// Generic, domain-free primitives for the schema engine, the extended per-page
// SEO override, the modular block system, and redirects. Nothing site-specific
// lives here — the content-type→schema-node map is in `config/content-engine`.

/** Twitter/X card type for the per-page SEO override + Settings default. */
export const TWITTER_CARD_TYPES = ["summary", "summary_large_image"] as const;
export type TwitterCardType = (typeof TWITTER_CARD_TYPES)[number];

/**
 * The reusable content blocks editors compose pages from — composed Pages and
 * the editorial section builder on taxonomy term pages both draw from this list.
 * Keep in lockstep with the block schema (`lib/validation/block.ts`), the editor
 * forms + renderers (`components/blocks/`), and the enabled set in
 * `config/content-engine`. Blocks with structured meaning (`faq`,
 * `comparisonTable`, `steps`) auto-wire into the schema engine.
 *
 * Order is the order of the "Add block" picker, grouped loosely from
 * most-reached-for to most-specialist.
 */
export const BLOCK_TYPES = [
  "richText",
  "keyTakeaways",
  "steps",
  "checklist",
  "comparisonTable",
  "faq",
  "featureGrid",
  "prosCons",
  "statGrid",
  "callout",
  "quote",
  "linkList",
  "cta",
  "media",
  "rawHtml",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

/** Human labels for the block-type picker in the page editor. */
export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  richText: "Rich text",
  keyTakeaways: "Key takeaways",
  steps: "Step-by-step process",
  checklist: "Checklist",
  comparisonTable: "Comparison table",
  faq: "FAQ",
  featureGrid: "Feature grid",
  prosCons: "Pros & cons",
  statGrid: "Stat grid",
  callout: "Callout / note",
  quote: "Quote",
  linkList: "Link list",
  cta: "Call to action",
  media: "Image / media",
  rawHtml: "Raw HTML / embed",
};

/** One-line hints shown under each type in the "Add block" picker. */
export const BLOCK_TYPE_HINTS: Record<BlockType, string> = {
  richText: "Headings, paragraphs, lists, links, images.",
  keyTakeaways: "Answer-first bullet summary. Put it at the top.",
  steps: "Numbered process, e.g. how a therapy is collected.",
  checklist: "Ticked bullets, e.g. what to compare between clinics.",
  comparisonTable: "Side-by-side table of options.",
  faq: "Questions phrased the way people search them.",
  featureGrid: "Two-column cards of titled points.",
  prosCons: "Balanced advantages and limitations.",
  statGrid: "Big numbers with a label and a source link.",
  callout: "A note, tip, or caution set apart from the prose.",
  quote: "A pull quote with attribution.",
  linkList: "Related reading or internal links.",
  cta: "Heading, blurb, and one button.",
  media: "An image with an optional caption.",
  rawHtml: "Embed code. Scripts are stripped on save.",
};

/** Visual tone of a `callout` block. */
export const CALLOUT_TONES = ["note", "tip", "important", "caution"] as const;
export type CalloutTone = (typeof CALLOUT_TONES)[number];

export const CALLOUT_TONE_LABELS: Record<CalloutTone, string> = {
  note: "Note",
  tip: "Tip",
  important: "Important",
  caution: "Caution",
};

/** HTTP status for a redirect record — permanent (301) or temporary (302). */
export const REDIRECT_STATUS_CODES = [301, 302] as const;
export type RedirectStatusCode = (typeof REDIRECT_STATUS_CODES)[number];
