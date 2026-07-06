/**
 * `robots.txt` — Stage 7.4 / PRD §11 + AEO posture.
 *
 * Allows crawling of all public content; disallows the admin panel, auth flows,
 * member-only/account areas, API handlers, and the tracked outbound-click
 * redirect (`/r/[id]`, which 302s off-site). Points crawlers at the dynamic
 * sitemap.
 *
 * AI / answer-engine bots (GPTBot, ClaudeBot, PerplexityBot, Google-Extended…)
 * get their own explicit rules so we're citable in AI search and never
 * accidentally blocked by a future `*` tightening. Each mirrors the `*` rule.
 *
 * We deliberately do NOT disallow `?param` (faceted) URLs here — that would stop
 * crawlers from ever seeing the canonical + `noindex` we emit on those pages
 * (see `lib/seo-indexation.ts`). Filtered-URL crawl control is meta-robots, not
 * robots.txt.
 */
import type { MetadataRoute } from "next";

import { SITE_URL } from "@/config/site";

/** Paths kept out of every crawler (admin/auth/account/API/redirect/hub). */
const DISALLOW = [
  "/admin",
  "/api/",
  "/auth/",
  "/account",
  "/seoteam",
  "/analyticshub",
  "/r/",
];

/**
 * Named AI / answer-engine crawlers we explicitly welcome (AEO). Listing them
 * individually keeps us citable even if the wildcard rule is ever narrowed, and
 * documents the intent. Order pairs each engine's crawl + fetch agents.
 */
const AI_CRAWLERS = [
  "GPTBot", // OpenAI training crawler
  "OAI-SearchBot", // ChatGPT search index
  "ChatGPT-User", // ChatGPT live fetch (on-demand browsing)
  "ClaudeBot", // Anthropic crawler
  "Claude-User", // Claude live fetch
  "anthropic-ai", // legacy Anthropic agent
  "PerplexityBot", // Perplexity index
  "Perplexity-User", // Perplexity live fetch
  "Google-Extended", // Gemini / Vertex training + AI Overviews
  "Applebot-Extended", // Apple Intelligence
];

export default function robots(): MetadataRoute.Robots {
  const base = SITE_URL.replace(/\/$/, "");
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: DISALLOW,
      })),
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
