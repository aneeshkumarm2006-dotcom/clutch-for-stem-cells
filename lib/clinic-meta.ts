/**
 * The meta-tag formula for a clinic's three public URLs — `/clinic/[slug]`,
 * `/clinic/[slug]/reviews` and `/clinic/[slug]/cost`.
 *
 * All three routes read from here rather than composing their own strings, so
 * every clinic in the directory carries the same shape:
 *
 *   profile   title  `<Clinic> | <Condition> Stem Cell Therapy in <City>, <State>`
 *             desc   **<Clinic> is a stem cell clinic in <City>, <State>** treating …
 *             keys   `<clinic>`
 *   reviews   title  `<Clinic> Reviews | <Site name>`
 *             desc   **Patient reviews of <Clinic> in <City>, <State>.** Read …
 *             keys   `<clinic> reviews`
 *   cost      title  `<Clinic> Cost | <Site name>`
 *             desc   **Treatment at <Clinic> in <City>, <State> costs $X to $Y.** See …
 *             keys   `<clinic> cost`, `<clinic> prices`, `how much does <clinic> cost`
 *
 * Titles and descriptions are prose and stay in the taxonomy's own casing.
 * Keywords are the exception: they mirror a typed query, so they are lower case
 * and unpunctuated (see `keywordText`).
 *
 * The bold run is the leading phrase only, emitted as Unicode bold letters by
 * `buildMetadata` (see `boldMetaPrefix` in lib/meta-text.ts) — a meta tag has no
 * markup, so that is the only weight a SERP snippet can carry.
 *
 * Pure and DB-free: everything is derived from an already-loaded clinic, and the
 * input type is structural so a `ClinicProfile` (lib/public-data.ts), a lean
 * `IClinic`, or a plain object from a script all satisfy it.
 */
import { fitMetaTitle } from "@/lib/meta-text";

/** Enough of a clinic location to place it. */
export interface ClinicMetaLocation {
  isHQ?: boolean;
  city?: string;
  /** State/province. Only used where "City, State" is the local convention. */
  region?: string;
  country?: string;
}

/** Enough of a clinic to build its meta tags. */
export interface ClinicMetaInput {
  name: string;
  locations?: ClinicMetaLocation[];
  /** Conditions treated, in the clinic's own priority order. */
  conditions?: { name: string }[];
  /** Headline price range. Only the cost-page formula reads these. */
  priceMin?: number;
  priceMax?: number;
  currency?: string;
}

/**
 * Countries where an address is habitually read as "City, State" rather than
 * "City, Country". Everywhere else the country is the recognizable half —
 * "Cancún, Mexico" places a clinic for a reader that "Cancún, Quintana Roo"
 * does not, and Cayman's `region` is a town name rather than a province at all.
 */
const STATE_FIRST_COUNTRIES = new Set([
  "united states",
  "united states of america",
  "usa",
  "us",
  "canada",
  "australia",
]);

/** How many conditions a description lists before it stops. */
const MAX_LISTED_CONDITIONS = 3;

/** The HQ location, or the first one on file. */
export function clinicHqLocation(
  clinic: ClinicMetaInput,
): ClinicMetaLocation | null {
  const locations = clinic.locations ?? [];
  return locations.find((l) => l?.isHQ) ?? locations[0] ?? null;
}

const clean = (value?: string): string => value?.trim() ?? "";

/**
 * "City, State" in the US/Canada/Australia, "City, Country" elsewhere; the
 * country also stands in when the region just repeats the city (Bangkok,
 * Tokyo). Returns `""` when the clinic has no usable location.
 */
export function clinicPlace(clinic: ClinicMetaInput): string {
  const hq = clinicHqLocation(clinic);
  if (!hq) return "";

  const city = clean(hq.city);
  const region = clean(hq.region);
  const country = clean(hq.country);

  const useRegion =
    Boolean(region) &&
    region.toLowerCase() !== city.toLowerCase() &&
    STATE_FIRST_COUNTRIES.has(country.toLowerCase());

  const second = useRegion ? region : country;
  return [city, second].filter(Boolean).join(", ");
}

