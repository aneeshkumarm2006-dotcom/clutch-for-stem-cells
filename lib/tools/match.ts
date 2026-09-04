/**
 * Clinic matching — the scoring behind `/tools/clinic-match-quiz` and the
 * "clinics in this range" list under the cost calculator.
 *
 * Pure and dependency-free, like the rest of `lib/tools`, because the widgets
 * that call it are client components. The database side lives in
 * `lib/tools/match-data.ts`, which is `server-only`; this file is the arithmetic
 * over the index that file produces, and it is what the tests exercise.
 *
 * Three decisions worth stating, because they are the difference between a
 * matcher and a placement engine:
 *
 *  1. **Tier is not an input.** A clinic's plan, featured flag or sort score
 *     never touches the ranking here. A tool that says "these three clinics fit
 *     what you described" and quietly sorts by who paid is selling ad inventory
 *     while wearing the clothes of a recommendation, and on a page about medical
 *     treatment that is worse than useless. Fit first, then rating, then review
 *     count, then name for a stable order.
 *  2. **Every result shows its working.** A match carries the criteria it met
 *     and the criteria it missed, so the visitor can see that the third
 *     suggestion is there because nothing better matched rather than because it
 *     is a good fit. `reasons` and `misses` are not decoration; they are the
 *     reason the list can be trusted.
 *  3. **Score is normalised over what was asked.** Somebody who names only a
 *     condition is not penalised for leaving budget blank. Unasked criteria drop
 *     out of the denominator instead of scoring zero.
 */

/** One clinic, flattened to what matching and the result card need. */
export interface MatchClinic {
  slug: string;
  name: string;
  /** Pre-formatted "City, Country" for the card. */
  location?: string;
  logoUrl?: string;
  badge?: string | null;
  verified: boolean;
  ratingAvg: number;
  reviewCount: number;
  /** Condition labels for the card's chips. */
  chips: string[];
  focusLabel?: string;
  /** Condition slugs the clinic treats. */
  conditions: string[];
  /** Treatment slugs the clinic offers. */
  treatments: string[];
  /** Country names, as stored on the clinic's locations. */
  countries: string[];
  /** Slugified country names, for matching a directory filter value. */
  countrySlugs: string[];
  priceMin: number | null;
  priceMax: number | null;
  currency?: string;
  priceModel?: string;
}

/** A selectable option with the number of clinics behind it. */
export interface MatchOption {
  slug: string;
  name: string;
  count: number;
}

/** Everything a matching widget needs, computed once on the server. */
export interface ClinicMatchIndex {
  clinics: MatchClinic[];
  conditions: MatchOption[];
  treatments: MatchOption[];
  countries: MatchOption[];
  /** The currency budget comparisons are meaningful in. */
  currency: string;
  /** Published clinics in the index. */
  clinicCount: number;
}

export interface MatchQuery {
  /** Condition slug. */
  condition?: string;
  /** Treatment slug. */
  treatment?: string;
  /** Country slug. */
  country?: string;
  /** Upper end of the visitor's budget, in the index currency. */
  budgetMax?: number;
  /** Lower end, where they gave a band rather than a ceiling. */
  budgetMin?: number;
}

/** Which criteria a query actually asked about. */
export type MatchCriterion = "condition" | "treatment" | "country" | "budget";

/**
 * Weights, in the order somebody researching treatment actually cares about.
 *
 * Condition leads because a clinic that does not treat your condition is not a
 * near miss, it is the wrong clinic. Treatment and destination are real
 * constraints but both are things people revise once they see prices. Budget
 * scores lowest of the four because a published range is an opening figure, not
 * a quote, and ranking it above clinical fit would recommend the cheapest clinic
 * for a condition it does not treat.
 */
export const MATCH_WEIGHTS: Record<MatchCriterion, number> = {
  condition: 40,
  treatment: 25,
  country: 20,
  budget: 15,
};

/** Credit given when a clinic's price range sits just outside the budget. */
export const NEAR_BUDGET_CREDIT = 0.5;

/** How far above a budget ceiling still counts as close to your range. */
export const NEAR_BUDGET_TOLERANCE = 0.2;

export interface MatchReason {
  criterion: MatchCriterion;
  /** Card fragment, e.g. "Treats knee osteoarthritis". */
  label: string;
}

