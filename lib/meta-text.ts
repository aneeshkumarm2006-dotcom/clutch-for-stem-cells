/**
 * Meta-tag text policy — the single source of truth for what may appear in a
 * `<title>` / `<meta name="description">` (and their OG/Twitter twins).
 *
 * Two rules, applied to every page:
 *
 *  1. **No em dash.** Em/en/figure dashes and the minus sign never appear in a
 *     meta tag. In a title they become the separator; in a description they
 *     become a comma (the parenthetical reading an em dash almost always has).
 *  2. **The pipe is the only separator symbol.** Sentence punctuation stays
 *     (`. , ' " ? !`) along with parentheses and the currency/percent signs that
 *     carry meaning in prices — everything else that is not a letter, digit or
 *     space is a violation: `& : ; / · • » → ~ ^ * # @ = + < > [ ] { } \ _ …`,
 *     curly quotes, emoji, and a spaced hyphen used as a separator.
 *
 * Pure and dependency-free on purpose: `buildMetadata` (lib/seo.ts) runs
 * {@link normalizeMetaText} over everything it emits, so the rules hold for
 * copy from any source — route files, the static-page registry, or CMS records
 * an editor typed in the admin panel — while `scripts/check-meta.ts` runs
 * {@link findMetaIssues} over the same strings to report what is off-policy.
 *
 * Only meta output is rewritten. On-page copy (an H1, a taxonomy name, body
 * prose) is left exactly as authored — `Umbilical Cord / Cord-Blood Therapy`
 * still reads that way in the heading, and only its `<title>` says
 * `Umbilical Cord | Cord-Blood Therapy`.
 */

/** Which meta field the text is destined for — decides how a separator reads. */
export type MetaTextKind = "title" | "description";

// ── Bold ─────────────────────────────────────────────────────────────────────

/**
 * A `<meta name="description">` carries no markup — a `<b>` in it is escaped and
 * shown literally, so the only way to get bold weight into a SERP snippet is to
 * swap the letters for their Mathematical Sans-Serif Bold code points. They are
 * Unicode *letters* (`\p{L}`) and digits (`\p{N}`), so they pass the policy
 * checks above untouched.
 *
 * Only ASCII A-Z / a-z / 0-9 have bold twins. Accented letters (the `ú` in
 * "Cancún"), punctuation and spaces have none and are left as they are.
 *
 * Trade-off worth knowing: screen readers announce these code points poorly or
 * skip them, and Google may normalize them away. Use it on a short lead phrase,
 * never on a whole description — and keep OG/Twitter copy plain (`buildMetadata`
 * does exactly that).
 */
const BOLD_UPPER_A = 0x1d5d4; // 𝗔
const BOLD_LOWER_A = 0x1d5ee; // 𝗮
const BOLD_ZERO = 0x1d7ec; // 𝟬

