/**
 * Dynamic `sitemap.xml` — Stage 7.4 / PRD §11.
 *
 * Emits the static marketing/trust routes plus every published clinic, taxonomy
 * landing page (treatment/condition/country/city), and blog post. DB reads are
 * wrapped so a build-time outage degrades to "static routes only" rather than
 * failing the build (mirrors the `generateStaticParams` fallback pattern).
 * Revalidated hourly so newly published content appears without a redeploy.
 */
import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";
import {
  getClinicSitemapEntries,
  getTaxonomySitemapEntries,
  type SitemapEntry,
} from "@/lib/public-data";
import { getBlogSitemapEntries } from "@/lib/seoteam/blog-data";

export const revalidate = 3600;

type ChangeFreq = MetadataRoute.Sitemap[number]["changeFrequency"];

/** Static, always-present public routes with hand-tuned crawl priorities. */
const STATIC_ROUTES: {
  path: string;
  changeFrequency: ChangeFreq;
  priority: number;
}[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/clinics", changeFrequency: "daily", priority: 0.9 },
  { path: "/treatments", changeFrequency: "weekly", priority: 0.8 },
  { path: "/conditions", changeFrequency: "weekly", priority: 0.8 },
  { path: "/locations", changeFrequency: "weekly", priority: 0.8 },
  { path: "/blog", changeFrequency: "daily", priority: 0.7 },
  { path: "/find-a-clinic", changeFrequency: "monthly", priority: 0.7 },
  { path: "/for-clinics", changeFrequency: "monthly", priority: 0.6 },
  { path: "/about", changeFrequency: "monthly", priority: 0.4 },
  { path: "/methodology", changeFrequency: "monthly", priority: 0.5 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.3 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.4 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
  { path: "/medical-disclaimer", changeFrequency: "yearly", priority: 0.2 },
  { path: "/editorial-policy", changeFrequency: "yearly", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: absoluteUrl(r.path),
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  let dynamicEntries: MetadataRoute.Sitemap = [];
  try {
    const [clinics, taxonomy, blog]: [
      SitemapEntry[],
      SitemapEntry[],
      SitemapEntry[],
    ] = await Promise.all([
      getClinicSitemapEntries(),
      getTaxonomySitemapEntries(),
      getBlogSitemapEntries(),
    ]);

    dynamicEntries = [
      ...clinics.map((e) => ({
        url: absoluteUrl(e.path),
        lastModified: e.lastModified ?? now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...taxonomy.map((e) => ({
        url: absoluteUrl(e.path),
        lastModified: e.lastModified ?? now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...blog.map((e) => ({
        url: absoluteUrl(e.path),
        lastModified: e.lastModified ?? now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    // DB unavailable at build/render time — ship the static routes only.
  }

  return [...staticEntries, ...dynamicEntries];
}