/**
 * Taxonomy names are authored as on-page filter labels and carry editorial
 * shorthand a meta tag should not: a slash pairing ("Skin / Aesthetic",
 * "Crohn's / IBD"), a qualifier in parentheses ("Diabetes (supportive)"), and
 * an ampersand ("Back & Spine").
 *
 * The parenthetical is dropped and the pairing collapses to one side of the
 * slash — spelling both out ("Anti-Aging and Longevity") collides with the
 * "and" that joins the list itself. The first side wins, except where it is a
 * lone word and the other side is the fuller phrase: "Erectile / Sexual Health"
 * reads as "sexual health", while "COPD / Pulmonary" stays "COPD".
 *
 * The ampersand is spelled out rather than collapsed, since "back" alone loses
 * the term. `&` is not in ALLOWED_META_PUNCTUATION (lib/meta-text), so leaving
 * it in emits a description `findMetaIssues` rejects.
 */
export function conditionPhrase(name: string): string {
  const base = name
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s*&\s*/g, " and ")
    .trim();
  const parts = base
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return parts[0] ?? "";

  const words = (s: string) => s.split(/\s+/).length;
  return words(parts[0]) === 1 && words(parts[1]) > 1 ? parts[1] : parts[0];
}

/**
 * Fold a Title Case taxonomy label into the sentence case a description reads
 * in: "Knee Osteoarthritis" → "knee osteoarthritis".
 *
 * Two kinds of word keep their capitals — an acronym, marked by an uppercase
 * letter past the first ("COPD", "IBD"), and an eponym, which a possessive
 * apostrophe reliably marks ("Crohn's", "Parkinson's"). A hyphenated compound
 * is judged segment by segment, so "Anti-Aging" folds to "anti-aging" while
 * "Post-COVID" keeps the half that is an acronym: "post-COVID".
 */
