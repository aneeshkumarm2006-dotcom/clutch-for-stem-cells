/**
 * Public-form spam classifier — pure functions, no I/O, no imports from the
 * data layer. Every public endpoint scores through `classifySubmission` so one
 * rule set covers the lead form, the matching wizard, the review form, and the
 * report dialog.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ONE RULE THAT MATTERS
 *
 * Score the DIRECTION of a message, never its topic.
 *
 *   "We can get you ranking on Google — reply YES"   → spam. They are selling.
 *   "We need help ranking on Google"                 → the customer.
 *
 * This site sells to people researching stem-cell treatment. They will write
 * about cost, about travel, about clinics by name, and they will use the exact
 * vocabulary a spammer uses. A rule that keys on a topic word deletes the
 * business. Every content rule below keys on who is offering what to whom.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THREE RULES THAT MUST NEVER BE ADDED
 *
 * Each of these ate a real lead on a sibling site. If a future change
 * reintroduces one, it is wrong however much junk it catches:
 *
 *  1. Never score a bare dollar figure. Real enquiries constantly say
 *     "our budget is about $8,000" — this site literally asks for a budget
 *     range. Only retail boilerplate (see RETAIL_PROMO) counts as money spam.
 *
 *  2. Never score a link to the sender's own site. Prospects link their own
 *     website all the time. `foreignLinks` discounts any URL whose host echoes
 *     the sender's email domain or their name, and a single genuinely foreign
 *     link is weighted *below* the quarantine threshold on purpose.
 *
 *  3. Never detect gibberish by vowel ratio. At any useful threshold it calls
 *     "partnership" (3 vowels / 11 letters) and "projects" (2 / 8) keyboard
 *     mash. `hasConsonantRun` uses runs of 6+ consecutive consonants instead:
 *     English tops out at 5 ("strengths"), real mash is nothing else.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type {
  ConstrainedField,
  SpamAssessment,
  SpamCategory,
  SpamReason,
  SubmissionInput,
} from "@/lib/spam/types";

// ── Thresholds ───────────────────────────────────────────────────────────────
// Tuned so that:
//   • a missing render stamp (3) alone stays BELOW quarantine — a browser on a
//     stale cached bundle right after a deploy must not have its enquiry held;
//   • one genuinely foreign link (3) alone stays BELOW quarantine;
//   • either of those PLUS anything else tips over;
//   • only signals a buyer physically never produces can reach reject on their
//     own (honeypot, tampered select, unsubscribe footer).

export const QUARANTINE_THRESHOLD = 5;
export const REJECT_THRESHOLD = 9;

// ── Vocabulary ───────────────────────────────────────────────────────────────

/**
 * Retail discount boilerplate. Note what is NOT here: any bare price, "$", or
 * the word "cost". This site's customers discuss money constantly.
 *
 * A bare percentage is NOT here either, and that is not an oversight. A real
 * review in the corpus reads:
 *
 *   "Other practitioners offer 35% discount and they choose to make money
 *    over giving patients a discount."
 *
 * That is a patient complaining about pricing — the single most useful kind of
 * review this site collects — and a plain /\d+%\s*(off|discount)/ quarantined
 * it. So a percentage only counts when it is *directed at the reader*: an
 * imperative ("save 40% off"), or shouted in caps the way an ad is. Prose that
 * merely mentions a discount someone else gives passes untouched.
 */
const RETAIL_PROMO_PATTERNS: RegExp[] = [
  // "get 50% off", "save up to 30% discount", "claim 20% off"
  /\b(get|save|claim|enjoy|grab|take|receive|unlock|up\s+to)\s+\d{1,3}\s*%\s*(off|discount)\b/i,
  // "50% OFF" shouted — an ad voice no reviewer writes in.
  /\d{1,3}\s*%\s*OFF\b/,
  // A percentage sitting next to a call to action.
  /\d{1,3}\s*%\s*(off|discount)\b[^.\n]{0,40}\b(today|right\s+now|this\s+week|order|shop|coupon|promo\s+code|limited)\b/i,
  /\bfree\s+(shipping|delivery|trial\s+offer)\b/i,
  /\b(today\s+only|limited[- ]time\s+offer|act\s+now|order\s+now|buy\s+now|shop\s+now|while\s+supplies\s+last|lowest\s+price\s+guarantee)\b/i,
  /\b(discount|promo|coupon)\s+code\b/i,
];

