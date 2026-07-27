/**
 * Homepage editor read layer — powers `/admin/content/homepage`.
 *
 * The form edits **stored** values, not resolved ones: a text field holds
 * whatever an editor typed (blank when nothing is stored) and shows the shipped
 * copy from `HOMEPAGE_DEFAULTS` as its placeholder. That is what makes clearing
 * a field restore the built-in string instead of blanking the page, and it's the
 * same contract `/admin/seo` uses for the fixed routes.
 *
 * Lists are the exception. A placeholder can't express "these four cards ship by
 * default", so an unset list is seeded with the shipped one — the editor sees
 * the real content and edits it directly. Testimonials have no shipped copy, so
 * an empty list there stays empty.
 *
 * Meta for `/` is read from the same `SiteSetting.pageSeo` row `/admin/seo`
 * writes, so the two screens can't disagree about the homepage's title tag.
 */
import "server-only";

import { dbConnect } from "@/lib/db";
import { id, serializeImage, type ImageView } from "@/lib/admin/serialize";
import { SiteSetting, toPlainObject, type IHomepage } from "@/models";
import { normalizePagePath, staticPageMeta } from "@/config/static-pages";
import {
  HOMEPAGE_DEFAULTS,
  type HomepageCard,
  type HomepageColumn,
  type HomepageFaqItem,
  type HomepageStep,
} from "@/config/homepage";
import type { TwitterCardType } from "@/lib/enums";

const HOME_PATH = "/";

/** A stored string, or "" when unset — the form shows the default as a placeholder. */
type Stored = string;

export interface HomepageFeedView {
  enabled: boolean;
  eyebrow: Stored;
  title: Stored;
  description: Stored;
  linkLabel: Stored;
  linkHref: Stored;
  limit: number;
}

export interface HomepageTestimonialView {
  quote: string;
  author: string;
  role: string;
  location: string;
  rating?: number;
}

export interface HomepageSeoView {
  metaTitle: Stored;
  metaDescription: Stored;
  ogTitle: Stored;
  ogDescription: Stored;
  ogImage: Stored;
  canonicalUrl: Stored;
  twitterCard: TwitterCardType | "";
  focusKeyword: Stored;
  noindex: boolean;
  /** Tri-state: `undefined` inherits, matching `ISeo.robots.follow`. */
  follow?: boolean;
}

export interface HomepageView {
  hero: {
    headline: Stored;
    subhead: Stored;
    ctaPrimaryLabel: Stored;
    ctaPrimaryHref: Stored;
    ctaSecondaryLabel: Stored;
    ctaSecondaryHref: Stored;
    showSearch: boolean;
    popularLabel: Stored;
    backgroundImage?: ImageView;
  };
  popularSearches: { label: string; href: string }[];
  treatments: HomepageFeedView;
  conditions: HomepageFeedView;
  highlights: {
    enabled: boolean;
    eyebrow: Stored;
    title: Stored;
    description: Stored;
    cards: HomepageCard[];
  };
  destinations: HomepageFeedView;
  featured: HomepageFeedView;
  featuredClinicIds: string[];
  howItWorks: {
    enabled: boolean;
    eyebrow: Stored;
    title: Stored;
    description: Stored;
    steps: HomepageStep[];
  };
  costBenefits: { enabled: boolean; columns: HomepageColumn[] };
  trust: {
    enabled: boolean;
    badge: Stored;
    title: Stored;
    body: Stored;
    ctaLabel: Stored;
    ctaHref: Stored;
    showStats: boolean;
    clinicsLabel: Stored;
    verifiedLabel: Stored;
    reviewsLabel: Stored;
  };
  testimonials: {
    enabled: boolean;
    eyebrow: Stored;
    title: Stored;
    description: Stored;
    note: Stored;
    items: HomepageTestimonialView[];
  };
  forClinics: {
    enabled: boolean;
    title: Stored;
    body: Stored;
    ctaLabel: Stored;
    ctaHref: Stored;
  };
  faq: {
    enabled: boolean;
    heading: Stored;
    moreLabel: Stored;
    moreHref: Stored;
    emitJsonLd: boolean;
    items: HomepageFaqItem[];
  };
  blog: HomepageFeedView;
  keywords: string[];
  seo: HomepageSeoView;
  /** Shipped title/description for `/`, shown as the meta placeholders. */
  seoPlaceholders: { title: string; description: string };
}