function foldWord(word: string): string {
  if (/'s\b/i.test(word)) return word;
  if (word.includes("-")) return word.split("-").map(foldWord).join("-");
  return /[A-Z]/.test(word.slice(1)) ? word : word.toLowerCase();
}

function sentenceCase(phrase: string): string {
  return phrase.split(" ").map(foldWord).join(" ");
}

/**
 * The single condition the profile title leads on — the first one listed. Kept
 * in the taxonomy's own Title Case, which is the convention for a `<title>`.
 */
export function primaryCondition(clinic: ClinicMetaInput): string {
  return conditionPhrase(clinic.conditions?.[0]?.name ?? "");
}

/** "a, b, and c" from the first few conditions treated, in sentence case. */
export function conditionList(
  clinic: ClinicMetaInput,
  max = MAX_LISTED_CONDITIONS,
): string {
  const names = (clinic.conditions ?? [])
    .map((c) => sentenceCase(conditionPhrase(c?.name ?? "")))
    .filter(Boolean)
    .slice(0, max);

  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

// ── Profile page (/clinic/[slug]) ────────────────────────────────────────────

/**
 * `<Clinic> | <Condition> Stem Cell Therapy in <City>, <State>`, shortened until
 * it fits the title-length cap.
 *
 * No brand suffix: the clinic name already opens the title, and the site name
 * on the end would only push the location out of the SERP. Routes pass this
 * with `titleAbsolute` so `buildMetadata` skips the Settings template.
 *
 * The full form runs long for a clinic with a four-word name in a two-word city
 * ("Blatman Health and Wellness Center | Joint Pain Stem Cell Therapy in
 * Cincinnati, Ohio" is 85 characters), so the formula sheds detail in order of
 * what a searcher can most afford to lose:
 *
 *   1. the state, which the city already implies for anyone searching it;
 *   2. the condition, which the profile ranks for through its `<h1>` and body
 *      copy rather than through the title alone;
 *   3. the city;
 *   4. everything but the brand, which is the query the profile must win.
 *
 * The condition outranks the state deliberately: "Stem Cell Therapy in
 * Broomfield, Colorado" and "Knee Osteoarthritis Stem Cell Therapy in
 * Broomfield" cost the same characters, and the second names what the clinic
 * treats.
 */
export function clinicMetaTitle(clinic: ClinicMetaInput): string {
  const condition = primaryCondition(clinic);
  const place = clinicPlace(clinic);
  // "Broomfield, Colorado" → "Broomfield". The city alone is the half a reader
  // recognizes; the state is what `clinicPlace` adds for disambiguation.
  const city = place.split(",")[0]?.trim() ?? "";
  // A separator immediately after a full stop is redundant punctuation, so
  // `normalizeMetaText` drops it — which would swallow the pipe entirely for a
  // clinic whose name ends in one ("Stemedix, Inc."). Trim the trailing stop and
  // keep the separator, which is the half that carries structure in a SERP.
  const name = clinic.name.replace(/\.+$/, "");

  const subject = (withCondition: boolean) =>
    [withCondition ? condition : "", "Stem Cell Therapy"]
      .filter(Boolean)
      .join(" ");
  const titled = (right: string) => (right ? `${name} | ${right}` : name);
  const at = (subj: string, where: string) =>
    where ? `${subj} in ${where}` : subj;

  return fitMetaTitle([
    titled(at(subject(true), place)),
    titled(at(subject(true), city)),
    titled(at(subject(false), place)),
    titled(at(subject(false), city)),
    titled(at("Stem Cell Clinic", city)),
    titled("Stem Cell Clinic"),
    name,
  ]);
}

/** The bold lead of the profile description. Also its opening clause. */
export function clinicMetaBoldPrefix(clinic: ClinicMetaInput): string {
  const place = clinicPlace(clinic);
  return place
    ? `${clinic.name} is a stem cell clinic in ${place}`
    : `${clinic.name} is a stem cell clinic`;
}

/** `<Clinic> is a stem cell clinic in <City>, <State> treating A, B, and C.` */
export function clinicMetaDescription(clinic: ClinicMetaInput): string {
  const conditions = conditionList(clinic);
  const lead = clinicMetaBoldPrefix(clinic);
  return conditions ? `${lead} treating ${conditions}.` : `${lead}.`;
}

/**
 * Fold a label into the form a keyword is actually typed in: lower case, no
 * punctuation, no hyphen.
 *
 * A search box gets "centeno schultz clinic", not "Centeno-Schultz Clinic", and
 * nobody types a legal suffix, so "Stemedix, Inc." reduces to "stemedix". The
 * hyphen matters most: it splits a token, so "Centeno-Schultz" and "Anti-Aging"
 * only match a query that punctuates the same way.
 */
export function keywordText(value: string): string {
  return value
    .replace(/,?\s+(inc|llc|ltd|co|corp|corporation|pllc|pc)\.?$/i, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The brand on its own, as it would be typed. */
export function clinicKeywords(clinic: ClinicMetaInput): string[] {
  return [keywordText(clinic.name)];
}

// ── Reviews page (/clinic/[slug]/reviews) ────────────────────────────────────

/**
 * `<Clinic> Reviews` — the brand suffix is left to the Settings title template,
 * which is what makes this render as "<Clinic> Reviews | My Stem Cell Guide".
 */
export function clinicReviewsMetaTitle(clinic: ClinicMetaInput): string {
  return `${clinic.name} Reviews`;
}

/** The bold lead of the reviews description — a full sentence, unlike the profile's. */
export function clinicReviewsMetaBoldPrefix(clinic: ClinicMetaInput): string {
  const place = clinicPlace(clinic);
  return place
    ? `Patient reviews of ${clinic.name} in ${place}.`
    : `Patient reviews of ${clinic.name}.`;
}

/**
 * Deliberately fixed copy — it does not quote the review count or average
 * rating. Those change on every new review, and a description that drifts out
 * of sync with a cached SERP snippet is worse than one that never claims a
 * number.
 */
export function clinicReviewsMetaDescription(clinic: ClinicMetaInput): string {
  return `${clinicReviewsMetaBoldPrefix(clinic)} Read first-hand reports on treatment, communication, facility, and value for money before you book.`;
}

/** The brand plus "reviews", as it would be typed. */
export function clinicReviewsKeywords(clinic: ClinicMetaInput): string[] {
  return [`${keywordText(clinic.name)} reviews`];
}

// ── Cost page (/clinic/[slug]/cost) ──────────────────────────────────────────

/**
 * `<Clinic> Cost` — brand suffix left to the Settings title template, exactly
 * like the reviews title.
 *
 * "Cost" rather than "pricing" or "prices": it is the word the query is typed
 * with ("<clinic> cost", "how much does <clinic> cost", "stem cell therapy
 * cost"), and it keeps the last path segment equal to the query the way
 * `/reviews` does. The plural and the "pricing" variant are carried in the
 * keywords instead, where they cost nothing.
 */
export function clinicCostMetaTitle(clinic: ClinicMetaInput): string {
  return `${clinic.name} Cost`;
}

/**
 * The headline range as a description reads it: "$5,000 to $15,000", "from
 * $5,900", or `""` when the clinic publishes no figure at all.
 *
 * `Intl` is asked for whole units — a meta description quoting "$5,000.00"
 * wastes characters on a decimal nobody typed.
 */
function priceClause(clinic: ClinicMetaInput): string {
  const currency = clinic.currency || "USD";
  const money = (amount: number) => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      // An unknown/misspelled currency code throws rather than degrading.
      return `${amount} ${currency}`;
    }
  };

  const { priceMin: min, priceMax: max } = clinic;
  if (min != null && max != null && max > min)
    return `${money(min)} to ${money(max)}`;
  if (min != null) return `from ${money(min)}`;
  if (max != null) return `up to ${money(max)}`;
  return "";
}

/**
 * The bold lead of the cost description — a full sentence, like the reviews
 * one. Quotes the range when the clinic has one on file and names the subject
 * plainly when it does not, so the snippet never implies a published price list
 * that isn't there.
 */
export function clinicCostMetaBoldPrefix(clinic: ClinicMetaInput): string {
  const place = clinicPlace(clinic);
  const at = place
    ? `${clinic.name} in ${place}`
    : clinic.name;
  const price = priceClause(clinic);
  return price
    ? `Treatment at ${at} costs ${price}.`
    : `Treatment costs at ${at}.`;
}

/**
 * Unlike the reviews description, this one *does* quote a number — the price
 * range is the answer to the query, and a cost snippet without one is worth
 * little. The trade-off is accepted deliberately: `priceMin`/`priceMax` are
 * editorial fields that change on a records review, not on every new review the
 * way a rating average does, so the drift risk that kept numbers out of the
 * reviews description does not apply here.
 */
export function clinicCostMetaDescription(clinic: ClinicMetaInput): string {
  const lead = clinicCostMetaBoldPrefix(clinic);
  const tail = priceClause(clinic)
    ? "See the price list, what a quote covers, and the insurance and financing position."
    : "See how the clinic quotes a price, what it covers, and the insurance and financing position.";
  return `${lead} ${tail}`;
}

/**
 * Three phrasings of the same intent. The plural ("prices") and the long-form
 * question are how the query is typed about half the time, and unlike a title
 * a keywords list has room for all three.
 */
export function clinicCostKeywords(clinic: ClinicMetaInput): string[] {
  const brand = keywordText(clinic.name);
  return [`${brand} cost`, `${brand} prices`, `how much does ${brand} cost`];
}
