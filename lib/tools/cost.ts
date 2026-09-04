/**
 * Money maths for the cost, travel and surgery-comparison tools.
 *
 * The distinction that runs through this file: figures a *clinic published* and
 * figures we *assumed*. The first kind arrives at runtime from the directory
 * (`lib/tools/price-data.ts` aggregates published clinic prices) and is the only
 * thing the cost calculator treats as evidence. The second kind is the
 * multipliers and reference tables below, which are stated assumptions, exported
 * so the pages can show them rather than hide them behind a total.
 *
 * That is also the honest answer to why a cost calculator on a directory is not
 * a lead magnet dressed as a utility: the numbers come out of the same records
 * a visitor can click through and check.
 *
 * Pure and dependency-free, so the calculators can import it client-side.
 */
import { clamp, round } from "@/lib/tools/calc";

/** A low / typical / high price window, plus how many clinics produced it. */
export interface PriceBand {
  low: number;
  typical: number;
  high: number;
  /** Published clinics behind the band. 0 means the band is a fallback. */
  sampleSize: number;
}

/**
 * Round a money figure to a width that reads like a quote, not a measurement.
 *
 * Negatives floor at zero, which is right for every line item here: a negative
 * airfare or accommodation cost is a bug, not a discount, and silently rounding
 * one into the total would hide it. A figure that is legitimately signed, such
 * as a difference between two prices, goes through {@link roundSignedMoney}.
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 20000) return Math.round(value / 500) * 500;
  if (value >= 2000) return Math.round(value / 100) * 100;
  if (value >= 200) return Math.round(value / 10) * 10;
  return Math.round(value);
}

/** {@link roundMoney} on the magnitude, with the sign put back. */
export function roundSignedMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? -roundMoney(-value) : roundMoney(value);
}

export function scaleBand(band: PriceBand, factor: number): PriceBand {
  return {
    low: roundMoney(band.low * factor),
    typical: roundMoney(band.typical * factor),
    high: roundMoney(band.high * factor),
    sampleSize: band.sampleSize,
  };
}

// ── Treatment cost estimate ─────────────────────────────────────────────────

/**
 * What each additional treated area adds, as a share of the first area.
 *
 * Not 100%: the consultation, the harvest or the vial preparation, and the
 * theatre time are paid once whether one knee is injected or both. Clinics that
 * publish per-area pricing tend to land near two thirds for the second area, and
 * the effect flattens after that.
 */
export const ADDITIONAL_AREA_SHARE = 0.65;

/**
 * What each repeat session adds. Higher than the per-area share because a second
 * session repeats most of the process, but under 1 because the workup is done.
 */
export const ADDITIONAL_SESSION_SHARE = 0.8;

export interface CostEstimateInput {
  /** Price window for the chosen treatment, from live directory data. */
  base: PriceBand;
  /** Joints or areas treated in the same course. */
  areas: number;
  /** Sessions in the course, including the first. */
  sessions: number;
  /**
   * Destination adjustment, as a ratio of that country's median clinic price to
   * the global median. 1 means "no destination selected".
   */
  countryFactor: number;
}

export interface CostEstimateResult {
  band: PriceBand;
  areaFactor: number;
  sessionFactor: number;
  countryFactor: number;
  /** Every multiplier applied, for the "how this was worked out" list. */
  steps: { label: string; factor: number }[];
}

export function estimateTreatmentCost(
  input: CostEstimateInput,
): CostEstimateResult {
  const areas = clamp(Math.round(input.areas), 1, 6);
  const sessions = clamp(Math.round(input.sessions), 1, 6);
  const countryFactor = clamp(input.countryFactor, 0.2, 4);

  const areaFactor = round(1 + ADDITIONAL_AREA_SHARE * (areas - 1), 2);
  const sessionFactor = round(1 + ADDITIONAL_SESSION_SHARE * (sessions - 1), 2);

  const total = areaFactor * sessionFactor * countryFactor;

  const steps = [
    {
      label: `${areas} area${areas > 1 ? "s" : ""} treated`,
      factor: areaFactor,
    },
    {
      label: `${sessions} session${sessions > 1 ? "s" : ""} in the course`,
      factor: sessionFactor,
    },
    { label: "Destination pricing", factor: round(countryFactor, 2) },
  ].filter((s) => s.factor !== 1);

  return {
    band: scaleBand(input.base, total),
    areaFactor,
    sessionFactor,
    countryFactor: round(countryFactor, 2),
    steps,
  };
}