export interface ClinicMatch {
  clinic: MatchClinic;
  /** 0 to 100, over the criteria the query asked about. */
  score: number;
  /** Criteria the clinic met. */
  reasons: MatchReason[];
  /** Criteria it did not meet, stated rather than hidden. */
  misses: MatchReason[];
  /** True when it met every criterion the query asked about. */
  exact: boolean;
}

export interface MatchOutcome {
  results: ClinicMatch[];
  /** Clinics meeting every asked criterion, before the result limit. */
  exactCount: number;
  /** Clinics scoring above zero, before the limit. */
  candidateCount: number;
  /** Criteria the query asked about. */
  asked: MatchCriterion[];
  /** True when the list had to include partial matches to fill up. */
  relaxed: boolean;
}

/** Criteria a query actually constrains. */
export function askedCriteria(query: MatchQuery): MatchCriterion[] {
  const asked: MatchCriterion[] = [];
  if (query.condition) asked.push("condition");
  if (query.treatment) asked.push("treatment");
  if (query.country) asked.push("country");
  if (query.budgetMax && query.budgetMax > 0) asked.push("budget");
  return asked;
}

/**
 * How well a clinic's published price sits against a budget, 0 to 1.
 *
 * A clinic publishing nothing, or publishing in another currency, returns
 * `null` rather than 0. "We do not know what this costs" and "this costs more
 * than you said" are different answers, and collapsing the first into the second
 * would push every clinic that has not filled in a price field to the bottom of
 * a list it might belong at the top of.
 */
export function budgetFit(
  clinic: MatchClinic,
  currency: string,
  budgetMax: number,
  budgetMin = 0,
): number | null {
  if (clinic.currency && clinic.currency !== currency) return null;
  const low = clinic.priceMin && clinic.priceMin > 0 ? clinic.priceMin : null;
  const high = clinic.priceMax && clinic.priceMax > 0 ? clinic.priceMax : null;
  if (low === null && high === null) return null;

  const clinicLow = low ?? high!;
  const clinicHigh = high ?? low!;
  const floor = budgetMin > 0 ? budgetMin : 0;

  // Any overlap between the two ranges is a fit: a clinic quoting 4,000 to
  // 12,000 can treat somebody with 10,000 to spend.
  if (clinicLow <= budgetMax && clinicHigh >= floor) return 1;
  // Above the ceiling, but close enough that a real quote could land inside it.
  if (clinicLow <= budgetMax * (1 + NEAR_BUDGET_TOLERANCE)) {
    return NEAR_BUDGET_CREDIT;
  }
  // Below a floor the visitor set. Not a miss worth punishing hard: a clinic
  // cheaper than expected is information, not a mismatch.
  if (clinicHigh < floor) return NEAR_BUDGET_CREDIT;
  return 0;
}

function optionName(options: MatchOption[], slug: string): string {
  return options.find((o) => o.slug === slug)?.name ?? slug;
}

/** The parts of the index scoring needs, so callers can pass a narrower object. */
export type MatchLookups = Pick<
  ClinicMatchIndex,
  "conditions" | "treatments" | "countries" | "currency"
>;

/**
 * Score one clinic against a query.
 *
 * Returns `null` when the query asked for nothing, which is the caller's cue to
 * show the directory rather than a ranked list.
 */