const text = (v: unknown): string =>
  typeof v === "string" && v.trim() ? v : "";

const flag = (v: unknown, fallback: boolean): boolean =>
  typeof v === "boolean" ? v : fallback;

const count = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;

/** Stored list, or the shipped one when nothing is stored. */
function seeded<T>(stored: unknown, shipped: T[]): T[] {
  return Array.isArray(stored) && stored.length > 0
    ? (stored as T[])
    : shipped.map((item) =>
        typeof item === "object" && item !== null
          ? ({ ...item } as T)
          : item,
      );
}

function feedView(
  stored: IHomepage[keyof IHomepage] | undefined,
  shipped: typeof HOMEPAGE_DEFAULTS.treatments,
): HomepageFeedView {
  const s = (stored ?? {}) as Record<string, unknown>;
  return {
    enabled: flag(s.enabled, shipped.enabled),
    eyebrow: text(s.eyebrow),
    title: text(s.title),
    description: text(s.description),
    linkLabel: text(s.linkLabel),
    linkHref: text(s.linkHref),
    limit: count(s.limit, shipped.limit),
  };
}

export async function getHomepageView(): Promise<HomepageView> {
  await dbConnect();
  const s = await SiteSetting.getGlobal();
  const d = HOMEPAGE_DEFAULTS;

  // `getGlobal()` hands back a hydrated document — spreading a subdocument
  // copies Mongoose internals and none of the values, so normalize first.
  const hp = toPlainObject(s.homepage) as IHomepage;
  const hero = toPlainObject(s.hero);

  const seoRow = (s.pageSeo ?? []).find(
    (row) => row?.path && normalizePagePath(row.path) === HOME_PATH,
  );
  const seo = toPlainObject(seoRow);
  const shipped = staticPageMeta(HOME_PATH);

  const storedColumns = (hp.costBenefits?.columns ?? []) as Partial<
    HomepageColumn
  >[];

  return {
    hero: {
      headline: text(hero.headline),
      subhead: text(hero.subhead),
      ctaPrimaryLabel: text(hero.ctaPrimaryLabel),
      ctaPrimaryHref: text(hp.hero?.ctaPrimaryHref),
      ctaSecondaryLabel: text(hero.ctaSecondaryLabel),
      ctaSecondaryHref: text(hp.hero?.ctaSecondaryHref),
      showSearch: flag(hp.hero?.showSearch, d.hero.showSearch),
      popularLabel: text(hp.hero?.popularLabel),
      backgroundImage: serializeImage(hero.backgroundImage),
    },
    popularSearches: seeded(
      (s.popularSearches ?? []).map((p) => ({ label: p.label, href: p.href })),
      d.popularSearches,
    ),
    treatments: feedView(hp.treatments, d.treatments),
    conditions: feedView(hp.conditions, d.conditions),
    highlights: {
      enabled: flag(hp.highlights?.enabled, d.highlights.enabled),
      eyebrow: text(hp.highlights?.eyebrow),
      title: text(hp.highlights?.title),
      description: text(hp.highlights?.description),
      cards: seeded<HomepageCard>(hp.highlights?.cards, d.highlights.cards).map(
        (c) => ({ title: c.title ?? "", body: c.body ?? "", href: c.href ?? "" }),
      ),
    },
    destinations: feedView(hp.destinations, d.destinations),
    featured: feedView(hp.featured, d.featured),
    featuredClinicIds: (s.featuredClinicIds ?? []).map(id),
    howItWorks: {
      enabled: flag(hp.howItWorks?.enabled, d.howItWorks.enabled),
      eyebrow: text(hp.howItWorks?.eyebrow),
      title: text(hp.howItWorks?.title),
      description: text(hp.howItWorks?.description),
      steps: seeded<HomepageStep>(
        hp.howItWorks?.steps,
        d.howItWorks.steps,
      ).map((step) => ({
        icon: step.icon || "check",
        title: step.title ?? "",
        body: step.body ?? "",
      })),
    },
    costBenefits: {
      enabled: flag(hp.costBenefits?.enabled, d.costBenefits.enabled),
      // Always exactly two columns — the layout is a fixed two-up grid, so a
      // missing stored column falls back to the shipped one rather than
      // collapsing the row.
      columns: d.costBenefits.columns.map((fallback, i) => {
        const stored = storedColumns[i];
        return {
          title: stored?.title ?? fallback.title,
          intro: stored?.intro ?? fallback.intro,
          bullets: stored?.bullets ?? [...fallback.bullets],
          outro: stored?.outro ?? fallback.outro,
          ctaLabel: stored?.ctaLabel ?? fallback.ctaLabel,
          ctaHref: stored?.ctaHref ?? fallback.ctaHref,
          disclaimer: stored?.disclaimer ?? fallback.disclaimer,
        };
      }),
    },
    trust: {
      enabled: flag(hp.trust?.enabled, d.trust.enabled),
      badge: text(hp.trust?.badge),
      title: text(hp.trust?.title),
      body: text(hp.trust?.body),
      ctaLabel: text(hp.trust?.ctaLabel),
      ctaHref: text(hp.trust?.ctaHref),
      showStats: flag(hp.trust?.showStats, d.trust.showStats),
      clinicsLabel: text(hp.trust?.clinicsLabel),
      verifiedLabel: text(hp.trust?.verifiedLabel),
      reviewsLabel: text(hp.trust?.reviewsLabel),
    },
    testimonials: {
      enabled: flag(hp.testimonials?.enabled, d.testimonials.enabled),
      eyebrow: text(hp.testimonials?.eyebrow),
      title: text(hp.testimonials?.title),
      description: text(hp.testimonials?.description),
      note: text(hp.testimonials?.note),
      items: (s.testimonials ?? []).map((t) => ({
        quote: t.quote,
        author: t.author ?? "",
        role: t.role ?? "",
        location: t.location ?? "",
        rating: t.rating,
      })),
    },
    forClinics: {
      enabled: flag(hp.forClinics?.enabled, d.forClinics.enabled),
      title: text(hp.forClinics?.title),
      body: text(hp.forClinics?.body),
      ctaLabel: text(hp.forClinics?.ctaLabel),
      ctaHref: text(hp.forClinics?.ctaHref),
    },
    faq: {
      enabled: flag(hp.faq?.enabled, d.faq.enabled),
      heading: text(hp.faq?.heading),
      moreLabel: text(hp.faq?.moreLabel),
      moreHref: text(hp.faq?.moreHref),
      emitJsonLd: flag(hp.faq?.emitJsonLd, d.faq.emitJsonLd),
      items: seeded<HomepageFaqItem>(hp.faq?.items, d.faq.items).map((f) => ({
        question: f.question ?? "",
        answer: f.answer ?? "",
      })),
    },
    blog: feedView(hp.blog, d.blog),
    keywords: seeded<string>(hp.keywords, d.keywords),
    seo: {
      metaTitle: text(seo.metaTitle),
      metaDescription: text(seo.metaDescription),
      ogTitle: text(seo.ogTitle),
      ogDescription: text(seo.ogDescription),
      ogImage: text(seo.ogImage),
      canonicalUrl: text(seo.canonicalUrl),
      twitterCard: (seo.twitterCard as TwitterCardType) ?? "",
      focusKeyword: text(seo.focusKeyword),
      noindex: Boolean(seo.noindex),
      follow: seo.robots?.follow,
    },
    seoPlaceholders: {
      title: shipped?.title ?? "",
      description: shipped?.description ?? "",
    },
  };
}