// ── Medical travel ──────────────────────────────────────────────────────────

export interface TravelCostInput {
  /** What the clinic itself will charge. Prefilled from the cost calculator. */
  treatmentCost: number;
  travellers: number;
  /** Return airfare per traveller. */
  flightPerPerson: number;
  nights: number;
  nightlyRate: number;
  /** Food, local transport and everything else, per person per day. */
  dailySpendPerPerson: number;
  /** Visas, insurance, imaging or bloodwork asked for before travel. */
  upfrontExtras: number;
  /** Follow-up trips budgeted after the first. */
  followUpTrips: number;
  /** Share of the subtotal held back for the things that go wrong, 0 to 0.5. */
  contingencyRate: number;
}

export interface TravelCostLine {
  key: string;
  label: string;
  amount: number;
  /** How the amount was reached, shown next to it. */
  detail: string;
}

export interface TravelCostResult {
  lines: TravelCostLine[];
  subtotal: number;
  contingency: number;
  total: number;
  /** Everything that is not the treatment itself. */
  nonTreatmentTotal: number;
  /** Non-treatment cost as a share of the total, 0 to 100. */
  overheadPercent: number;
}

/**
 * Total cost of treating abroad, itemised.
 *
 * The number worth reading is not the total, it is `overheadPercent`. A cheaper
 * quote in a further country routinely loses to a nearer one once two people fly
 * for two weeks, and that comparison is invisible until the travel is priced
 * alongside the treatment.
 *
 * A follow-up trip is costed as flights plus a third of the original stay, which
 * is what a review visit usually looks like: same airfare, far fewer nights.
 */
export function estimateTravelCost(input: TravelCostInput): TravelCostResult {
  const travellers = clamp(Math.round(input.travellers), 1, 6);
  const nights = clamp(Math.round(input.nights), 0, 180);
  const followUpTrips = clamp(Math.round(input.followUpTrips), 0, 6);
  const contingencyRate = clamp(input.contingencyRate, 0, 0.5);

  const treatment = Math.max(0, input.treatmentCost);
  const flights = Math.max(0, input.flightPerPerson) * travellers;
  const stay = Math.max(0, input.nightlyRate) * nights;
  const daily =
    Math.max(0, input.dailySpendPerPerson) * travellers * Math.max(nights, 1);
  const extras = Math.max(0, input.upfrontExtras);
  const followUps = followUpTrips * (flights + stay / 3);

  const lines: TravelCostLine[] = [
    {
      key: "treatment",
      label: "Treatment",
      amount: roundMoney(treatment),
      detail: "Quoted by the clinic",
    },
    {
      key: "flights",
      label: "Flights",
      amount: roundMoney(flights),
      detail: `${travellers} traveller${travellers > 1 ? "s" : ""}, return`,
    },
    {
      key: "stay",
      label: "Accommodation",
      amount: roundMoney(stay),
      detail: `${nights} night${nights === 1 ? "" : "s"}`,
    },
    {
      key: "daily",
      label: "Food and local transport",
      amount: roundMoney(daily),
      detail: `${travellers} person${travellers > 1 ? "s" : ""} per day`,
    },
    {
      key: "extras",
      label: "Visas, insurance and pre-travel tests",
      amount: roundMoney(extras),
      detail: "One off",
    },
    {
      key: "follow-ups",
      label: "Follow-up trips",
      amount: roundMoney(followUps),
      detail: followUpTrips
        ? `${followUpTrips} return trip${followUpTrips > 1 ? "s" : ""}`
        : "None budgeted",
    },
  ].filter((line) => line.amount > 0);

  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const contingency = roundMoney(subtotal * contingencyRate);
  const total = subtotal + contingency;
  const nonTreatmentTotal = total - roundMoney(treatment);

  return {
    lines,
    subtotal,
    contingency,
    total,
    nonTreatmentTotal,
    overheadPercent:
      total > 0 ? round((nonTreatmentTotal / total) * 100, 0) : 0,
  };
}

// ── Surgery comparison ──────────────────────────────────────────────────────

