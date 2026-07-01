/**
 * SiteSetting validation (PRD §5.8 / Stage 1.10) — admin Settings + homepage
 * config (§8.7, §8.10). Every section is optional so the settings form can save
 * one panel at a time (PATCH semantics).
 */
import { z } from "zod";
import {
  imageSchema,
  objectIdSchema,
  seoSchema,
} from "@/lib/validation/common";

const heroSchema = z
  .object({
    headline: z.string().max(200),
    subhead: z.string().max(400),
    ctaPrimaryLabel: z.string().max(60),
    ctaSecondaryLabel: z.string().max(60),
    backgroundImage: imageSchema,
  })
  .partial();

const popularSearchSchema = z.object({
  label: z.string().min(1).max(80),
  href: z.string().min(1).max(400),
});

const testimonialSchema = z.object({
  quote: z.string().min(1).max(1000),
  author: z.string().max(120).optional(),
  role: z.string().max(120).optional(),
  location: z.string().max(120).optional(),
  avatar: imageSchema.optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

const disclaimersSchema = z
  .object({
    medical: z.string().max(2000),
    results: z.string().max(2000),
    footer: z.string().max(2000),
  })
  .partial();

const contactSchema = z
  .object({
    email: z.string().email().or(z.literal("")),
    phone: z.string().max(40),
    address: z.string().max(400),
  })
  .partial();

const socialLinksSchema = z
  .object({
    linkedin: z.string().url().or(z.literal("")),
    instagram: z.string().url().or(z.literal("")),
    facebook: z.string().url().or(z.literal("")),
    x: z.string().url().or(z.literal("")),
    youtube: z.string().url().or(z.literal("")),
  })
  .partial();

const featureFlagsSchema = z
  .object({
    enableCompare: z.boolean(),
    enableProviderSelfServe: z.boolean(),
    enableShortlist: z.boolean(),
    enableMatchingWizard: z.boolean(),
    enableBilling: z.boolean(),
    enableSavedSearches: z.boolean(),
    enableDarkMode: z.boolean(),
  })
  .partial();

const rankingWeightsSchema = z
  .object({
    rating: z.number().min(0),
    reviewVolume: z.number().min(0),
    recency: z.number().min(0),
    completeness: z.number().min(0),
    accreditation: z.number().min(0),
    tier: z.number().min(0),
  })
  .partial();

const analyticsSchema = z
  .object({
    ga4Id: z.string().max(40),
    plausibleDomain: z.string().max(200),
    posthogKey: z.string().max(200),
  })
  .partial();

const seoDefaultsSchema = seoSchema.extend({
  titleTemplate: z.string().max(120).optional(),
  twitterHandle: z.string().max(40).optional(),
});

export const siteSettingUpdateSchema = z
  .object({
    hero: heroSchema,
    popularSearches: z.array(popularSearchSchema),
    featuredClinicIds: z.array(objectIdSchema),
    testimonials: z.array(testimonialSchema),
    partnerLogos: z.array(imageSchema),
    seoDefaults: seoDefaultsSchema,
    disclaimers: disclaimersSchema,
    contact: contactSchema,
    social: socialLinksSchema,
    featureFlags: featureFlagsSchema,
    rankingWeights: rankingWeightsSchema,
    analytics: analyticsSchema,
  })
  .partial();

export type SiteSettingUpdateInput = z.infer<typeof siteSettingUpdateSchema>;
