/**
 * Keyword backlinks (§4) — turn keyword occurrences in a post body into links.
 *
 * Pure & dependency-free. Operates on **already-sanitized** HTML and only ever
 * rewrites text that sits outside `<a>`, headings, and `<code>`/`<pre>` — so it
 * can't break existing links or smuggle markup. We tokenize the HTML (tags vs
 * text), track which tags are open, and for each eligible text run we replace
 * keyword matches with anchors, protecting inserted anchors from any further
 * matching (no double-linking, no nesting).
 *
 * Matching is case-insensitive and word-boundary aware (Unicode). By default we
 * link the first occurrence of each keyword only; `linkFirstOnly: false` links
 * every occurrence.
 */
import type { KeywordRel } from "@/lib/enums";

export interface KeywordLink {
  keyword: string;
  url: string;
  rel: KeywordRel;
}

/** Tags whose text must never be auto-linked. */
const SKIP_TAGS = new Set([
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "code",
  "pre",
]);

/** Void elements never push onto the open-tag stack. */
const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Build the opening `<a …>` for a keyword link. */
function anchorOpen(url: string, rel: KeywordRel): string {
  const isExternal = /^https?:\/\//i.test(url);
  const relTokens: string[] = [];
  if (isExternal) relTokens.push("noopener");
  if (rel === "nofollow") relTokens.push("nofollow");
  if (rel === "sponsored") relTokens.push("sponsored");

  const attrs = [`href="${escapeAttr(url)}"`];
  if (isExternal) attrs.push(`target="_blank"`);
  if (relTokens.length) attrs.push(`rel="${relTokens.join(" ")}"`);
  return `<a ${attrs.join(" ")}>`;
}

type Segment = { html: false; value: string } | { html: true; value: string };

/**
 * Replace keyword matches inside a list of plain-text segments, splitting each
 * match out into a protected (`html: true`) anchor segment so later keywords
 * can't match inside it. Returns the new segment list and whether a link was
 * created (used to enforce first-occurrence-only).
 */
function linkSegments(
  segments: Segment[],
  keyword: string,
  url: string,
  rel: KeywordRel,
  onlyFirst: boolean,
): { segments: Segment[]; linked: boolean } {
  const flags = onlyFirst ? "iu" : "giu";
  const re = new RegExp(
    `(?<![\\p{L}\\p{N}_])(${escapeRegExp(keyword)})(?![\\p{L}\\p{N}_])`,
    flags,
  );
  const open = anchorOpen(url, rel);
  let linked = false;
  const out: Segment[] = [];

  for (const seg of segments) {
    if (seg.html || (onlyFirst && linked)) {
      out.push(seg);
      continue;
    }
    const text = seg.value;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    re.lastIndex = 0;
    let touched = false;

    while ((match = re.exec(text)) !== null) {
      touched = true;
      const start = match.index;
      const matched = match[1]!;
      if (start > lastIndex) {
        out.push({ html: false, value: text.slice(lastIndex, start) });
      }
      out.push({ html: true, value: `${open}${matched}</a>` });
      lastIndex = start + matched.length;
      linked = true;
      if (onlyFirst) break;
      // Guard against zero-length loops (matched is always ≥1 here).
      if (re.lastIndex <= start) re.lastIndex = start + 1;
    }

    if (!touched) {
      out.push(seg);
    } else if (lastIndex < text.length) {
      out.push({ html: false, value: text.slice(lastIndex) });
    }
  }

  return { segments: out, linked };
}

/** Transform a single eligible text run, applying every keyword in order. */
function linkText(
  text: string,
  keywords: KeywordLink[],
  linkFirstOnly: boolean,
  used: Set<string>,
): string {
  let segments: Segment[] = [{ html: false, value: text }];

  for (const kw of keywords) {
    const key = kw.keyword.toLowerCase();
    if (linkFirstOnly && used.has(key)) continue;
    const result = linkSegments(
      segments,
      kw.keyword,
      kw.url,
      kw.rel,
      linkFirstOnly,
    );
    segments = result.segments;
    if (result.linked && linkFirstOnly) used.add(key);
  }

  return segments.map((s) => s.value).join("");
}

/**
 * Weave keyword backlinks into a sanitized HTML body.
 *
 * @param html         Sanitized post body.
 * @param keywords     Keyword → URL → rel entries.
 * @param linkFirstOnly Link only the first occurrence of each keyword (default).
 */
export function applyKeywordLinks(
  html: string,
  keywords: KeywordLink[],
  linkFirstOnly = true,
): string {
  if (!html) return html;

  // Normalize: drop blanks, dedupe by keyword (first wins), longest first so
  // multi-word phrases win over their constituent words.
  const seen = new Set<string>();
  const normalized = keywords
    .map((k) => ({ keyword: k.keyword.trim(), url: k.url.trim(), rel: k.rel }))
    .filter((k) => {
      const key = k.keyword.toLowerCase();
      if (!k.keyword || !k.url || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.keyword.length - a.keyword.length);

  if (!normalized.length) return html;

  const used = new Set<string>();
  // Match tags, comments, AND HTML entities. Entities are kept opaque so a
  // keyword equal to an entity name (e.g. "amp", "nbsp") can't match inside one
  // and corrupt it (e.g. splitting `&amp;`).
  const tokenRe =
    /<!--[\s\S]*?-->|<[^>]+>|&(?:#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g;
  const openTags: string[] = [];
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const skipActive = (): boolean => openTags.some((t) => SKIP_TAGS.has(t));

  const handleText = (text: string): string =>
    skipActive() ? text : linkText(text, normalized, linkFirstOnly, used);

  while ((match = tokenRe.exec(html)) !== null) {
    if (match.index > lastIndex) {
      result += handleText(html.slice(lastIndex, match.index));
    }
    const tag = match[0]!;
    lastIndex = tokenRe.lastIndex;

    // HTML entity — emit as-is, never link inside it.
    if (tag.startsWith("&")) {
      result += tag;
      continue;
    }

    if (tag.startsWith("<!--")) {
      result += tag;
      continue;
    }

    const closeMatch = /^<\s*\/\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(tag);
    if (closeMatch) {
      const name = closeMatch[1]!.toLowerCase();
      const idx = openTags.lastIndexOf(name);
      if (idx !== -1) openTags.splice(idx, 1);
      result += tag;
      continue;
    }

    const openMatch = /^<\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(tag);
    if (openMatch) {
      const name = openMatch[1]!.toLowerCase();
      const selfClosing = /\/\s*>$/.test(tag);
      if (!selfClosing && !VOID_TAGS.has(name)) openTags.push(name);
    }
    result += tag;
  }

  if (lastIndex < html.length) {
    result += handleText(html.slice(lastIndex));
  }

  return result;
}
