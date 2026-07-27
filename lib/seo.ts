/**
 * SEO — metadata builder + JSON-LD generators (Stage 3.4 / PRD §11).
 *
 * Pure & DB-free: every function takes already-loaded data (a clinic, a review,
 * breadcrumb items…) and returns a plain object — Next.js `Metadata` for
 * `generateMetadata`, or a JSON-LD object to drop into a `<script>` tag via
 * {@link renderJsonLd}. Page-level `seo` overrides win over Settings defaults,
 * which win over the `config/site.ts` constants.
 *
 * Schema.org types emitted (PRD §11 + AEO): `Organization`, `WebSite`,
 * `MedicalClinic`, `AggregateRating`, `Review`, `BreadcrumbList`, `FAQPage`,
 * `BlogPosting`, `MedicalWebPage`, `MedicalCondition`, `MedicalTherapy`,
 * `ItemList`.
 */
import type { Metadata } from "next";

import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  SOCIAL_LINKS,
} from "@/config/site";
import { META_SEPARATOR, normalizeMetaText } from "@/lib/meta-text";
import type { IClinic, IFaq, IReview, ISeo, ISeoDefaults } from "@/models";

// ── URL helpers ──────────────────────────────────────────────────────────────

/** Absolute URL for a root-relative path (idempotent for absolute inputs). */
export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export const clinicUrl = (slug: string): string =>
  absoluteUrl(`/clinic/${slug}`);
export const blogUrl = (slug: string): string => absoluteUrl(`/blog/${slug}`);

/**
 * Fallback title template used when Settings supply none — keeps every page
 * brand-suffixed even when the DB is unavailable at build time. Mirrors the
 * seeded `SiteSetting.seoDefaults.titleTemplate`. The pipe is the only
 * separator a meta tag may carry (see `lib/meta-text.ts`).
 */
export const DEFAULT_TITLE_TEMPLATE = `%s ${META_SEPARATOR} ${SITE_NAME}`;

/** Apply a Settings title template (e.g. `"%s | My Stem Cell Guide"`). */
export function applyTitleTemplate(title?: string, template?: string): string {
  if (!title) return SITE_NAME;
  if (!template) return title;
  return template.includes("%s") ? template.replace("%s", title) : title;
}

// ── Metadata builder ─────────────────────────────────────────────────────────

export interface BuildMetadataInput {
  /** Page title (before the Settings template is applied). */
  title?: string;
  description?: string;
  /** Root-relative path for the canonical + OG url (e.g. `/clinic/acme`). */
  path?: string;
  /** OG/Twitter image URL (absolute or root-relative). */
  image?: string;
  /** OpenGraph type — `website` (default), `article`, `profile`. */
  type?: "website" | "article" | "profile";
  /** Per-entity overrides (`Clinic.seo`, `BlogPost` meta, …). */
  seo?: ISeo | null;
  /** Site-wide defaults from `SiteSetting.seoDefaults`. */
  defaults?: ISeoDefaults | null;
  /**
   * Route-level `noindex` for thin/filtered/paginated URLs (e.g. a directory
   * page carrying `?sort=` or `?page=2`, or an incomplete combination page).
   * OR-ed with the per-entity/global `seo.noindex`. See `lib/seo-indexation.ts`.
   */
  noindex?: boolean;
  /**
   * When `noindex` is set, whether to also stop following links. Defaults to
   * `false` so a thin page stays `noindex, follow` — it de-dupes from search
   * but still passes link equity through to canonical/child pages.
   */
  nofollow?: boolean;
}

/**
 * Build a Next.js `Metadata` object with title template, canonical, OpenGraph,
 * and Twitter cards. Precedence: `seo` override → `defaults` → config constant.
 *
 * The per-page override (`ISeo`) may additionally carry `ogTitle`/`ogDescription`
 * (distinct social copy), a `twitterCard` type, and granular `robots`
 * (`{index, follow}`). All are optional — a record that sets none behaves
 * exactly as before, which is what keeps this backward-compatible with every
 * existing document.
 */
