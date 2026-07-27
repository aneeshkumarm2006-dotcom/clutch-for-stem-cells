/**
 * Static-page metadata registry — the shipped `<title>`/meta description for
 * every public route whose copy lives in **code** rather than in a content
 * collection.
 *
 * Two consumers, one list:
 *  - `lib/page-metadata.ts` resolves a route's default title/description from
 *    here when its `generateMetadata` doesn't pass one, so these strings are the
 *    live values, not a copy that can drift.
 *  - `/admin/seo` lists these pages so an editor can see the shipped copy and
 *    override it (stored in `SiteSetting.pageSeo`) without a redeploy.
 *
 * Record-backed pages (clinics, taxonomy terms, blog posts, clinic landings)
 * are deliberately absent — each already carries its own `seo` sub-document,
 * edited where that record is edited. Private/noindex routes (`/account`,
 * `/shortlist`) are absent too: there is nothing to tune on a page that is
 * never in the index.
 *
 * Paths are normalized (root-relative, no trailing slash, no query) — the same
 * form `normalizePagePath` produces, which is what the override lookup keys on.
 */
import { SITE_NAME } from "@/config/site";

/** Grouping used purely to section the `/admin/seo` list. */
export type StaticPageGroup = "Core" | "Directory" | "Content" | "Legal";

export interface StaticPageMeta {
  /** Normalized root-relative path, e.g. `/` or `/find-a-clinic`. */
  path: string;
  /** Human label for the admin list. */
  label: string;
  group: StaticPageGroup;
  /** Shipped title, before the Settings brand template is applied. */
  title: string;
  /** Shipped meta description. */
  description: string;
}

export const STATIC_PAGES: StaticPageMeta[] = [
  {
    path: "/",
    label: "Homepage",
    group: "Core",
    title: "Stem Cell Guide",
    description:
      "Compare stem cell treatment options, costs and benefits across verified clinics: MSC, autologous, bone-marrow-derived, umbilical-cord and systemic cell therapy.",
  },
  {
    path: "/clinics",
    label: "Clinic directory",
    group: "Directory",
    // Keyword-aligned with the target "stem cell clinics" and the on-page H1,
    // giving a strong, non-thin title tag for the main directory.
    title: "Stem Cell Clinics",
    description:
      "Browse and compare verified stem cell clinics and stem cell treatment clinics worldwide by treatment, condition, location, and patient reviews.",
  },
  {
    path: "/treatments",
    label: "Treatments hub",
    group: "Directory",
    title: "Stem Cell Treatment",
    description:
      "Explore every stem cell treatment type, from local injections to systemic cell therapy delivered by IV, and compare clinics offering each approach.",
  },
  {
    path: "/conditions",
    label: "Conditions hub",
    group: "Directory",
    title: "Conditions treated",
    description:
      "Find regenerative-medicine clinics by the condition you're researching — from knee osteoarthritis to autoimmune and neurological conditions.",
  },
  {
    path: "/locations",
    label: "Destinations hub",
    group: "Directory",
    title: "Destinations",
    description:
      "Browse regenerative-medicine clinics by country. Compare popular medical-travel destinations for stem cell treatment.",
  },
  {
    path: "/search",
    label: "Site search",
    group: "Directory",
    title: "Search",
    description: "Search clinics, treatments, and conditions.",
  },
  {
    path: "/blog",
    label: "Blog index",
    group: "Content",
    title: "Blog",
    description: `Guides, updates, and insights from the ${SITE_NAME} team.`,
  },
  {
    path: "/find-a-clinic",
    label: "Find a clinic (wizard)",
    group: "Content",
    title: "Find a clinic",
    description:
      "Answer a few questions about your condition, budget, and timeframe and get matched with accredited regenerative-medicine clinics that fit.",
  },
  {
    path: "/for-clinics",
    label: "For clinics",
    group: "Content",
    title: "For clinics",
    description: `Get your regenerative-medicine clinic listed on ${SITE_NAME}. Build trust with verification and receive qualified patient inquiries.`,
  },
  {
    path: "/reviews/new",
    label: "Write a review",
    group: "Content",
    title: "Write a review",
    description:
      "Share your experience with a regenerative-medicine clinic. Reviews are checked by our team before they go live.",
  },
  {
    path: "/about",
    label: "About",
    group: "Content",
    title: "About",
    description: `${SITE_NAME} is an independent directory helping patients research and compare regenerative-medicine clinics.`,
  },
  {
    path: "/methodology",
    label: "Methodology",
    group: "Content",
    title: "Methodology",
    description: `How ${SITE_NAME} ranks clinics, verifies accreditations, and labels paid placement.`,
  },
  {
    path: "/contact",
    label: "Contact",
    group: "Content",
    title: "Contact",
    description: `Get in touch with the ${SITE_NAME} team.`,
  },
  {
    path: "/faq",
    label: "FAQ",
    group: "Content",
    title: "FAQ",
    description: `Common questions about ${SITE_NAME}, verification, reviews, and how to use the directory.`,
  },
  {
    path: "/editorial-policy",
    label: "Editorial policy",
    group: "Legal",
    title: "Editorial policy",
    description: `How ${SITE_NAME} curates clinics, moderates reviews, and labels paid placement.`,
  },
  {
    path: "/medical-disclaimer",
    label: "Medical disclaimer",
    group: "Legal",
    title: "Medical disclaimer",
    description: `${SITE_NAME} provides information only and is not medical advice.`,
  },
  {
    path: "/privacy",
    label: "Privacy policy",
    group: "Legal",
    title: "Privacy policy",
    description: `How ${SITE_NAME} collects, uses, and protects your information.`,
  },
  {
    path: "/terms",
    label: "Terms of service",
    group: "Legal",
    title: "Terms of service",
    description: `The terms that govern your use of ${SITE_NAME}.`,
  },
];

/**
 * Canonical key form for a page path: root-relative, query/hash stripped, no
 * trailing slash (`/` stays `/`), lowercased. Both the metadata lookup and the
 * stored override key on this, so `/Clinics?page=2` and `/clinics/` resolve to
 * the same entry as `/clinics`.
 */
export function normalizePagePath(path: string): string {
  const [withoutHash = ""] = path.split("#");
  const [withoutQuery = ""] = withoutHash.split("?");
  const trimmed = withoutQuery.trim().toLowerCase();
  if (!trimmed) return "/";
  const rooted = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return rooted.length > 1 ? rooted.replace(/\/+$/, "") : "/";
}

const BY_PATH = new Map(STATIC_PAGES.map((p) => [p.path, p]));

/** The shipped metadata for a fixed route, or `undefined` if not registered. */
export function staticPageMeta(path: string): StaticPageMeta | undefined {
  return BY_PATH.get(normalizePagePath(path));
}

export const STATIC_PAGE_GROUPS: StaticPageGroup[] = [
  "Core",
  "Directory",
  "Content",
  "Legal",
];