/** Bulk-mail machinery. A person writing to a clinic directory never sends one. */
const BULK_MAIL_PATTERNS: RegExp[] = [
  /\bunsubscribe\b/i,
  /\bopt[- ]out\s+of\s+(these|future)\s+(emails?|messages?)\b/i,
  /\byou\s+(are\s+)?receiv(ing|ed)\s+this\s+(email|message)\s+because\b/i,
  /\bto\s+stop\s+receiving\b/i,
  /\bmanage\s+your\s+(email\s+)?preferences\b/i,
  /\bview\s+this\s+email\s+in\s+your\s+browser\b/i,
  /\bsent\s+(to\s+you\s+)?via\s+\w+\s+mailer\b/i,
];

/**
 * How many DISTINCT patterns in a set fire.
 *
 * Counting distinct patterns rather than total matches is what separates a
 * blast from a person: a genuine message might brush one pattern by accident
 * ("I saw your offer"), but a message that independently trips three of them is
 * machinery. Weighting stacks on the count, never on how often one pattern
 * repeats — otherwise the filter would simply punish long messages, and the
 * longest messages here are the most detailed patient enquiries.
 */
function countDistinct(text: string, patterns: readonly RegExp[]): number {
  return patterns.reduce((n, p) => (p.test(text) ? n + 1 : n), 0);
}

/**
 * Weight for `n` distinct hits: `base` for the first, `+step` for each further
 * one, capped so nothing reaches reject on repetition alone.
 */
function stackedWeight(n: number, base: number, step: number, cap: number): number {
  if (n <= 0) return 0;
  return Math.min(cap, base + (n - 1) * step);
}

/** "Add me to your list" — inbound list-farming. */
const LIST_JOIN =
  /\b(add\s+(me|us)\s+to\s+your\s+(mailing\s+)?list|subscribe\s+(me|us)\s+to\s+your|join\s+your\s+(mailing\s+)?list|sign\s+(me|us)\s+up\s+for\s+your\s+newsletter)\b/i;

/**
 * Off-platform contact handles. Requires the platform name to sit next to a
 * handle or number so "I found you through a WhatsApp group" doesn't score.
 */
const OFF_PLATFORM =
  /\b(whats\s?app|telegram|skype|wechat|viber|signal\s+app)\b[^.\n]{0,24}(?:[:+@]|\bid\b|\bme\b\s+(?:at|on))[^.\n]{0,4}[\w+@]/i;

/**
 * Outbound pitch — someone selling TO us. Every pattern is first-person-offer
 * ("we/I can/offer/provide/help you…") or a bulk call-to-action. The object of
 * the sentence is *our* business, which is what makes it a pitch rather than an
 * enquiry. Topic words (seo, ranking, traffic, leads, design, crypto) appear
 * only as the *thing being offered*, never on their own.
 */
