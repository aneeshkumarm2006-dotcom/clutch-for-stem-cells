/**
 * On-page SEO checks (§6) — pure, no external APIs, client + server safe.
 *
 * Produces simple pass / warn / fail signals a non-technical user can read at a
 * glance, both live in the editor and in the dashboard table. Operates on the
 * raw post fields (HTML body included) using string analysis only.
 */
import type { KeywordRel } from "@/lib/enums";

export type CheckStatus = "pass" | "warn" | "fail";

export interface SeoCheck {
  id: string;
  label: string;
  status: CheckStatus;
  message: string;
}

export interface SeoCheckInput {
  title: string;
  metaTitle?: string;
  excerpt?: string;
  body: string;
  keywords: { keyword: string; url: string; rel?: KeywordRel }[];
  coverImage?: { url?: string } | null;
}

/** Recommended character ranges (Google SERP truncation heuristics). */
export const META_TITLE_RANGE = { min: 50, max: 60 } as const;
export const META_DESC_RANGE = { min: 150, max: 160 } as const;
export const THIN_CONTENT_WORDS = 300;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/** Strip tags → plain text (for word counting / keyword presence). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(html: string): number {
  const text = htmlToText(html);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

export interface LinkCounts {
  internal: number;
  external: number;
  missingAlt: number;
  images: number;
}

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/** Count links (body anchors + keyword backlinks) and image alt coverage. */
export function analyzeMedia(input: SeoCheckInput): LinkCounts {
  let internal = 0;
  let external = 0;

  const hrefRe = /<a\b[^>]*\bhref\s*=\s*["']([^"']*)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(input.body)) !== null) {
    if (isExternal(m[1]!)) external++;
    else internal++;
  }
  // Keyword backlinks are woven in at render time — count them too.
  for (const k of input.keywords) {
    if (!k.keyword?.trim() || !k.url?.trim()) continue;
    if (isExternal(k.url)) external++;
    else internal++;
  }

  let images = 0;
  let missingAlt = 0;
  const imgRe = /<img\b[^>]*>/gi;
  let img: RegExpExecArray | null;
  while ((img = imgRe.exec(input.body)) !== null) {
    images++;
    const altMatch = /\balt\s*=\s*["']([^"']*)["']/i.exec(img[0]);
    if (!altMatch || !altMatch[1]!.trim()) missingAlt++;
  }

  return { internal, external, missingAlt, images };
}

function rangeStatus(len: number, min: number, max: number): CheckStatus {
  if (len === 0) return "fail";
  if (len >= min && len <= max) return "pass";
  return "warn";
}

/** Run every on-page check and return ordered results. */
export function runSeoChecks(input: SeoCheckInput): SeoCheck[] {
  const checks: SeoCheck[] = [];

  // Meta title
  const metaTitle = (input.metaTitle?.trim() || input.title?.trim()) ?? "";
  const titleLen = metaTitle.length;
  checks.push({
    id: "meta-title",
    label: "Meta title length",
    status: titleLen === 0 ? "fail" : rangeStatus(titleLen, META_TITLE_RANGE.min, META_TITLE_RANGE.max),
    message:
      titleLen === 0
        ? "Add a title."
        : `${titleLen} chars (ideal ${META_TITLE_RANGE.min}–${META_TITLE_RANGE.max}).`,
  });

  // Meta description (excerpt)
  const descLen = (input.excerpt?.trim() ?? "").length;
  checks.push({
    id: "meta-description",
    label: "Meta description length",
    status: rangeStatus(descLen, META_DESC_RANGE.min, META_DESC_RANGE.max),
    message:
      descLen === 0
        ? "Add a meta description (excerpt)."
        : `${descLen} chars (ideal ${META_DESC_RANGE.min}–${META_DESC_RANGE.max}).`,
  });

  // Word count
  const words = wordCount(input.body);
  checks.push({
    id: "word-count",
    label: "Word count",
    status: words >= THIN_CONTENT_WORDS ? "pass" : words === 0 ? "fail" : "warn",
    message:
      words === 0
        ? "No content yet."
        : words >= THIN_CONTENT_WORDS
          ? `${words} words.`
          : `${words} words — thin (aim for ${THIN_CONTENT_WORDS}+).`,
  });

  // Keyword presence in body
  const realKeywords = input.keywords.filter(
    (k) => k.keyword?.trim() && k.url?.trim(),
  );
  if (realKeywords.length) {
    const text = htmlToText(input.body).toLowerCase();
    const missing = realKeywords
      .filter((k) => !text.includes(k.keyword.trim().toLowerCase()))
      .map((k) => k.keyword.trim());
    checks.push({
      id: "keywords",
      label: "Keywords appear in body",
      status: missing.length ? "warn" : "pass",
      message: missing.length
        ? `Not found in body: ${missing.join(", ")}.`
        : `All ${realKeywords.length} keyword(s) present.`,
    });
  } else {
    checks.push({
      id: "keywords",
      label: "Keyword backlinks",
      status: "warn",
      message: "No keywords/backlinks added yet.",
    });
  }

  // Links
  const media = analyzeMedia(input);
  checks.push({
    id: "links",
    label: "Links",
    status: "pass",
    message: `${media.internal} internal · ${media.external} external.`,
  });

  // Image alt text
  checks.push({
    id: "image-alt",
    label: "Image alt text",
    status: media.missingAlt > 0 ? "warn" : "pass",
    message:
      media.images === 0
        ? "No inline images."
        : media.missingAlt > 0
          ? `${media.missingAlt} of ${media.images} image(s) missing alt text.`
          : `All ${media.images} image(s) have alt text.`,
  });

  // Cover image
  checks.push({
    id: "cover",
    label: "Cover image",
    status: input.coverImage?.url ? "pass" : "warn",
    message: input.coverImage?.url ? "Set." : "No cover image set.",
  });

  return checks;
}

/** Roll-up: a post is "SEO-ready" when nothing fails (warnings allowed). */
export function seoReadiness(checks: SeoCheck[]): {
  ready: boolean;
  pass: number;
  warn: number;
  fail: number;
} {
  let pass = 0;
  let warn = 0;
  let fail = 0;
  for (const c of checks) {
    if (c.status === "pass") pass++;
    else if (c.status === "warn") warn++;
    else fail++;
  }
  return { ready: fail === 0, pass, warn, fail };
}
