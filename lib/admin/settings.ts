/**
 * Site settings read-layer (PRD §8.7 + §8.10 / Stage 6.9 + 6.12).
 *
 * Serializes the `SiteSetting` singleton for the homepage/content config and the
 * global settings forms. Ranking weights and feature flags merge their defaults.
 */
import "server-only";

import { dbConnect } from "@/lib/db";
import { id, serializeImage, type ImageView } from "@/lib/admin/serialize";
import { SiteSetting, toPlainObject } from "@/models";
import { DEFAULT_RANKING_WEIGHTS } from "@/lib/ranking";
import { FEATURES } from "@/config/site";

export interface SettingsView {
  hero: {
    headline?: string;
    subhead?: string;
    ctaPrimaryLabel?: string;
    ctaSecondaryLabel?: string;
    backgroundImage?: ImageView;
  };
  popularSearches: { label: string; href: string }[];
  featuredClinicIds: string[];
  testimonials: {
    quote: string;
    author?: string;
    role?: string;
    location?: string;
    rating?: number;
  }[];
  partnerLogos: ImageView[];
  disclaimers: { medical?: string; results?: string; footer?: string };
  seoDefaults: {
    titleTemplate?: string;
    twitterHandle?: string;
    metaTitle?: string;
    metaDescription?: string;
    ogImage?: string;
  };
  contact: { email?: string; phone?: string; address?: string };
  social: {
    linkedin?: string;
    instagram?: string;
    facebook?: string;
    x?: string;
    youtube?: string;
  };
  analytics: { ga4Id?: string; plausibleDomain?: string; posthogKey?: string };
  featureFlags: Record<string, boolean>;
  rankingWeights: {
    rating: number;
    reviewVolume: number;
    recency: number;
    completeness: number;
    accreditation: number;
    tier: number;
  };
}

export async function getSettingsView(): Promise<SettingsView> {
  await dbConnect();
  const s = await SiteSetting.getGlobal();

  return {
    hero: {
      headline: s.hero?.headline ?? "",
      subhead: s.hero?.subhead ?? "",
      ctaPrimaryLabel: s.hero?.ctaPrimaryLabel ?? "",
      ctaSecondaryLabel: s.hero?.ctaSecondaryLabel ?? "",
      backgroundImage: serializeImage(s.hero?.backgroundImage),
    },
    popularSearches: (s.popularSearches ?? []).map((p) => ({
      label: p.label,
      href: p.href,
    })),
    featuredClinicIds: (s.featuredClinicIds ?? []).map(id),
    testimonials: (s.testimonials ?? []).map((t) => ({
      quote: t.quote,
      author: t.author ?? "",
      role: t.role ?? "",
      location: t.location ?? "",
      rating: t.rating,
    })),
    partnerLogos: (s.partnerLogos ?? [])
      .map((p) => serializeImage(p))
      .filter(Boolean) as ImageView[],
    disclaimers: {
      medical: s.disclaimers?.medical ?? "",
      results: s.disclaimers?.results ?? "",
      footer: s.disclaimers?.footer ?? "",
    },
    seoDefaults: {
      titleTemplate: s.seoDefaults?.titleTemplate ?? "",
      twitterHandle: s.seoDefaults?.twitterHandle ?? "",
      metaTitle: s.seoDefaults?.metaTitle ?? "",
      metaDescription: s.seoDefaults?.metaDescription ?? "",
      ogImage: s.seoDefaults?.ogImage ?? "",
    },
    contact: {
      email: s.contact?.email ?? "",
      phone: s.contact?.phone ?? "",
      address: s.contact?.address ?? "",
    },
    social: {
      linkedin: s.social?.linkedin ?? "",
      instagram: s.social?.instagram ?? "",
      facebook: s.social?.facebook ?? "",
      x: s.social?.x ?? "",
      youtube: s.social?.youtube ?? "",
    },
    analytics: {
      ga4Id: s.analytics?.ga4Id ?? "",
      plausibleDomain: s.analytics?.plausibleDomain ?? "",
      posthogKey: s.analytics?.posthogKey ?? "",
    },
    featureFlags: { ...FEATURES, ...toPlainObject(s.featureFlags) },
    rankingWeights: {
      ...DEFAULT_RANKING_WEIGHTS,
      ...toPlainObject(s.rankingWeights),
    },
  };
}