const OUTBOUND_PITCH: Array<[RegExp, string]> = [
  [
    /\b(we|i|our\s+(team|agency|company))\s+(can|could|will|would\s+like\s+to|are\s+able\s+to)\s+(help\s+you|get\s+you|boost|increase|improve|double|triple|grow|drive|rank|redesign|rebuild|revamp|optimi[sz]e)\b/i,
    "opens with an offer to improve our business",
  ],
  [
    /\b(we|i|our\s+(team|agency|company))\s+(offer|provide|specialize\s+in|specialise\s+in|are\s+offering)\b/i,
    "pitches a service they provide",
  ],
  [
    /\b(increase|boost|double|triple|skyrocket|explode)\s+(your|website|site)\s*(website\s+)?(traffic|sales|revenue|ranking|rankings|leads|conversions|visibility)\b/i,
    "promises to increase our traffic, sales, or rankings",
  ],
  [
    /\b(rank(ing)?\s+(you|your\s+(site|website|business))\s+(on|#?1|number\s+one|top)|first\s+page\s+of\s+google\s+(guarantee|in\s+\d+)|guaranteed\s+(ranking|traffic|results|first\s+page))\b/i,
    "guarantees rankings for our site",
  ],
  [
    /\b(reply\s+(with\s+)?(yes|interested|stop)\b|let\s+me\s+know\s+if\s+(you'?re|you\s+are)\s+interested\b|are\s+you\s+interested\s+in\s+(our|a\s+free)\b|interested\?\s*$)/i,
    "bulk-outreach call to action",
  ],
  [
    /\b(free\s+(seo\s+)?(audit|analysis|consultation|quote|sample|proposal)\s+(for\s+(you|your)|of\s+your)|no\s+obligation\s+(quote|proposal|audit))\b/i,
    "offers us a free audit or proposal",
  ],
  [
    /\b(i\s+(was\s+)?(just\s+)?(browsing|visiting|looking\s+at)\s+your\s+(site|website)\s+and\s+(noticed|saw|found))\b/i,
    "classic cold-outreach opener",
  ],
  [
    /\b(hire\s+(me|us)|outsource\s+(your|to\s+us)|our\s+(rates|pricing)\s+start(s)?\s+at|portfolio\s+of\s+our\s+work)\b/i,
    "solicits work from us",
  ],
];

/**
 * Research and regulator domains that never count as foreign links.
 *
 * This site's best enquiries cite studies. A patient who links two PubMed
 * papers and a ClinicalTrials record is the most engaged lead the business
 * gets, and without this list they'd be the most heavily link-scored one.
 */
const CITATION_HOSTS =
  /(^|\.)(pubmed\.ncbi\.nlm\.nih\.gov|ncbi\.nlm\.nih\.gov|nih\.gov|clinicaltrials\.gov|who\.int|fda\.gov|ema\.europa\.eu|cochrane\.org|doi\.org|nature\.com|thelancet\.com|nejm\.org|bmj\.com|sciencedirect\.com|springer\.com|wiley\.com|mayoclinic\.org|clevelandclinic\.org)$/i;

/** Words that make a URL look like tracking/redirect infrastructure. */
const LINK_SHORTENERS =
  /^(bit\.ly|tinyurl\.com|goo\.gl|t\.co|ow\.ly|is\.gd|buff\.ly|cutt\.ly|rebrand\.ly|shorturl\.at|lnkd\.in)$/i;

// ── Small helpers ────────────────────────────────────────────────────────────

/** Collapse the whole submission into one string for content rules. */
function contentOf(input: SubmissionInput): string {
  return [input.subject, input.message, ...(input.extra ?? [])]
    .filter((s): s is string => typeof s === "string" && s.trim() !== "")
    .join("\n");
}

/**
 * A run of 6+ consecutive consonants — the gibberish test that doesn't eat real
 * words. English maxes out at 5 ("strengths", "twelfths"); `y` counts as a vowel
 * here so "rhythms" and "syzygy" survive. See rule 3 in the header.
 */
export function hasConsonantRun(text: string, min = 6): boolean {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const run = new RegExp(`[bcdfghjklmnpqrstvwxz]{${min},}`);
  return words.some((word) => run.test(word));
}

/** RFC-shaped enough: exactly one `@`, a dot in the domain, no whitespace. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value.trim());
}

/** Domain part of an email, lowercased. */
function emailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  return email.slice(at + 1).trim().toLowerCase() || null;
}

/** `www.foo.co.uk` → `foo`. Good enough to compare a host against a name. */
function hostRoot(host: string): string {
  const parts = host.replace(/^www\./i, "").split(".");
  return (parts[0] ?? "").toLowerCase();
}

/** Letters/digits only, for fuzzy "does this host echo their name" checks. */
function alphanumeric(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Every URL host in `text`, bare domains included. */
export function extractHosts(text: string): string[] {
  const hosts: string[] = [];
  const pattern =
    /\b(?:https?:\/\/|www\.)([a-z0-9-]+(?:\.[a-z0-9-]+)+)|\b([a-z0-9-]+\.(?:com|net|org|io|co|biz|info|xyz|online|site|shop|store|top|club|ru|cn|in|uk|de))\b/gi;
  for (const match of text.matchAll(pattern)) {
    const host = (match[1] ?? match[2] ?? "").toLowerCase();
    if (host) hosts.push(host.replace(/^www\./, ""));
  }
  return hosts;
}

export interface ForeignLinkOptions {
  /** Hosts belonging to us — a message templating our own domain is spam. */
  ownHosts: readonly string[];
  /** The sender's email, so links to their own domain are discounted. */
  senderEmail?: string | null;
  /** The sender's name/company, so `acmeclinic.com` from "Acme Clinic" passes. */
  senderName?: string | null;
}

export interface ForeignLinkResult {
  /** Links to somewhere that is neither ours nor plausibly theirs. */
  foreign: string[];
  /** Links to the sender's own site — explicitly NOT scored (rule 2). */
  own: string[];
  /** Our own domain templated into the body. */
  selfReferences: string[];
  /** Foreign links that are URL shorteners / redirect infrastructure. */
  shorteners: string[];
  /** Research/regulator citations — never scored. */
  citations: string[];
}

/**
 * Split the links in a message into "theirs" (never scored), "ours" (a template
 * artefact, scored), and genuinely foreign. See rule 2 in the header: a prospect
 * linking their own website is the single most common false positive there is.
 */
export function foreignLinks(
  text: string,
  opts: ForeignLinkOptions,
): ForeignLinkResult {
  const senderDomain = emailDomain(opts.senderEmail);
  const senderNameKey = alphanumeric(opts.senderName ?? "");
  const own: string[] = [];
  const foreign: string[] = [];
  const selfReferences: string[] = [];
  const shorteners: string[] = [];
  const citations: string[] = [];

  for (const host of new Set(extractHosts(text))) {
    if (opts.ownHosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      selfReferences.push(host);
      continue;
    }

    if (CITATION_HOSTS.test(host)) {
      citations.push(host);
      continue;
    }

    const root = hostRoot(host);
    const isTheirs =
      (senderDomain !== null && (host === senderDomain || root === hostRoot(senderDomain))) ||
      // "Acme Clinic" ↔ acmeclinic.com / acme-clinic.co — either containing the
      // other, so both abbreviations and expansions count as theirs.
      (senderNameKey.length >= 4 &&
        (senderNameKey.includes(alphanumeric(root)) ||
          alphanumeric(root).includes(senderNameKey)));

    if (isTheirs) {
      own.push(host);
      continue;
    }

    foreign.push(host);
    if (LINK_SHORTENERS.test(host)) shorteners.push(host);
  }

  return { foreign, own, selfReferences, shorteners, citations };
}

/** Values a `<select>` cannot emit — the payload was assembled by hand. */
export function tamperedFields(
  fields: readonly ConstrainedField[] | undefined,
): ConstrainedField[] {
  if (!fields) return [];
  return fields.filter((f) => {
    if (f.value === null || f.value === undefined || f.value === "") return false;
    return !f.allowed.includes(f.value);
  });
}

// ── Configuration ────────────────────────────────────────────────────────────

export interface ClassifyOptions {
  /** Hosts we own — used for the self-reference rule and the whitelist. */
  ownHosts: readonly string[];
  /**
   * Email domains that always pass. Our own domains go here so internal test
   * submissions are never held or dropped.
   */
  whitelistDomains: readonly string[];
  /** Submitting faster than this is a stronger signal than a missing stamp. */
  minElapsedMs?: number;
}

const DEFAULT_MIN_ELAPSED_MS = 3000;

// ── The classifier ───────────────────────────────────────────────────────────

/**
 * Score one submission. Pure: same input, same verdict, no clock, no network.
 *
 * Anything the guard already determined (a tripped rate limit, a duplicate
 * payload, a refused captcha) is folded in by the caller via `preReasons` so
 * the whole verdict, including its reasoning, lands in one place.
 */
export function classifySubmission(
  input: SubmissionInput,
  opts: ClassifyOptions,
  preReasons: SpamReason[] = [],
): SpamAssessment {
  const reasons: SpamReason[] = [...preReasons];
  const categories = new Map<SpamCategory, number>();

  const add = (
    code: string,
    detail: string,
    weight: number,
    category: SpamCategory,
  ): void => {
    reasons.push({ code, detail, weight });
    categories.set(category, (categories.get(category) ?? 0) + weight);
  };

  // Pre-reasons arrive already categorised by the guard; re-key them so the
  // dominant-category pick below sees them too.
  for (const r of preReasons) {
    const category = PRE_REASON_CATEGORIES[r.code];
    if (category) categories.set(category, (categories.get(category) ?? 0) + r.weight);
  }

  // ── Whitelist ─────────────────────────────────────────────────────────────
  // Our own people, always. Internal test submissions must always get through,
  // and an operator testing the form should never end up debugging the filter.
  const senderDomain = emailDomain(input.email);
  if (senderDomain && opts.whitelistDomains.some((d) => senderDomain === d || senderDomain.endsWith(`.${d}`))) {
    return { verdict: "allow", score: 0, category: null, reasons: [] };
  }

  const content = contentOf(input);

  // ── Bot signatures ────────────────────────────────────────────────────────

  if (input.honeypot != null && String(input.honeypot).trim() !== "") {
    // No human sees this field. Nothing else needs to be true.
    add(
      "honeypot",
      "Filled in a hidden field that is invisible to a real visitor",
      12,
      "bot-signature",
    );
  }

  if (input.elapsedMs == null) {
    // Deliberately below the quarantine threshold on its own: a browser holding
    // a stale cached bundle right after a deploy sends no stamp, and bouncing
    // that person's enquiry is worse than passing the bot.
    add(
      "no-render-stamp",
      "No form-render timestamp came back (a direct POST, or a stale cached page)",
      3,
      "bot-signature",
    );
  } else if (input.elapsedMs < (opts.minElapsedMs ?? DEFAULT_MIN_ELAPSED_MS)) {
    add(
      "too-fast",
      `Submitted ${(input.elapsedMs / 1000).toFixed(1)}s after the form rendered — faster than a person can fill it in`,
      5,
      "bot-signature",
    );
  }

  // ── Field integrity ───────────────────────────────────────────────────────

  const tampered = tamperedFields(input.constrained);
  for (const field of tampered) {
    add(
      "field-tampering",
      `"${field.field}" holds ${JSON.stringify(field.value)}, which the form cannot produce`,
      7,
      "field-tampering",
    );
  }

  if (input.email != null && input.email.trim() !== "" && !looksLikeEmail(input.email)) {
    add(
      "invalid-email",
      "The email field isn't a valid email address",
      6,
      "field-tampering",
    );
  }

  // ── Content: direction, not topic ─────────────────────────────────────────

  if (content.trim() !== "") {
    const links = foreignLinks(content, {
      ownHosts: opts.ownHosts,
      senderEmail: input.email,
      senderName: [input.name, input.subject].filter(Boolean).join(" "),
    });

    if (links.selfReferences.length) {
      // Where our domain sits changes everything. In a salutation ("Dear
      // mystemcellguide.com owner") it is a mail-merge field and nothing else.
      // Mentioned in passing ("I found mystemcellguide.com really useful") it
      // is a compliment, so that only ever nudges.
      const templated = new RegExp(
        `(\\b(dear|hello|hi|greetings|attention|to)\\b[^\\n]{0,24}(${links.selfReferences.join("|")})|(${links.selfReferences.join("|")})\\s+(owner|team|webmaster|admin|administrator))`,
        "i",
      ).test(content);

      if (templated) {
        add(
          "own-domain-salutation",
          `Addresses us as "${links.selfReferences[0]} owner" — a mail-merge field, not a greeting`,
          9,
          "bulk-mail",
        );
      } else {
        add(
          "own-domain-mention",
          `Our own domain (${links.selfReferences.join(", ")}) appears in the message body`,
          2,
          "bulk-mail",
        );
      }
    }

    // 1 link stays below quarantine (rule 2), 2 can be a diligent researcher,
    // 3+ unrelated domains is a link farm. Research and regulator hosts were
    // already filtered out above and never reach this count.
    const linkCount = links.foreign.length;
    if (linkCount === 1) {
      add(
        "foreign-link",
        `Links to ${links.foreign[0]}, which is neither ours nor their own domain`,
        3,
        "link-spam",
      );
    } else if (linkCount === 2) {
      add(
        "foreign-links",
        `Links to 2 unrelated sites (${links.foreign.join(", ")})`,
        6,
        "link-spam",
      );
    } else if (linkCount >= 3) {
      add(
        "foreign-links",
        `Links to ${linkCount} unrelated sites (${links.foreign.slice(0, 3).join(", ")}…)`,
        10,
        "link-spam",
      );
    }

    if (links.shorteners.length) {
      add(
        "link-shortener",
        `Uses a link shortener (${links.shorteners.join(", ")}) to hide the destination`,
        4,
        "link-spam",
      );
    }

    const retailHits = countDistinct(content, RETAIL_PROMO_PATTERNS);
    if (retailHits) {
      add(
        "retail-promo",
        retailHits === 1
          ? "Contains retail discount boilerplate (percentage off, free shipping, act now)"
          : `Reads like an ad: ${retailHits} separate pieces of retail boilerplate`,
        stackedWeight(retailHits, 5, 2, 11),
        "retail-promo",
      );
    }

    const bulkHits = countDistinct(content, BULK_MAIL_PATTERNS);
    if (bulkHits) {
      add(
        "bulk-mail-footer",
        bulkHits === 1
          ? "Carries bulk-mail footer language — this was blasted to a list"
          : `Carries ${bulkHits} pieces of bulk-mail footer machinery`,
        stackedWeight(bulkHits, 7, 2, 11),
        "bulk-mail",
      );
    }

    if (LIST_JOIN.test(content)) {
      add(
        "list-join",
        "Asks to be added to our mailing list",
        4,
        "bulk-mail",
      );
    }

    if (OFF_PLATFORM.test(content)) {
      add(
        "off-platform-contact",
        "Pushes the conversation to WhatsApp/Telegram/Skype with a handle",
        5,
        "off-platform-contact",
      );
    }

    // A genuine message can brush one cold-outreach pattern by accident. Three
    // independent ones is a sales template, so distinct hits stack.
    const pitchHits = OUTBOUND_PITCH.filter(([p]) => p.test(content));
    if (pitchHits.length) {
      add(
        "outbound-pitch",
        `Selling to us: ${pitchHits.map(([, d]) => d).join("; ")}`,
        stackedWeight(pitchHits.length, 5, 2, 11),
        "outbound-pitch",
      );
    }

    if (hasConsonantRun(content)) {
      add(
        "gibberish",
        "Contains a run of 6+ consecutive consonants — keyboard mash, not a word",
        5,
        "gibberish",
      );
    }
  }

  // Gibberish in the name field alone is worth noting but not much: plenty of
  // real names transliterate oddly, so it only ever tips something else over.
  if (input.name && hasConsonantRun(input.name, 7)) {
    add(
      "gibberish-name",
      "The name field looks like keyboard mash",
      3,
      "gibberish",
    );
  }

  // ── Verdict ───────────────────────────────────────────────────────────────

  const score = reasons.reduce((sum, r) => sum + r.weight, 0);
  reasons.sort((a, b) => b.weight - a.weight);

  let verdict: SpamAssessment["verdict"] = "allow";
  if (score >= REJECT_THRESHOLD) verdict = "reject";
  else if (score >= QUARANTINE_THRESHOLD) verdict = "quarantine";

  let category: SpamCategory | null = null;
  if (verdict !== "allow") {
    category = [...categories.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }

  return { verdict, score, category, reasons };
}

/** Categories for the reasons the guard produces before `classifySubmission`. */
const PRE_REASON_CATEGORIES: Record<string, SpamCategory> = {
  "duplicate-payload": "duplicate",
  "rate-limit-ip": "flood",
  "rate-limit-subnet": "flood",
  "captcha-failed": "captcha-failed",
};