export function buildMetadata(input: BuildMetadataInput = {}): Metadata {
  const { seo, defaults } = input;

  // An explicit meta-title override is used **verbatim**: whoever typed it in
  // the admin panel typed the exact string they want in the SERP, brand suffix
  // and separator included. Only a route-supplied `title` gets the Settings
  // brand template applied — otherwise an override reading
  // "... | My Stem Cell Guide" would render as
  // "... | My Stem Cell Guide | My Stem Cell Guide".
  const titleOverride = seo?.metaTitle?.trim();
  // Every string below goes out through `normalizeMetaText`, so the two meta
  // rules (no em dash, the pipe is the only separator) hold for copy from any
  // source — a route file, the static-page registry, or a CMS record an editor
  // typed. On-page copy is untouched; only what reaches the `<head>` is
  // rewritten. See `lib/meta-text.ts`.
  const title = normalizeMetaText(
    titleOverride ||
      applyTitleTemplate(
        input.title,
        defaults?.titleTemplate ?? DEFAULT_TITLE_TEMPLATE,
      ),
    "title",
  );
  const description = normalizeMetaText(
    seo?.metaDescription ??
      input.description ??
      defaults?.metaDescription ??
      SITE_DESCRIPTION,
    "description",
  );

  const canonical =
    seo?.canonicalUrl ?? (input.path ? absoluteUrl(input.path) : SITE_URL);

  const imageRaw = input.image ?? seo?.ogImage ?? defaults?.ogImage;
  const images = imageRaw ? [{ url: absoluteUrl(imageRaw) }] : undefined;

  // Social copy falls back to the page title/description when not overridden
  // (both already normalized); an override goes through the same rules.
  const ogTitle = seo?.ogTitle
    ? normalizeMetaText(seo.ogTitle, "title")
    : title;
  const ogDescription = seo?.ogDescription
    ? normalizeMetaText(seo.ogDescription, "description")
    : description;
  const twitterCard =
    seo?.twitterCard ?? defaults?.twitterCard ?? "summary_large_image";

  return {
    metadataBase: new URL(SITE_URL),
    // `absolute` opts out of the root layout's `title.template` so the brand
    // suffix (applied above via the Settings/default template) isn't appended a
    // second time — e.g. "All clinics | My Stem Cell Guide", not
    // "All clinics | My Stem Cell Guide | My Stem Cell Guide".
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: canonical,
      siteName: SITE_NAME,
      type: input.type ?? "website",
      images,
    },
    twitter: {
      card: twitterCard,
      title: ogTitle,
      description: ogDescription,
      images: images?.map((i) => i.url),
      site: defaults?.twitterHandle,
    },
    robots: resolveRobots(input),
  };
}

/**
 * Resolve the meta-robots directive.
 *
 * `noindex` is the coarse switch and is OR-ed across the route-level flag, the
 * per-entity override, and the global default (any one of them can suppress a
 * page). A page-level `robots.index === false` counts as a `noindex` too.
 *
 * `follow` defaults to `true` even when noindexed — a thin/filtered page should
 * stay `noindex, follow` so link equity still flows to its canonical and
 * children. An explicit `robots.follow: false` (or the route-level `nofollow`)
 * is what actually drops it.
 *
 * Returns `undefined` when the page is fully indexable and followable, so we
 * emit no robots tag at all rather than a redundant `index, follow`.
 */
function resolveRobots(input: BuildMetadataInput): Metadata["robots"] {
  const { seo, defaults } = input;
  const override = seo?.robots;

  const noindex = Boolean(
    input.noindex ||
    seo?.noindex ||
    defaults?.noindex ||
    override?.index === false,
  );
  const nofollow = Boolean(input.nofollow || override?.follow === false);

  if (!noindex && !nofollow) return undefined;
  return { index: !noindex, follow: !nofollow };
}

// ── JSON-LD ──────────────────────────────────────────────────────────────────

export type JsonLd = Record<string, unknown>;

/**
 * Serialize JSON-LD for `dangerouslySetInnerHTML`, escaping `<` so the payload
 * can never break out of the `<script>` element (XSS-safe).
 */
export function renderJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Drop empty/undefined keys so emitted JSON-LD stays clean. */
function compact<T extends JsonLd>(obj: T): T {
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (
      v == null ||
      v === "" ||
      (Array.isArray(v) && v.length === 0) ||
      (typeof v === "object" &&
        !Array.isArray(v) &&
        Object.keys(v).length === 0)
    ) {
      delete obj[key];
    }
  }
  return obj;
}

/** Runtime identity for the site-wide nodes, resolved from admin Settings. */
export interface SiteIdentityInput {
  name?: string;
  url?: string;
  logo?: string;
  /** Authoritative profile URLs → `sameAs`. */
  sameAs?: string[];
  /** schema.org publisher type, e.g. `Organization` / `MedicalOrganization`. */
  type?: string;
  /** Path the sitelinks search box deep-links into. */
  searchPath?: string;
}