export function boldMetaText(text: string | null | undefined): string {
  if (!text) return "";
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x41 && code <= 0x5a) {
      out += String.fromCodePoint(BOLD_UPPER_A + (code - 0x41));
    } else if (code >= 0x61 && code <= 0x7a) {
      out += String.fromCodePoint(BOLD_LOWER_A + (code - 0x61));
    } else if (code >= 0x30 && code <= 0x39) {
      out += String.fromCodePoint(BOLD_ZERO + (code - 0x30));
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Embolden `prefix` where it opens `text`, leaving the rest plain.
 *
 * Both sides are normalized first, so a caller can pass the raw phrase it built
 * the description from and still match after the meta rules have rewritten it.
 * A prefix that does not open the description (an editor replaced the copy with
 * their own in the admin panel) is a no-op — the description goes out plain
 * rather than with a bold run in the wrong place.
 */
export function boldMetaPrefix(
  text: string,
  prefix: string | null | undefined,
): string {
  const needle = normalizeMetaText(prefix, "description");
  if (!needle || !text.startsWith(needle)) return text;
  return boldMetaText(needle) + text.slice(needle.length);
}

/** The only separator symbol allowed in a meta tag. */
export const META_SEPARATOR = "|";

// ── Length ───────────────────────────────────────────────────────────────────

/**
 * The longest a `<title>` may be. Past this, site auditors report the tag as
 * too long and a SERP shows a truncated version of it either way.
 *
 * 75 is the threshold the site's own audit uses, and it is a cliff rather than a
 * gradient: a 75-character title passes and a 76-character one does not.
 */
export const MAX_META_TITLE_LENGTH = 75;

/**
 * What a *generated* title aims for. Below the cap on purpose — a formula that
 * lands exactly on 75 has no room for the longer clinic name or city that the
 * next import brings, and Google truncates a desktop SERP title somewhere near
 * 60 characters anyway, so the tail of a 75-character title is rarely read.
 *
 * Authored copy (a blog post's own title) is not held to this: see
 * {@link fitMetaTitle} for what applies where.
 */
export const META_TITLE_TARGET_LENGTH = 70;

/**
 * Pick the longest title that fits, from candidates ordered **most informative
 * first**.
 *
 * This is how a formula sheds detail under pressure rather than being cut
 * mid-word: a clinic title offers "<name> | <condition> Stem Cell Therapy in
 * <city>, <state>" first and keeps dropping the least load-bearing part until
 * one fits. Truncation is never the answer — "…Stem Cell Therapy in Rancho Mi"
 * is worse than a shorter title that still reads as a sentence.
 *
 * Candidates are measured **after** {@link normalizeMetaText}, because that is
 * what actually reaches the `<head>` and it can change the length (`&` becomes
 * "and", a dash becomes " | "). Falls back to the last candidate — the shortest
 * form the caller offered — when nothing fits.
 */
export function fitMetaTitle(
  candidates: (string | null | undefined)[],
  max: number = META_TITLE_TARGET_LENGTH,
): string {
  const normalized = candidates
    .map((c) => normalizeMetaText(c, "title"))
    .filter(Boolean);
  if (!normalized.length) return "";
  return normalized.find((c) => c.length <= max) ?? normalized[normalized.length - 1];
}

/**
 * Characters allowed alongside letters, digits and whitespace.
 *
 * Sentence punctuation and the symbols that carry meaning inside a phrase
 * (`(MSC)`, `$5,000`, `40%`, `board-certified`). Tune this string to tighten or
 * relax the policy — every check and every rewrite reads it.
 */
export const ALLOWED_META_PUNCTUATION = `.,'"?!()%$£€-${META_SEPARATOR}`;

/** Dash characters that rule 1 bans outright: — – ― ‒ −. */
const EM_DASHES = "—–―‒−";

/**
 * Symbols that read as a separator and therefore collapse to the pipe:
 * · • ∙ ▪ ‣ ※ ¦ ‖ » « › ‹ → ⇒ ➜ ▶ : ;
 */
const SEPARATOR_SYMBOLS = "·•∙▪‣※¦‖»«›‹→⇒➜▶:;";

const ESCAPE_RE = /[.*+?^${}()|[\]\\-]/g;
const charClass = (chars: string): string => chars.replace(ESCAPE_RE, "\\$&");

/** Anything that is not a letter, digit, whitespace or allowed punctuation. */
const DISALLOWED_RE = new RegExp(
  `[^\\p{L}\\p{N}\\s${charClass(ALLOWED_META_PUNCTUATION)}]`,
  "gu",
);
const EM_DASH_RE = new RegExp(`[${charClass(EM_DASHES)}]`, "gu");
const SEPARATOR_RE = new RegExp(`[${charClass(SEPARATOR_SYMBOLS)}]`, "gu");

/** A hyphen with space on both sides is a separator, not a compound word. */
const SPACED_HYPHEN_RE = /\s+-+\s+/g;
/** Same for a slash: ` / ` separates, `OB/GYN` compounds. */
const SPACED_SLASH_RE = /(?:\s+\/+\s*|\s*\/+\s+)/g;

export type MetaIssueRule = "em-dash" | "disallowed-symbol";

export interface MetaIssue {
  rule: MetaIssueRule;
  /** The offending character. */
  char: string;
  /** `U+2014` style code point, for a report that survives a terminal. */
  codePoint: string;
  /** Zero-based index in the checked string. */
  index: number;
  /** The character in context, for the report. */
  excerpt: string;
}

const codePointOf = (ch: string): string =>
  `U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;

const excerptAt = (text: string, index: number): string => {
  const start = Math.max(0, index - 24);
  const end = Math.min(text.length, index + 25);
  const lead = start > 0 ? "..." : "";
  const tail = end < text.length ? "..." : "";
  return `${lead}${text.slice(start, end)}${tail}`;
};

/**
 * Every rule violation in a meta string, in source order. An em dash is
 * reported once, under rule 1 — it is also a disallowed symbol, and reporting
 * it twice would just double-count the same character.
 */
export function findMetaIssues(text: string | null | undefined): MetaIssue[] {
  if (!text) return [];
  const issues: MetaIssue[] = [];
  const emDashIndexes = new Set<number>();

  for (const match of text.matchAll(EM_DASH_RE)) {
    const index = match.index!;
    emDashIndexes.add(index);
    issues.push({
      rule: "em-dash",
      char: match[0],
      codePoint: codePointOf(match[0]),
      index,
      excerpt: excerptAt(text, index),
    });
  }

  for (const match of text.matchAll(DISALLOWED_RE)) {
    const index = match.index!;
    if (emDashIndexes.has(index)) continue;
    issues.push({
      rule: "disallowed-symbol",
      char: match[0],
      codePoint: codePointOf(match[0]),
      index,
      excerpt: excerptAt(text, index),
    });
  }

  return issues.sort((a, b) => a.index - b.index);
}

/** Whether a string is safe to emit as a meta tag as-is. */
export function isMetaCompliant(text: string | null | undefined): boolean {
  return findMetaIssues(text).length === 0;
}

/** Named HTML entities that reach us from rich-text editors. */
const ENTITIES: [RegExp, string][] = [
  [/&amp;|&#0*38;/gi, "&"],
  [/&quot;|&#0*34;/gi, '"'],
  [/&apos;|&#0*39;|&rsquo;|&lsquo;/gi, "'"],
  [/&nbsp;|&#0*160;/gi, " "],
  [/&mdash;|&#0*8212;|&ndash;|&#0*8211;/gi, "—"],
  [/&hellip;|&#0*8230;/gi, "..."],
];

/** Typographic characters that have a plain equivalent, so they just fold. */
const FOLDED: [RegExp, string][] = [
  [/[‘’‚‛′]/g, "'"],
  [/[“”„‟″]/g, '"'],
  [/…/g, "..."],
  [/[‐‑]/g, "-"],
  // Exotic spaces (no-break, thin, ideographic) and zero-width characters.
  [/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " "],
  [/[\u200B-\u200D\u2060\uFEFF]/g, ""],
];

/**
 * Rewrite a string so it satisfies both rules, preserving the copy's meaning.
 *
 * Separators (dashes, `·`, `:`, ` / `, ` - `) become ` | ` in a title and `, `
 * in a description, `&` becomes "and", an unspaced `OB/GYN`-style slash becomes
 * a hyphen, and anything left that is still off-policy is dropped rather than
 * guessed at. Idempotent: normalizing an already-clean string returns it
 * unchanged.
 */
export function normalizeMetaText(
  text: string | null | undefined,
  kind: MetaTextKind = "description",
): string {
  if (!text) return "";
  const separator = kind === "title" ? ` ${META_SEPARATOR} ` : ", ";

  let out = text;
  for (const [re, to] of ENTITIES) out = out.replace(re, to);
  for (const [re, to] of FOLDED) out = out.replace(re, to);

  // Rule 1 — em dashes, plus the other separator symbols rule 2 bans.
  out = out.replace(EM_DASH_RE, separator);
  out = out.replace(SEPARATOR_RE, separator);
  out = out.replace(SPACED_HYPHEN_RE, separator);
  out = out.replace(SPACED_SLASH_RE, separator);

  // Symbols that stand in for a word read better spelled out than dropped.
  out = out.replace(/\s*&+\s*/g, " and ");
  // A slash still left is inside a compound (`OB/GYN`, `24/7`) — hyphenate it.
  out = out.replace(/\/+/g, "-");
  // Anything else off-policy has no safe reading; drop it.
  out = out.replace(DISALLOWED_RE, " ");

  return tidy(out, kind);
}

/**
 * Repair the punctuation the substitutions above can leave behind: doubled
 * separators, a comma before a full stop, a space before `?`, a title that now
 * starts or ends with a pipe.
 */
function tidy(text: string, kind: MetaTextKind): string {
  const sep = `\\${META_SEPARATOR}`;
  let out = text.replace(/\s+/g, " ");

  // Collapse runs of separators/commas into a single one.
  out = out.replace(
    new RegExp(`(?:\\s*${sep}\\s*)+`, "g"),
    ` ${META_SEPARATOR} `,
  );
  out = out.replace(/(?:\s*,\s*)+/g, (match, offset: number, whole: string) => {
    // `$5,000` and `1,240` are one number, not a list — leave them tight.
    const before = whole[offset - 1] ?? "";
    const after = whole[offset + match.length] ?? "";
    if (match === "," && /\d/.test(before) && /\d/.test(after)) return ",";
    return ", ";
  });
  // A separator next to sentence punctuation or a comma is redundant.
  out = out.replace(new RegExp(`([.!?])\\s*${sep}`, "g"), "$1");
  out = out.replace(new RegExp(`,\\s*${sep}`, "g"), ` ${META_SEPARATOR}`);
  out = out.replace(new RegExp(`${sep}\\s*,`, "g"), ` ${META_SEPARATOR}`);
  // No space before closing punctuation, none after an opening bracket.
  out = out.replace(/\s+([.,!?)])/g, "$1");
  out = out.replace(/\(\s+/g, "(");
  out = out.replace(/,\s*([.!?])/g, "$1");
  out = out.replace(/([.!?])\1+/g, "$1");
  // Nothing dangling at either end.
  out = out.replace(new RegExp(`^[\\s,${sep}-]+`), "");
  out = out.replace(new RegExp(`[\\s,${sep}-]+$`), "");

  out = out.trim();
  // A description reads as a sentence; a title never takes a trailing period.
  if (kind === "title") out = out.replace(/\.+$/, "");
  return out;
}