export interface SurgeryReference {
  key: string;
  label: string;
  /** Condition slug in the directory, for the "see clinics" link. */
  conditionSlug?: string;
  /** Indicative United States self-pay range, in USD. */
  costLow: number;
  costHigh: number;
  /** Weeks to a normal day, not weeks to full athletic recovery. */
  recoveryWeeksLow: number;
  recoveryWeeksHigh: number;
  /** What the range does and does not cover. */
  note: string;
}

/**
 * Reference surgery costs and recovery windows.
 *
 * These are indicative United States self-pay figures, and the spread inside
 * each range is real: hospital list prices for the same procedure vary several
 * fold between facilities in the same city, and an insured patient's own outlay
 * has almost nothing to do with the list price. The pages present them as an
 * order-of-magnitude comparison and say to get a written quote, because that is
 * all a figure like this can honestly support.
 *
 * Editable in one place on purpose: when a better source lands, it lands here.
 */
export const SURGERY_REFERENCES: SurgeryReference[] = [
  {
    key: "knee-replacement",
    label: "Total knee replacement",
    conditionSlug: "knee-osteoarthritis",
    costLow: 30000,
    costHigh: 50000,
    recoveryWeeksLow: 12,
    recoveryWeeksHigh: 52,
    note: "Surgeon, implant, facility and the inpatient stay. Physiotherapy is usually billed on top.",
  },
  {
    key: "hip-replacement",
    label: "Total hip replacement",
    conditionSlug: "hip-osteoarthritis",
    costLow: 30000,
    costHigh: 55000,
    recoveryWeeksLow: 10,
    recoveryWeeksHigh: 26,
    note: "Similar structure to a knee replacement, with a shorter typical rehabilitation.",
  },
  {
    key: "rotator-cuff",
    label: "Rotator cuff repair",
    conditionSlug: "shoulder-injuries",
    costLow: 10000,
    costHigh: 25000,
    recoveryWeeksLow: 16,
    recoveryWeeksHigh: 26,
    note: "Arthroscopic repair. A sling for several weeks and months of physiotherapy are the norm.",
  },
  {
    key: "spinal-fusion",
    label: "Lumbar spinal fusion",
    conditionSlug: "back-pain",
    costLow: 60000,
    costHigh: 110000,
    recoveryWeeksLow: 24,
    recoveryWeeksHigh: 52,
    note: "One of the widest price spreads in orthopaedics. Hardware and levels fused drive most of it.",
  },
  {
    key: "acl",
    label: "ACL reconstruction",
    conditionSlug: "sports-injuries",
    costLow: 20000,
    costHigh: 40000,
    recoveryWeeksLow: 26,
    recoveryWeeksHigh: 52,
    note: "Return to pivoting sport sits at the top of that window, not the bottom.",
  },
  {
    key: "knee-arthroscopy",
    label: "Knee arthroscopy",
    conditionSlug: "knee-osteoarthritis",
    costLow: 8000,
    costHigh: 15000,
    recoveryWeeksLow: 4,
    recoveryWeeksHigh: 8,
    note: "Day case. Evidence for arthroscopy in degenerative knee disease is contested.",
  },
];

export function surgeryReference(key: string): SurgeryReference | undefined {
  return SURGERY_REFERENCES.find((s) => s.key === key);
}

export interface SurgeryComparisonResult {
  surgery: SurgeryReference;
  regenerative: PriceBand;
  /** Positive means the regenerative course is cheaper at typical prices. */
  typicalDifference: number;
  /** Regenerative typical as a share of the surgery midpoint, 0 to 100+. */
  relativePercent: number;
  surgeryMidpoint: number;
  /** True when the regenerative range overlaps the surgery range. */
  overlaps: boolean;
}

export function compareWithSurgery(
  surgery: SurgeryReference,
  regenerative: PriceBand,
): SurgeryComparisonResult {
  const surgeryMidpoint = roundMoney((surgery.costLow + surgery.costHigh) / 2);
  return {
    surgery,
    regenerative,
    // Signed: a regenerative course dearer than the surgery midpoint has to
    // come back negative, not floored to zero by the line-item rounding.
    typicalDifference: roundSignedMoney(surgeryMidpoint - regenerative.typical),
    relativePercent:
      surgeryMidpoint > 0
        ? round((regenerative.typical / surgeryMidpoint) * 100, 0)
        : 0,
    surgeryMidpoint,
    overlaps:
      regenerative.high >= surgery.costLow &&
      regenerative.low <= surgery.costHigh,
  };
}

