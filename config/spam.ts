/**
 * Spam-protection configuration.
 *
 * Build-time defaults, like the rest of `config/`. The hostnames are derived
 * from `NEXT_PUBLIC_SITE_URL` so this file doesn't need editing when the domain
 * changes, with the known aliases listed explicitly for the cases where the env
 * var points at localhost (dev, and any script run outside Vercel).
 */
import { SITE_URL } from "@/config/site";

/** Host from `NEXT_PUBLIC_SITE_URL`, minus `www.`. Empty on a malformed value. */
function configuredHost(): string {
  try {
    return new URL(SITE_URL).host.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Hosts we own. A message with one of these templated into its *body* is a
 * mail-merge artefact ("Dear mystemcellguide.com owner…"), never a customer.
 */
export const OWN_HOSTS: readonly string[] = [
  ...new Set(
    [configuredHost(), "mystemcellguide.com"].filter(
      (h) => h && !h.startsWith("localhost") && !h.startsWith("127."),
    ),
  ),
];

/**
 * Email domains that always pass, whatever they write. Ours goes here so an
 * internal test submission is never held in the Spam view — an operator testing
 * the contact form should never end up debugging the filter instead.
 */
export const WHITELIST_EMAIL_DOMAINS: readonly string[] = [
  "davnoot.com",
  ...OWN_HOSTS,
];

/** Per-form submission caps. Deliberately generous: these catch floods, not people. */
export const FORM_RATE_LIMITS = {
  /** One address. A determined researcher might legitimately send three. */
  perIp: { limit: 5, windowSeconds: 60 * 60 },
  /**
   * One network neighbourhood (/24 or /48) over a longer window. This is the
   * cap that makes a rented subnet cost money instead of being free to rotate
   * through — but it is set high enough that a corporate NAT or a university
   * gateway won't trip it in a day.
   */
  perSubnet: { limit: 25, windowSeconds: 6 * 60 * 60 },
} as const;

/** How long a duplicate payload keeps matching. */
export const DUPLICATE_WINDOW_SECONDS = 24 * 60 * 60;

/** How long rejected submissions stay in the blocked bin before Mongo drops them. */
export const BLOCKED_RETENTION_DAYS = 30;

/** Anything submitted faster than this after render was not typed by a person. */
export const MIN_ELAPSED_MS = 3000;

/**
 * Grace period on the render stamp. A stamp older than this is treated as
 * missing rather than as evidence — people leave tabs open for days, and a
 * 3-day-old stamp says nothing either way.
 */
export const MAX_ELAPSED_MS = 3 * 24 * 60 * 60 * 1000;
