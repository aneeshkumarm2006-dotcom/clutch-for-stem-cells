/**
 * Homepage editor validation — the payload `/api/admin/homepage` accepts.
 *
 * Covers both halves of the landing page's storage in one body: the `homepage`
 * overlay (`SiteSetting.homepage`), the legacy top-level fields it still shares
 * the page with (`hero`, `popularSearches`, `testimonials`, `featuredClinicIds`),
 * and the route's meta, which is written into the `/` row of
 * `SiteSetting.pageSeo` — the same store `/admin/seo` owns.
 *
 * Blank strings are kept rather than rejected: a cleared field means "fall back
 * to the shipped copy", and `resolveHomepage` is what acts on that. Only the
 * meta block runs through the shared `seoSchema`, which turns blanks into
 * `undefined` so an emptied override is actually removed.
 */
import { z } from "zod";

import { HOMEPAGE_ICONS } from "@/config/homepage";
import { imageSchema, objectIdSchema, seoSchema } from "@/lib/validation/common";

/** Root-relative path, full URL, or in-page anchor. */
const hrefSchema = z.string().max(400);

const feedSectionSchema = z
  .object({
    enabled: z.boolean(),
    eyebrow: z.string().max(80),
    title: z.string().max(200),
    description: z.string().max(600),
    linkLabel: z.string().max(80),
    linkHref: hrefSchema,
    limit: z.number().int().min(1).max(24),
  })
  .partial();

const cardSchema = z
  .object({
    title: z.string().max(200),
    body: z.string().max(600),
    href: hrefSchema,
  })
  .partial();

const stepSchema = z
  .object({
    // An unknown icon key would render nothing, so the set is closed here
    // rather than silently degrading on the page.
    icon: z.enum(HOMEPAGE_ICONS),
    title: z.string().max(120),
    body: z.string().max(600),
  })
  .partial();

const faqItemSchema = z
  .object({
    question: z.string().max(300),
    answer: z.string().max(2000),
  })
  .partial();

const columnSchema = z
  .object({
    title: z.string().max(200),
    intro: z.string().max(1200),
    bullets: z.array(z.string().max(600)).max(12),
    outro: z.string().max(1200),
    ctaLabel: z.string().max(80),
    ctaHref: hrefSchema,
    disclaimer: z.enum(["none", "medical", "results", "pricing"]),
  })
  .partial();

export const homepageContentSchema = z
  .object({
    hero: z
      .object({
        ctaPrimaryHref: hrefSchema,
        ctaSecondaryHref: hrefSchema,
        showSearch: z.boolean(),
        popularLabel: z.string().max(60),
      })
      .partial(),
    treatments: feedSectionSchema,
    conditions: feedSectionSchema,
    highlights: z
      .object({
        enabled: z.boolean(),
        eyebrow: z.string().max(80),
        title: z.string().max(200),
        description: z.string().max(600),
        cards: z.array(cardSchema).max(12),
      })
      .partial(),
    destinations: feedSectionSchema,
    featured: feedSectionSchema,
    howItWorks: z
      .object({
        enabled: z.boolean(),
        eyebrow: z.string().max(80),
        title: z.string().max(200),
        description: z.string().max(600),
        steps: z.array(stepSchema).max(8),
      })
      .partial(),
    costBenefits: z
      .object({
        enabled: z.boolean(),
        columns: z.array(columnSchema).max(2),
      })
      .partial(),
    trust: z
      .object({
        enabled: z.boolean(),
        badge: z.string().max(80),
        title: z.string().max(200),
        body: z.string().max(800),
        ctaLabel: z.string().max(80),
        ctaHref: hrefSchema,
        showStats: z.boolean(),
        clinicsLabel: z.string().max(60),
        verifiedLabel: z.string().max(60),
        reviewsLabel: z.string().max(60),
      })
      .partial(),
    testimonials: z
      .object({
        enabled: z.boolean(),
        eyebrow: z.string().max(80),
        title: z.string().max(200),
        description: z.string().max(600),
        note: z.string().max(800),
      })
      .partial(),
    forClinics: z
      .object({
        enabled: z.boolean(),
        title: z.string().max(200),
        body: z.string().max(800),
        ctaLabel: z.string().max(80),
        ctaHref: hrefSchema,
      })
      .partial(),
    faq: z
      .object({
        enabled: z.boolean(),
        heading: z.string().max(200),
        items: z.array(faqItemSchema).max(30),
        moreLabel: z.string().max(80),
        moreHref: hrefSchema,
        emitJsonLd: z.boolean(),
      })
      .partial(),
    blog: feedSectionSchema,
    keywords: z.array(z.string().max(120)).max(30),
  })
  .partial();

const heroSchema = z
  .object({
    headline: z.string().max(200),
    subhead: z.string().max(400),
    ctaPrimaryLabel: z.string().max(60),
    ctaSecondaryLabel: z.string().max(60),
    backgroundImage: imageSchema.nullish(),
  })
  .partial();

const testimonialSchema = z.object({
  quote: z.string().min(1).max(1000),
  author: z.string().max(120).optional(),
  role: z.string().max(120).optional(),
  location: z.string().max(120).optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

export const homepageUpdateSchema = z
  .object({
    homepage: homepageContentSchema,
    hero: heroSchema,
    popularSearches: z
      .array(
        z.object({
          label: z.string().min(1).max(80),
          href: z.string().min(1).max(400),
        }),
      )
      .max(12),
    featuredClinicIds: z.array(objectIdSchema).max(24),
    testimonials: z.array(testimonialSchema).max(24),
    /** Meta for `/`, merged into the `SiteSetting.pageSeo` row for that path. */
    seo: seoSchema,
  })
  .partial();

export type HomepageUpdateInput = z.infer<typeof homepageUpdateSchema>;