// ── Candidacy ───────────────────────────────────────────────────────────────

/**
 * A candidacy answer's effect on the read.
 *
 * `blocker` is not a heavier weight, it is a different kind of answer. Active
 * cancer or an active infection is not "points against" a course of treatment,
 * it is a reason a responsible clinic will decline to treat now, and a scoring
 * model that let a strong profile average one of those away would be giving
 * dangerous advice politely. So blockers short-circuit the result.
 */
export type CandidacyEffect = "positive" | "neutral" | "negative" | "blocker";

export interface CandidacyAnswer {
  value: string;
  label: string;
  effect: CandidacyEffect;
  /** Points toward the score, ignored for blockers. */
  points: number;
  /** Shown in the result when this answer is chosen. */
  note?: string;
}

export interface CandidacyQuestion {
  id: string;
  question: string;
  hint?: string;
  answers: CandidacyAnswer[];
}

export type CandidacyVerdict =
  "blocked" | "unlikely" | "possible" | "reasonable" | "strong";

export interface CandidacyResult {
  verdict: CandidacyVerdict;
  label: string;
  summary: string;
  /** 0 to 100 across the non-blocking questions. */
  score: number;
  answered: number;
  total: number;
  /** Blocking answers the visitor selected. */
  blockers: { question: string; note: string }[];
  /** Notes attached to negative answers, as things to raise with a clinic. */
  flags: string[];
  /** Notes attached to positive answers. */
  strengths: string[];
}

const VERDICTS: Record<CandidacyVerdict, { label: string; summary: string }> = {
  blocked: {
    label: "Not right now",
    summary:
      "At least one of your answers is something clinics screen for before treating. Speak to your own doctor about it before you approach a clinic.",
  },
  unlikely: {
    label: "Unlikely to be a good fit",
    summary:
      "Your answers point away from cell therapy as the next step. That is worth knowing early, and a specialist opinion on the alternatives is the better use of the next appointment.",
  },
  possible: {
    label: "Possible, with questions to settle",
    summary:
      "There is a case here, but enough sits in the grey area that the answer depends on your imaging and history. Take the flagged points to a consultation.",
  },
  reasonable: {
    label: "Reasonable candidate",
    summary:
      "Your answers line up with the profile clinics usually accept. A consultation, with imaging, is the sensible next step.",
  },
  strong: {
    label: "Strong candidate profile",
    summary:
      "Your answers match what clinics look for. That is not the same as a treatment being proven for your condition, so read the evidence page alongside this.",
  },
};

/**
 * Score a candidacy questionnaire.
 *
 * Unanswered questions are excluded from the denominator, so the verdict firms
 * up as the form is filled rather than starting at zero and climbing.
 */
export function scoreCandidacy(
  questions: CandidacyQuestion[],
  answers: Record<string, string | undefined>,
): CandidacyResult {
  const blockers: { question: string; note: string }[] = [];
  const flags: string[] = [];
  const strengths: string[] = [];

  let points = 0;
  let maxPoints = 0;
  let answered = 0;

  for (const q of questions) {
    const chosen = q.answers.find((a) => a.value === answers[q.id]);
    if (!chosen) continue;
    answered += 1;

    if (chosen.effect === "blocker") {
      blockers.push({
        question: q.question,
        note: chosen.note ?? chosen.label,
      });
      continue;
    }

    const best = Math.max(
      ...q.answers.filter((a) => a.effect !== "blocker").map((a) => a.points),
    );
    points += chosen.points;
    maxPoints += best;

    if (chosen.note) {
      if (chosen.effect === "negative") flags.push(chosen.note);
      if (chosen.effect === "positive") strengths.push(chosen.note);
    }
  }

  const score = maxPoints > 0 ? round((points / maxPoints) * 100, 0) : 0;

  const verdict: CandidacyVerdict = blockers.length
    ? "blocked"
    : score >= 80
      ? "strong"
      : score >= 60
        ? "reasonable"
        : score >= 40
          ? "possible"
          : "unlikely";

  return {
    verdict,
    label: VERDICTS[verdict].label,
    summary: VERDICTS[verdict].summary,
    score,
    answered,
    total: questions.length,
    blockers,
    flags,
    strengths,
  };
}