export function scoreClinic(
  clinic: MatchClinic,
  query: MatchQuery,
  index: MatchLookups,
): ClinicMatch | null {
  const asked = askedCriteria(query);
  if (!asked.length) return null;

  const reasons: MatchReason[] = [];
  const misses: MatchReason[] = [];
  let earned = 0;
  let possible = 0;

  if (query.condition) {
    const name = optionName(index.conditions, query.condition);
    possible += MATCH_WEIGHTS.condition;
    if (clinic.conditions.includes(query.condition)) {
      earned += MATCH_WEIGHTS.condition;
      reasons.push({
        criterion: "condition",
        label: `Treats ${name.toLowerCase()}`,
      });
    } else {
      misses.push({
        criterion: "condition",
        label: `Does not list ${name.toLowerCase()}`,
      });
    }
  }

  if (query.treatment) {
    const name = optionName(index.treatments, query.treatment);
    possible += MATCH_WEIGHTS.treatment;
    if (clinic.treatments.includes(query.treatment)) {
      earned += MATCH_WEIGHTS.treatment;
      reasons.push({
        criterion: "treatment",
        label: `Offers ${name.toLowerCase()}`,
      });
    } else {
      misses.push({
        criterion: "treatment",
        label: `Does not list ${name.toLowerCase()}`,
      });
    }
  }

  if (query.country) {
    const name = optionName(index.countries, query.country);
    possible += MATCH_WEIGHTS.country;
    if (clinic.countrySlugs.includes(query.country)) {
      earned += MATCH_WEIGHTS.country;
      reasons.push({ criterion: "country", label: `Based in ${name}` });
    } else {
      misses.push({ criterion: "country", label: `Not in ${name}` });
    }
  }

  if (query.budgetMax && query.budgetMax > 0) {
    const fit = budgetFit(
      clinic,
      index.currency,
      query.budgetMax,
      query.budgetMin ?? 0,
    );
    if (fit === null) {
      // Unpriced clinics are scored on the criteria they can answer, so budget
      // leaves the denominator rather than counting against them.
      misses.push({
        criterion: "budget",
        label: "No published price to check",
      });
    } else {
      possible += MATCH_WEIGHTS.budget;
      earned += MATCH_WEIGHTS.budget * fit;
      if (fit >= 1) {
        reasons.push({
          criterion: "budget",
          label: "Published price fits your budget",
        });
      } else if (fit > 0) {
        reasons.push({
          criterion: "budget",
          label: "Published price is close to your budget",
        });
      } else {
        misses.push({
          criterion: "budget",
          label: "Published price is above your budget",
        });
      }
    }
  }

  const score = possible > 0 ? Math.round((earned / possible) * 100) : 0;

  return {
    clinic,
    score,
    reasons,
    misses,
    exact: misses.length === 0 && reasons.length === asked.length,
  };
}

/**
 * Rank clinics against a query and take the best `limit`.
 *
 * Clinics matching nothing are dropped rather than listed at the bottom: three
 * suggestions that all miss on every count are not a shortlist, they are noise,
 * and an empty state that says so sends the visitor to the directory with their
 * filters intact instead.
 */
export function matchClinics(
  index: ClinicMatchIndex,
  query: MatchQuery,
  limit = 3,
): MatchOutcome {
  const asked = askedCriteria(query);
  if (!asked.length) {
    return {
      results: [],
      exactCount: 0,
      candidateCount: 0,
      asked,
      relaxed: false,
    };
  }

  const scored: ClinicMatch[] = [];
  for (const clinic of index.clinics) {
    const match = scoreClinic(clinic, query, index);
    if (match && match.score > 0) scored.push(match);
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      // Two clinics can both score 100 while one of them left a criterion
      // unanswerable: an unpriced clinic drops budget from its denominator
      // rather than failing it. The one that actually answered everything goes
      // first, because "fits your budget" beats "we could not check" for
      // somebody who just told us their budget.
      a.misses.length - b.misses.length ||
      b.clinic.ratingAvg - a.clinic.ratingAvg ||
      b.clinic.reviewCount - a.clinic.reviewCount ||
      a.clinic.name.localeCompare(b.clinic.name),
  );

  const exactCount = scored.filter((m) => m.exact).length;
  const results = scored.slice(0, Math.max(1, limit));

  return {
    results,
    exactCount,
    candidateCount: scored.length,
    asked,
    relaxed: exactCount < results.length,
  };
}

/**
 * The directory URL carrying a query's filters, so "see all matches" lands on
 * the same set rather than on an unfiltered list.
 *
 * Country goes across as the display name, because that is what the directory's
 * single `country` param matches on.
 */
export function directoryHref(
  query: MatchQuery,
  index: Pick<ClinicMatchIndex, "countries">,
): string {
  const sp = new URLSearchParams();
  if (query.condition) sp.set("condition", query.condition);
  if (query.treatment) sp.set("treatment", query.treatment);
  if (query.country) {
    const name = index.countries.find((c) => c.slug === query.country)?.name;
    if (name) sp.set("country", name);
  }
  if (query.budgetMin && query.budgetMin > 0) {
    sp.set("priceMin", String(Math.round(query.budgetMin)));
  }
  if (query.budgetMax && query.budgetMax > 0) {
    sp.set("priceMax", String(Math.round(query.budgetMax)));
  }
  const qs = sp.toString();
  return qs ? `/clinics?${qs}` : "/clinics";
}

/** What the index should be when the database is unreachable at build time. */
export function emptyMatchIndex(currency: string): ClinicMatchIndex {
  return {
    clinics: [],
    conditions: [],
    treatments: [],
    countries: [],
    currency,
    clinicCount: 0,
  };
}
