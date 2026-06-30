/**
 * `robots.txt` — Stage 7.4 / PRD §11.
 *
 * Allows crawling of all public content; disallows the admin panel, auth flows,
 * member-only/account areas, API handlers, and the tracked outbound-click
 * redirect (`/r/[id]`, which 302s off-site). Points crawlers at the dynamic
 * sitemap.
 */
import type { MetadataRoute } from "next";

import { SITE_URL } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  const base = SITE_URL.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/auth/", "/account", "/seoteam", "/r/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