/**
 * `Organization` for the publisher.
 *
 * Every field is overridable so the admin Settings (site name, uploaded logo,
 * social profiles) drive the node at runtime; the `config/site.ts` constants are
 * only the build-time fallback for when the DB is unavailable. Passing no
 * argument reproduces the original constants-only behaviour.
 */
export function organizationJsonLd(opts: SiteIdentityInput = {}): JsonLd {
  const sameAs = (opts.sameAs ?? Object.values(SOCIAL_LINKS)).filter(Boolean);
  return compact({
    "@context": "https://schema.org",
    "@type": opts.type ?? "Organization",
    "@id": `${(opts.url ?? SITE_URL).replace(/\/$/, "")}/#organization`,
    name: opts.name ?? SITE_NAME,
    url: opts.url ?? SITE_URL,
    logo: opts.logo ? absoluteUrl(opts.logo) : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  });
}

/**
 * `WebSite` with a `SearchAction` — lets search engines render a sitelinks
 * search box that deep-links into our global search (PRD §11). Emitted
 * site-wide (see `components/seo/base-schema.tsx`) and linked to the
 * `Organization` node by `@id` so crawlers read one connected graph.
 */
export function websiteJsonLd(opts: SiteIdentityInput = {}): JsonLd {
  const base = (opts.url ?? SITE_URL).replace(/\/$/, "");
  const searchPath = opts.searchPath ?? "/search";
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${base}/#website`,
    name: opts.name ?? SITE_NAME,
    url: opts.url ?? SITE_URL,
    publisher: { "@id": `${base}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl(searchPath)}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

type ClinicSeoInput = Pick<
  IClinic,
  | "name"
  | "slug"
  | "description"
  | "tagline"
  | "logo"
  | "coverImage"
  | "website"
  | "ratingAvg"
  | "reviewCount"
  | "priceMin"
  | "priceMax"
  | "currency"
  | "locations"
  | "languages"
>;

function postalAddress(loc: IClinic["locations"][number]): JsonLd {
  return compact({
    "@type": "PostalAddress",
    streetAddress: loc.addressLine,
    addressLocality: loc.city,
    addressRegion: loc.region,
    postalCode: loc.postalCode,
    addressCountry: loc.countryCode ?? loc.country,
  });
}

/**
 * `MedicalClinic` (a Schema.org `MedicalBusiness`/`LocalBusiness` subtype) with
 * an embedded `AggregateRating` when the clinic has approved reviews.
 */
export function medicalClinicJsonLd(clinic: ClinicSeoInput): JsonLd {
  const hq =
    clinic.locations?.find((l) => l.isHQ) ?? clinic.locations?.[0] ?? null;
  const image = clinic.coverImage?.url ?? clinic.logo?.url;

  return compact({
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    name: clinic.name,
    url: clinicUrl(clinic.slug),
    description: clinic.description ?? clinic.tagline,
    image: image ? absoluteUrl(image) : undefined,
    sameAs: clinic.website || undefined,
    telephone: hq?.phone,
    address: hq ? postalAddress(hq) : undefined,
    geo:
      hq?.lat != null && hq?.lng != null
        ? { "@type": "GeoCoordinates", latitude: hq.lat, longitude: hq.lng }
        : undefined,
    availableLanguage: clinic.languages?.length ? clinic.languages : undefined,
    priceRange: priceRange(clinic),
    aggregateRating:
      clinic.reviewCount > 0 ? aggregateRatingJsonLd(clinic, false) : undefined,
  });
}

function priceRange(
  clinic: Pick<IClinic, "priceMin" | "priceMax" | "currency">,
): string | undefined {
  if (clinic.priceMin == null && clinic.priceMax == null) return undefined;
  const cur = clinic.currency ?? "USD";
  if (clinic.priceMin != null && clinic.priceMax != null)
    return `${clinic.priceMin}–${clinic.priceMax} ${cur}`;
  return `${clinic.priceMin ?? clinic.priceMax} ${cur}`;
}

/**
 * `AggregateRating`. Standalone by default; pass `false` to get the bare node
 * for embedding inside another type (e.g. {@link medicalClinicJsonLd}).
 */
export function aggregateRatingJsonLd(
  clinic: Pick<IClinic, "ratingAvg" | "reviewCount">,
  standalone = true,
): JsonLd {
  return compact({
    ...(standalone ? { "@context": "https://schema.org" } : {}),
    "@type": "AggregateRating",
    ratingValue: clinic.ratingAvg,
    reviewCount: clinic.reviewCount,
    bestRating: 5,
    worstRating: 1,
  });
}

type ReviewSeoInput = Pick<
  IReview,
  "reviewer" | "ratingOverall" | "headline" | "body" | "createdAt"
> & { clinicName: string };

/** `Review` node — reviewer is anonymized to "Verified Patient" (PRD §14). */
export function reviewJsonLd(review: ReviewSeoInput): JsonLd {
  const authorName =
    review.reviewer?.isAnonymous || !review.reviewer?.displayName
      ? "Verified Patient"
      : review.reviewer.displayName;
  const reviewBody =
    review.body?.experience ??
    review.body?.outcome ??
    review.body?.treatmentDescription;

  return compact({
    "@context": "https://schema.org",
    "@type": "Review",
    itemReviewed: { "@type": "MedicalClinic", name: review.clinicName },
    author: { "@type": "Person", name: authorName },
    reviewRating: {
      "@type": "Rating",
      ratingValue: review.ratingOverall,
      bestRating: 5,
      worstRating: 1,
    },
    name: review.headline,
    reviewBody,
    datePublished: review.createdAt?.toISOString?.() ?? undefined,
  });
}

export interface BreadcrumbItem {
  name: string;
  /** Root-relative path or absolute URL. */
  path: string;
}

/** `BreadcrumbList` from an ordered list of crumbs. */
export function breadcrumbListJsonLd(items: BreadcrumbItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

// ── Blog (SEO-team posts) ────────────────────────────────────────────────────

export interface BlogPostingSeoInput {
  title: string;
  slug: string;
  excerpt?: string;
  coverImageUrl?: string;
  author?: string;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  /** Credentialed medical reviewer → `reviewedBy` Person node (E-E-A-T). */
  reviewer?: ReviewerSeoInput | null;
  /** ISO date/Date the post was last medically reviewed → `lastReviewed`. */
  lastReviewed?: Date | string | null;
}

const toIso = (d?: Date | string | null): string | undefined => {
  if (!d) return undefined;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

/** `BlogPosting` JSON-LD for a public /blog post (§5 technical SEO). */
export function blogPostingJsonLd(post: BlogPostingSeoInput): JsonLd {
  const url = blogUrl(post.slug);
  return compact({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: post.title,
    description: post.excerpt,
    image: post.coverImageUrl ? absoluteUrl(post.coverImageUrl) : undefined,
    url,
    datePublished: toIso(post.publishedAt),
    dateModified: toIso(post.updatedAt) ?? toIso(post.publishedAt),
    author: post.author
      ? { "@type": "Person", name: post.author }
      : { "@type": "Organization", name: SITE_NAME },
    // Medical-review provenance for YMYL health content (omitted when unset).
    reviewedBy: reviewerNode(post.reviewer),
    lastReviewed: toIso(post.lastReviewed),
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  });
}

/** `FAQPage` from a clinic's (or a static page's) FAQ list (PRD §6.3). */
export function faqPageJsonLd(
  faqs: Pick<IFaq, "question" | "answer">[],
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

// ── Medical / topical pages (taxonomy + combination pages, AEO) ───────────────

/** A credentialed medical reviewer, surfaced as a `Person` for E-E-A-T. */
export interface ReviewerSeoInput {
  name: string;
  /** Post-nominal credentials, e.g. "MD, PhD". */
  credentials?: string;
  /** Authoritative profile URLs (registry, ORCID, LinkedIn). */
  sameAs?: string[];
}

/** Build the `Person` node for a medical reviewer (or `undefined` if none). */
function reviewerNode(reviewer?: ReviewerSeoInput | null): JsonLd | undefined {
  if (!reviewer?.name) return undefined;
  return compact({
    "@type": "Person",
    name: reviewer.name,
    honorificSuffix: reviewer.credentials,
    sameAs: reviewer.sameAs?.length ? reviewer.sameAs : undefined,
  });
}

export interface MedicalWebPageSeoInput {
  name: string;
  description?: string;
  /** Root-relative path or absolute URL (canonical of the page). */
  path: string;
  /** ISO date or Date the page was last medically reviewed. */
  lastReviewed?: Date | string | null;
  /** ISO date or Date the page content was last modified. */
  dateModified?: Date | string | null;
  reviewedBy?: ReviewerSeoInput | null;
  /** The primary entity the page is about (a MedicalCondition/Therapy node). */
  about?: JsonLd;
  /** Schema.org `MedicalSpecialty` string, e.g. "Rheumatology". */
  specialty?: string;
}

/**
 * `MedicalWebPage` — the YMYL page wrapper carrying medical-review provenance
 * (`lastReviewed` + `reviewedBy`) and an `about` link to the condition/therapy
 * entity. Emit alongside the more specific `MedicalCondition`/`MedicalTherapy`
 * node (pass that node as `about`).
 */
export function medicalWebPageJsonLd(input: MedicalWebPageSeoInput): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    lastReviewed: toIso(input.lastReviewed),
    dateModified: toIso(input.dateModified) ?? toIso(input.lastReviewed),
    reviewedBy: reviewerNode(input.reviewedBy),
    about: input.about,
    specialty: input.specialty,
  });
}

export interface MedicalConditionSeoInput {
  name: string;
  description?: string;
  path: string;
  /** Synonyms for entity matching, e.g. ["knee OA", "gonarthrosis"]. */
  alternateName?: string[];
  /** Names of therapies used for this condition (plain strings). */
  possibleTreatment?: string[];
}

/**
 * `MedicalCondition`. Attaches to condition pages and as the `about` of a
 * treatment×condition page. `alternateName` carries synonyms so answer engines
 * resolve the entity from any phrasing.
 */
export function medicalConditionJsonLd(
  input: MedicalConditionSeoInput,
): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "MedicalCondition",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    alternateName: input.alternateName?.length
      ? input.alternateName
      : undefined,
    possibleTreatment: input.possibleTreatment?.length
      ? input.possibleTreatment.map((name) => ({
          "@type": "MedicalTherapy",
          name,
        }))
      : undefined,
  });
}

export interface MedicalTherapySeoInput {
  name: string;
  description?: string;
  path: string;
  /** How the therapy is performed (e.g. delivery route), free text. */
  howPerformed?: string;
  /** Condition names this therapy is indicated for (plain strings). */
  indication?: string[];
}

/**
 * `MedicalTherapy` (a `MedicalProcedure` subtype — correct for cell/biologic
 * therapies). Attaches to treatment pages and all treatment×* combination
 * pages. Keep claims neutral — `description` is scanned for flagged phrases
 * upstream; this generator does not assert efficacy.
 */
export function medicalTherapyJsonLd(input: MedicalTherapySeoInput): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "MedicalTherapy",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    howPerformed: input.howPerformed,
    indication: input.indication?.length
      ? input.indication.map((name) => ({
          "@type": "MedicalCondition",
          name,
        }))
      : undefined,
  });
}

export interface PersonSeoInput {
  name: string;
  path: string;
  credentials?: string;
  jobTitle?: string;
  description?: string;
  image?: string;
  sameAs?: string[];
}

/**
 * `Person` node for a medical reviewer's bio page — the E-E-A-T author entity
 * that `MedicalWebPage.reviewedBy` references across the site.
 */
export function personJsonLd(input: PersonSeoInput): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "Person",
    name: input.name,
    url: absoluteUrl(input.path),
    honorificSuffix: input.credentials,
    jobTitle: input.jobTitle,
    description: input.description,
    image: input.image ? absoluteUrl(input.image) : undefined,
    sameAs: input.sameAs?.length ? input.sameAs : undefined,
  });
}

// ── Generic page wrappers (non-medical pages: composed pages + directories) ──

/** The `WebPage` subtypes we emit. `CollectionPage` marks a directory/index. */
export type WebPageType =
  "WebPage" | "CollectionPage" | "AboutPage" | "ContactPage";

export interface WebPageSeoInput {
  name: string;
  description?: string;
  /** Root-relative path or absolute URL (the page's canonical). */
  path: string;
  /** Narrower `@type` — defaults to `WebPage`. */
  type?: WebPageType;
  image?: string;
  datePublished?: Date | string | null;
  dateModified?: Date | string | null;
}

/**
 * A plain `WebPage`/`CollectionPage` wrapper for pages with no medical entity to
 * describe — editor-composed pages and directory/index pages. Medical topic
 * pages use {@link medicalWebPageJsonLd} instead, which additionally carries the
 * `reviewedBy`/`lastReviewed` YMYL provenance.
 */
export function webPageJsonLd(input: WebPageSeoInput): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": input.type ?? "WebPage",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    image: input.image ? absoluteUrl(input.image) : undefined,
    datePublished: toIso(input.datePublished),
    dateModified: toIso(input.dateModified) ?? toIso(input.datePublished),
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
  });
}

export interface ItemListEntry {
  /** Root-relative path or absolute URL of the listed item. */
  path: string;
  name?: string;
}

/**
 * `ItemList` of the clinics rendered on a directory/combination page — helps
 * search + answer engines read the result set as an ordered list. Only emit
 * when there is at least one item (never an empty list).
 */
export function itemListJsonLd(items: ItemListEntry[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(item.path),
      name: item.name,
    })),
  };
}
