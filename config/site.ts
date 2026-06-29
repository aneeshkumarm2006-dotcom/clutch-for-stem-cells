/**
 * Central site config — Stage 0.3 / PRD §12.
 *
 * `SITE_NAME` is a placeholder ("StemConnect", PRD §7 / Q7). Reference this
 * constant everywhere the brand name appears so it can be renamed in one place.
 * Runtime-tunable values (hero, featured clinics, ranking weights, etc.) live in
 * the `SiteSetting` singleton; this file holds build-time defaults only.
 */

export const SITE_NAME = "StemConnect";

export const SITE_TAGLINE = "Find and trust regenerative-medicine clinics";

export const SITE_DESCRIPTION =
  "Discover, compare, and review accredited stem cell and regenerative-medicine clinics worldwide.";

/** Default currency (admin Settings can override per PRD §8.10). */
export const DEFAULT_CURRENCY = "USD";

/** Default locale for number/currency formatting. */
export const DEFAULT_LOCALE = "en-US";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Feature flags — PRD §8.10 / §16. Build-time defaults; Settings may override
 * at runtime. Keep Phase 2 features off until their stage ships.
 */
export const FEATURES = {
  /** Compare clinics page `/compare?ids=` — Phase 2. */
  enableCompare: false,
  /** Provider self-serve onboarding + profile claim — Phase 2. */
  enableProviderSelfServe: false,
  /** Member shortlist (guest localStorage → sync on login) — Stage 5.11. */
  enableShortlist: true,
  /** Education hub / blog — Stage 5.8. */
  enableResources: true,
  /** Find-a-clinic matching wizard — Stage 5.6. */
  enableMatchingWizard: true,
  /** Live Stripe billing for tiers (display-only in MVP) — Phase 2. */
  enableBilling: false,
  /** Saved searches with alerts — Phase 2. */
  enableSavedSearches: false,
  /** Dark mode (token map in Design appendix) — Phase 2. */
  enableDarkMode: false,
} as const;

export type FeatureFlag = keyof typeof FEATURES;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURES[flag];
}

/** Social links (overridable via admin Settings). */
export const SOCIAL_LINKS = {
  twitter: "",
  linkedin: "",
  facebook: "",
  instagram: "",
} as const;

/**
 * Persistent medical disclaimer — Compliance §8.1 / PRD §14.
 * Rendered in the footer and on profiles, reviews, case studies, and the
 * matching wizard. Informational only; not medical advice.
 */
export const MEDICAL_DISCLAIMER =
  `${SITE_NAME} provides information to help you research clinics and is not a ` +
  "medical provider. Content is for informational purposes only and is not " +
  "medical advice. Treatments are not guaranteed and individual results vary. " +
  "Always consult a qualified healthcare professional.";
