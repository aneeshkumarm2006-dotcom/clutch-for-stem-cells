/**
 * Shared types for the public-form spam classifier.
 *
 * Kept separate from `classify.ts` so route handlers, the admin UI, the backfill
 * script, and the Mongoose models can all import the vocabulary without pulling
 * in the rule engine.
 */

/** What the guard decided to do with a submission. */
export type SpamVerdict =
  /** Stored, notified, in the normal inbox. */
  | "allow"
  /** Stored and categorised, **not** emailed, behind the Spam view. */
  | "quarantine"
  /** Never written to the main collection — copied to the blocked bin instead. */
  | "reject";

/**
 * Why a submission was flagged. Deliberately describes the *shape* of the
 * message, not its topic — an operator reading "seo-outreach" should understand
 * "someone pitched us", never "someone mentioned SEO".
 */
export type SpamCategory =
  /** Unsolicited pitch: they are selling to us. */
  | "outbound-pitch"
  /** Link farming — foreign URLs dropped into the body. */
  | "link-spam"
  /** Retail discount boilerplate: "50% OFF", "free shipping", "today only". */
  | "retail-promo"
  /** Pushing the conversation to WhatsApp / Telegram / Skype. */
  | "off-platform-contact"
  /** Bulk-mail machinery: unsubscribe footers, list-join requests. */
  | "bulk-mail"
  /** Keyboard mash. */
  | "gibberish"
  /** Honeypot filled, no render stamp, or submitted implausibly fast. */
  | "bot-signature"
  /** A value the form itself cannot emit — the payload was hand-built. */
  | "field-tampering"
  /** Same human-written payload already seen in the last 24h. */
  | "duplicate"
  /** Too many submissions from one address or its network neighbourhood. */
  | "flood"
  /** Captcha token missing or refused by the provider. */
  | "captcha-failed";

/** One rule that fired, in language an operator can act on. */
export interface SpamReason {
  /** Stable id for tests and for grouping in the admin. */
  code: string;
  /** Plain-English explanation shown on the flagged row. */
  detail: string;
  /** How much this pushed the score. */
  weight: number;
}

export interface SpamAssessment {
  verdict: SpamVerdict;
  /** Total weight. Thresholds live in `classify.ts`. */
  score: number;
  /** Dominant category, or `null` when the verdict is `allow`. */
  category: SpamCategory | null;
  /** Every rule that fired, heaviest first. */
  reasons: SpamReason[];
}

/**
 * A `<select>`/radio field plus the values the rendered form can actually
 * produce. Anything else means the payload was assembled by hand.
 */
export interface ConstrainedField {
  field: string;
  value: string | null | undefined;
  allowed: readonly string[];
}

/**
 * The normalised view of a submission the classifier scores. Route handlers map
 * their own payload shape onto this so one rule set covers every form.
 */
export interface SubmissionInput {
  /** Which public form this came from (for reporting, not for scoring). */
  form: "lead" | "review" | "report";

  name?: string | null;
  email?: string | null;
  phone?: string | null;
  /** The main free-text field: lead message, review body, report details. */
  message?: string | null;
  /** Secondary free text: review headline, etc. */
  subject?: string | null;
  /** Any further free-text fields to fold into content scoring. */
  extra?: Array<string | null | undefined>;

  /** Constrained fields to check for values the form can't emit. */
  constrained?: ConstrainedField[];

  /** Hidden field a human never sees. Non-empty means a bot filled it. */
  honeypot?: string | null;

  /**
   * Milliseconds between the form rendering and the submit landing.
   * `undefined`/`null` means no stamp came back at all (a direct POST — or a
   * browser running a stale cached bundle right after a deploy, which is why
   * this alone never reaches the quarantine threshold).
   */
  elapsedMs?: number | null;

  /** Set by the guard when the 24h payload hash was already seen. */
  duplicateOf?: string | null;
}
