/**
 * SEO — metadata builder + JSON-LD generators (Stage 3.4 / PRD §11).
 *
 * Pure & DB-free: every function takes already-loaded data (a clinic, a review,
 * breadcrumb items…) and returns a plain object — Next.js `Metadata` for
 * `generateMetadata`, or a JSON-LD object to drop into a `<script>` tag via
 * {@link renderJsonLd}. Page-level `seo` overrides win over Settings defaults,
 * which win over the `config/site.ts` constants.
 *
 * Schema.org types emitted (PRD §11): `Organization`, `MedicalClinic`,
 * `AggregateRating`, `Review`, `BreadcrumbList`, `FAQPage`.
 */
import type { Metadata } from "next";

import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  SOCIAL_LINKS,
} from "@/config/site";
import type {
  IClinic,
  IFaq,
  IReview,
  ISeo,
  ISeoDefaults,
} from "@/models";

// ── URL helpers ──────────────────────────────────────────────────────────────

/** Absolute URL for a root-relative path (idempotent for absolute inputs). */
export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export const clinicUrl = (slug: string): string =>
  absoluteUrl(`/clinic/${slug}`);
export const blogUrl = (slug: string): string => absoluteUrl(`/blog/${slug}`);

/** Apply a Settings title template (e.g. `"%s · StemConnect"`). */
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
}

/**
 * Build a Next.js `Metadata` object with title template, canonical, OpenGraph,
 * and Twitter cards. Precedence: `seo` override → `defaults` → config constant.
 */
export function buildMetadata(input: BuildMetadataInput = {}): Metadata {
  const { seo, defaults } = input;

  const title = applyTitleTemplate(
    seo?.metaTitle ?? input.title,
    defaults?.titleTemplate,
  );
  const description =
    seo?.metaDescription ??
    input.description ??
    defaults?.metaDescription ??
    SITE_DESCRIPTION;

  const canonical =
    seo?.canonicalUrl ?? (input.path ? absoluteUrl(input.path) : SITE_URL);

  const imageRaw = input.image ?? seo?.ogImage ?? defaults?.ogImage;
  const images = imageRaw ? [{ url: absoluteUrl(imageRaw) }] : undefined;

  const noindex = seo?.noindex ?? defaults?.noindex ?? false;

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: input.type ?? "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images?.map((i) => i.url),
      site: defaults?.twitterHandle,
    },
    robots: noindex ? { index: false, follow: false } : undefined,
  };
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

/** `Organization` for the publisher (homepage / global). */
export function organizationJsonLd(opts: { logo?: string } = {}): JsonLd {
  const sameAs = Object.values(SOCIAL_LINKS).filter(Boolean);
  return compact({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: opts.logo ? absoluteUrl(opts.logo) : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  });
}

/**
 * `WebSite` with a `SearchAction` — lets search engines render a sitelinks
 * search box that deep-links into our global search (PRD §11). Homepage only.
 */
export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/search")}?q={search_term_string}`,
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
