/**
 * Calculator maths — behavioural tests.
 *
 * The formulas are the part of `/tools` that can be wrong silently. A layout bug
 * is visible; a transposed coefficient in Mifflin-St Jeor produces a
 * confident-looking number that is simply not the answer, on a page whose entire
 * value is being right. So the published equations are asserted against values
 * computed by hand from the papers they come from, and the composite functions
 * are asserted on the behaviours the pages depend on.
 *
 * Run: npx tsx --tsconfig tsconfig.test.json --test tests/tools/calc.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BMI_BANDS,
  calcBmi,
  calcBmr,
  calcBmrHarrisBenedict,
  calcBodyFat,
  calcBodyFatDeurenberg,
  calcBodyFatNavy,
  calcIdealWeight,
  calcTdee,
  calcWaterIntake,
  clamp,
  feetInchesToCm,
  kgToLb,
  kneeLoadFromExcessKg,
  lbToKg,
  normaliseScore,
  round,
  scoreQuestionnaire,
} from "@/lib/tools/calc";
import {
  ADDITIONAL_AREA_SHARE,
  SURGERY_REFERENCES,
  compareWithSurgery,
  estimateTravelCost,
  estimateTreatmentCost,
  roundMoney,
  roundSignedMoney,
  scoreCandidacy,
  type CandidacyQuestion,
} from "@/lib/tools/cost";
import {
  bandFromPoints,
  countryFactor,
  percentile,
  pickBaseBand,
  type PriceSlice,
} from "@/lib/tools/price-band";
import {
  BACK_QUESTIONNAIRE,
  HIP_QUESTIONNAIRE,
  KNEE_QUESTIONNAIRE,
  domainsFor,
  itemIdsFor,
} from "@/lib/tools/questionnaires";
import { CANDIDACY_QUESTIONS } from "@/lib/tools/candidacy";
import {
  MATCH_WEIGHTS,
  askedCriteria,
  budgetFit,
  directoryHref,
  matchClinics,
  scoreClinic,
  type ClinicMatchIndex,
  type MatchClinic,
} from "@/lib/tools/match";
import {
  COMPARISON_FOCUSES,
  COMPARISON_OPTIONS,
  comparisonRows,
  comparisonSpread,
} from "@/lib/tools/comparison";

// ── Units ───────────────────────────────────────────────────────────────────

test("unit conversions round-trip", () => {
  assert.equal(round(feetInchesToCm(5, 10), 1), 177.8);
  assert.equal(round(feetInchesToCm(6, 0), 1), 182.9);
  assert.equal(round(lbToKg(kgToLb(80)), 6), 80);
  assert.equal(round(kgToLb(100), 1), 220.5);
});

test("clamp guards non-finite input rather than propagating NaN", () => {
  assert.equal(clamp(Number.NaN, 10, 20), 10);
  assert.equal(clamp(Infinity, 10, 20), 10);
  assert.equal(clamp(15, 10, 20), 15);
  assert.equal(clamp(99, 10, 20), 20);
});

// ── BMI ─────────────────────────────────────────────────────────────────────

test("BMI matches the published formula and bands", () => {
  // 78 / 1.75^2 = 25.469…
  const result = calcBmi(78, 175);
  assert.equal(result.bmi, 25.5);
  assert.equal(result.band.key, "overweight");

  // Band edges are the WHO cut-points, and a boundary value belongs to the band
  // above it: a BMI of exactly 25 is overweight, not healthy.
  assert.equal(calcBmi(74, 175).band.key, "healthy");
  assert.equal(calcBmi(30.6 * 1.75 * 1.75, 175).band.key, "obese-1");
  assert.equal(calcBmi(40, 175).band.key, "underweight");
  assert.equal(BMI_BANDS.at(-1)!.max, Infinity);

  // The band follows the *displayed* figure, not the unrounded one. 76.5 kg at
  // 175 cm is 24.98, which shows as 25.0, so it is banded as overweight. The
  // alternative prints "25.0, healthy weight" and looks like a bug.
  const boundary = calcBmi(76.5, 175);
  assert.equal(boundary.bmi, 25);
  assert.equal(boundary.band.key, "overweight");
});

test("BMI healthy range and distance to it", () => {
  const result = calcBmi(90, 180);
  // 18.5 and 24.9 against 1.8^2 = 3.24
  assert.equal(result.healthyRangeKg.min, 59.9);
  assert.equal(result.healthyRangeKg.max, 80.7);
  assert.equal(result.kgToHealthy, 9.3);

  // Inside the band reports zero rather than a negative distance.
  assert.equal(calcBmi(70, 180).kgToHealthy, 0);
  // Under the band measures up to the lower edge, not down from the upper one.
  assert.equal(calcBmi(55, 180).kgToHealthy, 4.9);
});

test("knee load scales excess weight by the gait multiplier", () => {
  assert.deepEqual(kneeLoadFromExcessKg(10), { min: 30, max: 40 });
  // Nobody is owed negative load for being under the healthy range.
  assert.deepEqual(kneeLoadFromExcessKg(-5), { min: 0, max: 0 });
});

// ── Energy ──────────────────────────────────────────────────────────────────

test("Mifflin-St Jeor matches the published equation", () => {
  // 10(80) + 6.25(180) - 5(30) + 5 = 1780
  assert.equal(
    calcBmr({ weightKg: 80, heightCm: 180, age: 30, sex: "male" }),
    1780,
  );
  // Same body, female constant: 1925 - 161 = 1614
  assert.equal(
    calcBmr({ weightKg: 80, heightCm: 180, age: 30, sex: "female" }),
    1614,
  );
});

test("Harris-Benedict is computed independently of Mifflin", () => {
  const input = { weightKg: 80, heightCm: 180, age: 30, sex: "male" as const };
  // 88.362 + 13.397(80) + 4.799(180) - 5.677(30) = 1853.63…
  assert.equal(calcBmrHarrisBenedict(input), 1854);
  assert.notEqual(calcBmrHarrisBenedict(input), calcBmr(input));
});

test("TDEE applies the activity factor and derives targets from it", () => {
  const result = calcTdee(
    { weightKg: 80, heightCm: 180, age: 30, sex: "male" },
    "sedentary",
  );
  assert.equal(result.bmr, 1780);
  assert.equal(result.tdee, 2136); // 1780 x 1.2

  const maintain = result.targets.find((t) => t.key === "maintain")!;
  const steadyLoss = result.targets.find((t) => t.key === "lose")!;
  assert.equal(maintain.kcal, 2136);
  assert.equal(steadyLoss.kcal, 1636);

  // Higher activity must never produce a lower maintenance figure.
  const active = calcTdee(
    { weightKg: 80, heightCm: 180, age: 30, sex: "male" },
    "very-active",
  );
  assert.ok(active.tdee > result.tdee);
});

// ── Body composition ────────────────────────────────────────────────────────

test("Navy body fat rises with waist and rejects impossible measurements", () => {
  const base = {
    sex: "male" as const,
    heightCm: 180,
    neckCm: 38,
    waistCm: 90,
  };
  const lean = calcBodyFatNavy(base)!;
  const heavier = calcBodyFatNavy({ ...base, waistCm: 105 })!;

  assert.ok(lean > 0 && lean < 40, `expected a plausible value, got ${lean}`);
  assert.ok(heavier > lean);

  // Waist at or below neck has no logarithm and must not return a number.
  assert.equal(calcBodyFatNavy({ ...base, waistCm: 38 }), null);
  // Women need the hip measurement; without it the sum cannot be formed.
  assert.equal(
    calcBodyFatNavy({ sex: "female", heightCm: 165, neckCm: 32, waistCm: 75 }),
    null,
  );
});

test("Deurenberg matches its published coefficients", () => {
  // 1.2(25) + 0.23(40) - 10.8(1) - 5.4 = 23.0
  assert.equal(calcBodyFatDeurenberg(25, 40, "male"), 23);
  // Female drops the sex term: 30 + 9.2 - 5.4 = 33.8
  assert.equal(calcBodyFatDeurenberg(25, 40, "female"), 33.8);
});

test("body fat falls back to the BMI estimate and says so", () => {
  const withTape = calcBodyFat({
    sex: "male",
    age: 40,
    weightKg: 85,
    heightCm: 180,
    neckCm: 38,
    waistCm: 92,
  });
  assert.equal(withTape.method, "navy");

  const withoutTape = calcBodyFat({
    sex: "male",
    age: 40,
    weightKg: 85,
    heightCm: 180,
  });
  assert.equal(withoutTape.method, "bmi");

  // Fat and lean mass must account for the whole body, whichever method ran.
  assert.equal(round(withTape.fatMassKg + withTape.leanMassKg, 1), 85);
});

test("ideal weight formulas and the healthy range", () => {
  const result = calcIdealWeight(180, "male");
  const devine = result.formulas.find((f) => f.key === "devine")!;
  // 50 + 2.3 x (70.866 - 60) = 74.99
  assert.equal(devine.kg, 75);

  // The four disagree, which is the point the page makes about them.
  const values = result.formulas.map((f) => f.kg);
  assert.ok(Math.max(...values) - Math.min(...values) > 3);

  assert.equal(result.healthyBmiRangeKg.min, 59.9);
  assert.equal(result.healthyBmiRangeKg.max, 80.7);

  // Below five feet the "inches over 60" term must not go negative.
  const short = calcIdealWeight(140, "female");
  assert.ok(short.formulas.every((f) => f.kg > 0));
});

test("water intake splits total between drink and food", () => {
  const result = calcWaterIntake({
    weightKg: 70,
    activityMinutes: 0,
    climate: "temperate",
  });
  assert.equal(result.totalMl, 2450); // 70 x 35
  assert.equal(result.fromFoodMl, 490); // 20%
  assert.equal(result.drinkMl, 1960);
  assert.equal(result.glasses, 8);

  // Activity and climate both increase the requirement.
  const hot = calcWaterIntake({
    weightKg: 70,
    activityMinutes: 60,
    climate: "hot",
  });
  assert.ok(hot.totalMl > result.totalMl);
  // The breakdown drops zero rows rather than printing "Climate: 0 ml".
  assert.equal(result.breakdown.length, 1);
  assert.equal(hot.breakdown.length, 3);
});

// ── Questionnaires ──────────────────────────────────────────────────────────

test("normaliseScore guards a zero denominator", () => {
  assert.equal(normaliseScore(0, 0), 0);
  assert.equal(normaliseScore(24, 96), 25);
});

test("the knee questionnaire has the structure it claims", () => {
  const ids = itemIdsFor(KNEE_QUESTIONNAIRE);
  assert.equal(ids.length, 24);
  assert.equal(new Set(ids).size, 24, "item ids must be unique");
  assert.equal(KNEE_QUESTIONNAIRE.scale.length, 5);
  assert.deepEqual(
    KNEE_QUESTIONNAIRE.domains.map((d) => d.items.length),
    [5, 2, 17],
  );
});

test("scoring excludes unanswered items from the denominator", () => {
  const domains = domainsFor(KNEE_QUESTIONNAIRE);
  const maxPerItem = KNEE_QUESTIONNAIRE.scale.length - 1;

  // One item, answered "extreme". A partial form must not read as a healthy
  // knee just because 23 items are blank.
  const partial = scoreQuestionnaire({
    domains,
    answers: { p1: 4 },
    maxPerItem,
    bands: KNEE_QUESTIONNAIRE.bands,
  });
  assert.equal(partial.answered, 1);
  assert.equal(partial.total, 24);
  assert.equal(partial.score, 100);

  // Every item at the worst value scores 100; every item at 0 scores 0.
  const allAnswers = Object.fromEntries(
    itemIdsFor(KNEE_QUESTIONNAIRE).map((id) => [id, 4]),
  );
  const worst = scoreQuestionnaire({
    domains,
    answers: allAnswers,
    maxPerItem,
    bands: KNEE_QUESTIONNAIRE.bands,
  });
  assert.equal(worst.score, 100);
  assert.equal(worst.raw, 96);
  assert.equal(worst.band.key, "extreme");

  const none = scoreQuestionnaire({
    domains,
    answers: Object.fromEntries(
      itemIdsFor(KNEE_QUESTIONNAIRE).map((id) => [id, 0]),
    ),
    maxPerItem,
    bands: KNEE_QUESTIONNAIRE.bands,
  });
  assert.equal(none.score, 0);
  assert.equal(none.band.key, "minimal");
});

test("the back questionnaire scores ten sections as a percentage", () => {
  const domains = domainsFor(BACK_QUESTIONNAIRE);
  const answers = Object.fromEntries(
    BACK_QUESTIONNAIRE.domains[0]!.items.map((i) => [i.id, 3]),
  );
  const result = scoreQuestionnaire({
    domains,
    answers,
    maxPerItem: 5,
    bands: BACK_QUESTIONNAIRE.bands,
  });
  assert.equal(result.raw, 30);
  assert.equal(result.rawMax, 50);
  assert.equal(result.score, 60);
  assert.equal(result.band.key, "severe");
});

test("every band set covers the whole 0 to 100 axis", () => {
  for (const def of [KNEE_QUESTIONNAIRE, HIP_QUESTIONNAIRE, BACK_QUESTIONNAIRE]) {
    assert.equal(def.bands[0]!.min, 0);
    assert.equal(def.bands.at(-1)!.max, 100);
    for (let i = 1; i < def.bands.length; i += 1) {
      const gap = def.bands[i]!.min - def.bands[i - 1]!.max;
      assert.ok(gap > 0 && gap < 1, "bands must abut without overlapping");
    }
  }
});

// ── Money ───────────────────────────────────────────────────────────────────

test("roundMoney widens the rounding step with the amount", () => {
  assert.equal(roundMoney(24_380), 24_500);
  assert.equal(roundMoney(8_437), 8_400);
  assert.equal(roundMoney(432), 430);
  assert.equal(roundMoney(37), 37);
  // A negative line item is a bug, so it floors rather than rounding.
  assert.equal(roundMoney(-5), 0);
  assert.equal(roundMoney(-24_380), 0);
});

test("roundSignedMoney keeps the sign a difference needs", () => {
  assert.equal(roundSignedMoney(24_380), 24_500);
  assert.equal(roundSignedMoney(-24_380), -24_500);
  assert.equal(roundSignedMoney(0), 0);
  assert.equal(roundSignedMoney(Number.NaN), 0);
});

test("cost estimate applies area and session multipliers", () => {
  const base = { low: 8000, typical: 10000, high: 14000, sampleSize: 12 };

  const single = estimateTreatmentCost({
    base,
    areas: 1,
    sessions: 1,
    countryFactor: 1,
  });
  assert.equal(single.band.typical, 10000);
  assert.equal(single.steps.length, 0, "no multiplier means no working shown");

  // A second area costs two thirds of the first, not a second full price.
  const twoAreas = estimateTreatmentCost({
    base,
    areas: 2,
    sessions: 1,
    countryFactor: 1,
  });
  assert.equal(twoAreas.areaFactor, 1 + ADDITIONAL_AREA_SHARE);
  assert.ok(twoAreas.band.typical < single.band.typical * 2);
  assert.ok(twoAreas.band.typical > single.band.typical);

  // Multipliers compound, and the band stays ordered.
  const compound = estimateTreatmentCost({
    base,
    areas: 2,
    sessions: 2,
    countryFactor: 0.6,
  });
  assert.equal(compound.steps.length, 3);
  assert.ok(compound.band.low <= compound.band.typical);
  assert.ok(compound.band.typical <= compound.band.high);

  // Out-of-range input is clamped rather than producing absurd totals.
  const clamped = estimateTreatmentCost({
    base,
    areas: 99,
    sessions: 99,
    countryFactor: 100,
  });
  assert.ok(Number.isFinite(clamped.band.typical));
  assert.equal(clamped.countryFactor, 4);
});

test("travel cost reports the non-treatment share", () => {
  const result = estimateTravelCost({
    treatmentCost: 10_000,
    travellers: 2,
    flightPerPerson: 1_000,
    nights: 10,
    nightlyRate: 100,
    dailySpendPerPerson: 50,
    upfrontExtras: 0,
    followUpTrips: 0,
    contingencyRate: 0,
  });

  // 10000 + 2000 + 1000 + 1000 = 14000
  assert.equal(result.total, 14_000);
  assert.equal(result.nonTreatmentTotal, 4_000);
  assert.equal(result.overheadPercent, 29);

  // Contingency is added on top of the subtotal, not carved out of it.
  const withBuffer = estimateTravelCost({
    treatmentCost: 10_000,
    travellers: 2,
    flightPerPerson: 1_000,
    nights: 10,
    nightlyRate: 100,
    dailySpendPerPerson: 50,
    upfrontExtras: 0,
    followUpTrips: 0,
    contingencyRate: 0.1,
  });
  assert.equal(withBuffer.contingency, 1_400);
  assert.equal(withBuffer.total, 15_400);

  // Zero-value lines are dropped rather than printed as empty rows.
  assert.ok(!result.lines.some((l) => l.amount === 0));
  assert.ok(!result.lines.some((l) => l.key === "follow-ups"));
});

test("surgery comparison reports direction and overlap", () => {
  const surgery = SURGERY_REFERENCES.find((s) => s.key === "knee-replacement")!;

  const cheaper = compareWithSurgery(surgery, {
    low: 6_000,
    typical: 9_000,
    high: 14_000,
    sampleSize: 10,
  });
  assert.ok(cheaper.typicalDifference > 0, "positive means cheaper");
  assert.equal(cheaper.overlaps, false);

  // Surgery midpoint here is 40,000. A regenerative course above that is dearer
  // at typical prices, and the two ranges still overlap.
  const overlapping = compareWithSurgery(surgery, {
    low: 42_000,
    typical: 48_000,
    high: 60_000,
    sampleSize: 10,
  });
  assert.equal(overlapping.surgeryMidpoint, 40_000);
  assert.equal(overlapping.overlaps, true);
  assert.ok(overlapping.typicalDifference < 0, "negative means dearer");
});

test("every surgery reference is internally consistent", () => {
  for (const s of SURGERY_REFERENCES) {
    assert.ok(s.costLow < s.costHigh, `${s.key} cost range is inverted`);
    assert.ok(
      s.recoveryWeeksLow <= s.recoveryWeeksHigh,
      `${s.key} recovery range is inverted`,
    );
    assert.ok(s.note.length > 0);
  }
});

// ── Price aggregation ───────────────────────────────────────────────────────

test("percentile interpolates between neighbours", () => {
  assert.equal(percentile([], 0.5), 0);
  assert.equal(percentile([7], 0.5), 7);
  assert.equal(percentile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(percentile([10, 20], 0.25), 12.5);
});

test("price bands stay ordered on small or lopsided samples", () => {
  const single = bandFromPoints([{ low: 10_000, high: 20_000, mid: 15_000 }]);
  assert.deepEqual(single, {
    low: 10_000,
    typical: 15_000,
    high: 20_000,
    sampleSize: 1,
  });

  // Three percentiles taken from three different arrays can cross on an odd
  // sample. The band must still read low <= typical <= high.
  const lopsided = bandFromPoints([
    { low: 30_000, high: 31_000, mid: 30_500 },
    { low: 1_000, high: 40_000, mid: 20_500 },
    { low: 2_000, high: 3_000, mid: 2_500 },
  ]);
  assert.ok(lopsided.low <= lopsided.typical);
  assert.ok(lopsided.typical <= lopsided.high);
  assert.equal(lopsided.sampleSize, 3);

  // No points is an empty band, not a fabricated one.
  assert.deepEqual(bandFromPoints([]), {
    low: 0,
    typical: 0,
    high: 0,
    sampleSize: 0,
  });
});

test("country factor is neutral without data", () => {
  const overall = { low: 8_000, typical: 12_000, high: 18_000, sampleSize: 40 };
  assert.equal(countryFactor(undefined, overall), 1);
  assert.equal(
    countryFactor({ low: 0, typical: 0, high: 0, sampleSize: 0 }, overall),
    1,
  );
  assert.equal(
    countryFactor(
      { low: 4_000, typical: 6_000, high: 9_000, sampleSize: 5 },
      overall,
    ),
    0.5,
  );
});

// ── Candidacy ───────────────────────────────────────────────────────────────

test("a blocker overrides an otherwise strong profile", () => {
  // Answer everything with the best available option, then flip one question to
  // its blocking answer. The verdict must change, not merely soften.
  const best: Record<string, string> = {};
  for (const q of CANDIDACY_QUESTIONS) {
    const top = [...q.answers]
      .filter((a) => a.effect !== "blocker")
      .sort((a, b) => b.points - a.points)[0]!;
    best[q.id] = top.value;
  }

  const strong = scoreCandidacy(CANDIDACY_QUESTIONS, best);
  assert.equal(strong.verdict, "strong");
  assert.equal(strong.score, 100);
  assert.equal(strong.blockers.length, 0);

  const blocked = scoreCandidacy(CANDIDACY_QUESTIONS, {
    ...best,
    cancer: "active",
  });
  assert.equal(blocked.verdict, "blocked");
  assert.equal(blocked.blockers.length, 1);
});

test("candidacy scores only what has been answered", () => {
  const partial = scoreCandidacy(CANDIDACY_QUESTIONS, { area: "joint" });
  assert.equal(partial.answered, 1);
  assert.equal(partial.total, CANDIDACY_QUESTIONS.length);
  assert.equal(partial.score, 100);
  assert.equal(partial.strengths.length, 1);

  // Nothing answered is not a verdict of "unlikely" built on zero evidence,
  // it is a zero score the page renders as its empty state.
  const none = scoreCandidacy(CANDIDACY_QUESTIONS, {});
  assert.equal(none.answered, 0);
  assert.equal(none.score, 0);
});

test("weak answers surface as flags to raise at a consultation", () => {
  const result = scoreCandidacy(CANDIDACY_QUESTIONS, {
    expectations: "regrow",
    smoking: "yes",
  });
  assert.equal(result.flags.length, 2);
  assert.ok(result.flags.every((f) => f.length > 0));
  assert.equal(result.verdict, "unlikely");
});

test("every candidacy question is answerable and scorable", () => {
  const seen = new Set<string>();
  for (const q of CANDIDACY_QUESTIONS as CandidacyQuestion[]) {
    assert.ok(!seen.has(q.id), `duplicate question id ${q.id}`);
    seen.add(q.id);
    assert.ok(q.answers.length >= 2, `${q.id} needs a choice`);

    const scorable = q.answers.filter((a) => a.effect !== "blocker");
    assert.ok(
      scorable.length >= 1,
      `${q.id} has no non-blocking answer, so it can never be scored`,
    );
    const values = new Set(q.answers.map((a) => a.value));
    assert.equal(values.size, q.answers.length, `${q.id} has duplicate values`);
  }
});

// ── Hip questionnaire ───────────────────────────────────────────────────────

test("the hip questionnaire is its own item set, not the knee one relabelled", () => {
  const ids = itemIdsFor(HIP_QUESTIONNAIRE);
  assert.equal(ids.length, 25);
  assert.equal(new Set(ids).size, 25, "item ids must be unique");
  assert.equal(HIP_QUESTIONNAIRE.scale.length, 5);
  assert.deepEqual(
    HIP_QUESTIONNAIRE.domains.map((d) => d.items.length),
    [6, 2, 17],
  );

  // The two sets share a scale and a structure but not their wording. If this
  // ever fails, somebody has copied the knee list across and the hip page is
  // asking about stairs where it should be asking about socks and car seats.
  const kneeLabels = new Set(
    KNEE_QUESTIONNAIRE.domains.flatMap((d) => d.items.map((i) => i.label)),
  );
  const hipOnly = HIP_QUESTIONNAIRE.domains
    .flatMap((d) => d.items.map((i) => i.label))
    .filter((label) => !kneeLabels.has(label));
  assert.ok(
    hipOnly.length >= 6,
    `hip set has only ${hipOnly.length} items the knee set does not`,
  );
});

// ── Base band selection ─────────────────────────────────────────────────────

const slice = (
  slug: string,
  typical: number,
  sampleSize: number,
  ownData: boolean,
): PriceSlice => ({
  slug,
  name: slug,
  band: {
    low: typical * 0.8,
    typical,
    high: typical * 1.2,
    sampleSize,
  },
  ownData,
});

test("treatment beats condition as the base band, and both beat nothing", () => {
  const overall = { low: 8_000, typical: 12_000, high: 18_000, sampleSize: 40 };

  // Both have their own data: the treatment band wins, because clinics price a
  // procedure rather than a diagnosis.
  const both = pickBaseBand({
    treatment: slice("msc", 9_000, 12, true),
    condition: slice("knee", 15_000, 20, true),
    overall,
  })!;
  assert.equal(both.source, "treatment");
  assert.equal(both.band.typical, 9_000);

  // Treatment fell back to the global band, condition did not: use condition.
  const conditionWins = pickBaseBand({
    treatment: slice("rare", 12_000, 1, false),
    condition: slice("knee", 15_000, 20, true),
    overall,
  })!;
  assert.equal(conditionWins.source, "condition");
  assert.equal(conditionWins.ownData, true);

  // Neither stands alone: keep the named slice so the page can name the thing
  // the visitor actually chose when it explains the fallback.
  const fellBack = pickBaseBand({
    treatment: slice("rare", 12_000, 1, false),
    overall,
  })!;
  assert.equal(fellBack.source, "treatment");
  assert.equal(fellBack.ownData, false);

  // Nothing selected at all falls through to the all-clinics band.
  const nothing = pickBaseBand({ overall })!;
  assert.equal(nothing.source, "overall");

  // An empty directory produces no band rather than a zeroed one dressed up as
  // an estimate.
  assert.equal(
    pickBaseBand({ overall: { low: 0, typical: 0, high: 0, sampleSize: 0 } }),
    null,
  );
});

// ── Clinic matching ─────────────────────────────────────────────────────────

const clinic = (
  over: Partial<MatchClinic> & { slug: string },
): MatchClinic => ({
  name: over.slug,
  verified: false,
  ratingAvg: 0,
  reviewCount: 0,
  chips: [],
  conditions: [],
  treatments: [],
  countries: [],
  countrySlugs: [],
  priceMin: null,
  priceMax: null,
  currency: "USD",
  ...over,
});

const INDEX: ClinicMatchIndex = {
  clinics: [
    clinic({
      slug: "full-match",
      name: "Full Match",
      conditions: ["knee-osteoarthritis"],
      treatments: ["msc-therapy"],
      countries: ["Mexico"],
      countrySlugs: ["mexico"],
      priceMin: 6_000,
      priceMax: 9_000,
      ratingAvg: 4.2,
      reviewCount: 10,
    }),
    clinic({
      slug: "wrong-country",
      name: "Wrong Country",
      conditions: ["knee-osteoarthritis"],
      treatments: ["msc-therapy"],
      countries: ["Panama"],
      countrySlugs: ["panama"],
      priceMin: 7_000,
      priceMax: 8_000,
    }),
    clinic({
      slug: "unpriced",
      name: "Unpriced",
      conditions: ["knee-osteoarthritis"],
      treatments: ["msc-therapy"],
      countries: ["Mexico"],
      countrySlugs: ["mexico"],
    }),
    clinic({
      slug: "unrelated",
      name: "Unrelated",
      conditions: ["hair-restoration"],
      treatments: ["prp"],
      countries: ["South Korea"],
      countrySlugs: ["south-korea"],
    }),
  ],
  conditions: [
    { slug: "knee-osteoarthritis", name: "Knee osteoarthritis", count: 3 },
    { slug: "hair-restoration", name: "Hair restoration", count: 1 },
  ],
  treatments: [
    { slug: "msc-therapy", name: "MSC therapy", count: 3 },
    { slug: "prp", name: "PRP", count: 1 },
  ],
  countries: [
    { slug: "mexico", name: "Mexico", count: 2 },
    { slug: "panama", name: "Panama", count: 1 },
    { slug: "south-korea", name: "South Korea", count: 1 },
  ],
  currency: "USD",
  clinicCount: 4,
};

test("only answered questions count toward the match denominator", () => {
  assert.deepEqual(askedCriteria({}), []);
  assert.deepEqual(askedCriteria({ condition: "knee-osteoarthritis" }), [
    "condition",
  ]);
  // A budget of zero is "not answered", not "a ceiling of nothing".
  assert.deepEqual(askedCriteria({ budgetMax: 0 }), []);

  // One criterion answered and met is a full score, not 40 out of 100.
  const onlyCondition = scoreClinic(
    INDEX.clinics[0]!,
    { condition: "knee-osteoarthritis" },
    INDEX,
  )!;
  assert.equal(onlyCondition.score, 100);
  assert.equal(onlyCondition.exact, true);
});

test("an unpriced clinic is not punished for a budget it cannot answer", () => {
  const query = { condition: "knee-osteoarthritis", budgetMax: 8_000 };

  const priced = scoreClinic(INDEX.clinics[0]!, query, INDEX)!;
  assert.equal(priced.score, 100);

  // The unpriced clinic answers the condition and drops budget from the
  // denominator, so it still scores 100 while stating what it could not check.
  const unpriced = scoreClinic(INDEX.clinics[2]!, query, INDEX)!;
  assert.equal(unpriced.score, 100);
  assert.ok(unpriced.misses.some((m) => m.criterion === "budget"));
  assert.equal(unpriced.exact, false, "a stated gap is not a full match");

  // Another currency is the same kind of unknown as no price at all.
  assert.equal(
    budgetFit(
      clinic({ slug: "krw", currency: "KRW", priceMin: 5_000_000 }),
      "USD",
      8_000,
    ),
    null,
  );
});

test("budget fit rewards overlap and part-credits a near miss", () => {
  const c = (min: number, max: number) =>
    clinic({ slug: "c", priceMin: min, priceMax: max });
  assert.equal(budgetFit(c(6_000, 9_000), "USD", 8_000), 1);
  // Starts above the ceiling but within the tolerance.
  assert.equal(budgetFit(c(9_000, 12_000), "USD", 8_000), 0.5);
  // Far above it.
  assert.equal(budgetFit(c(30_000, 40_000), "USD", 8_000), 0);
  // Under a floor the visitor set is information, not a mismatch.
  assert.equal(budgetFit(c(1_000, 2_000), "USD", 20_000, 10_000), 0.5);
});

test("ranking is by fit, and partial matches announce themselves", () => {
  const query = {
    condition: "knee-osteoarthritis",
    treatment: "msc-therapy",
    country: "mexico",
    budgetMax: 9_000,
  };
  const outcome = matchClinics(INDEX, query, 3);

  assert.equal(outcome.asked.length, 4);
  assert.equal(outcome.results[0]!.clinic.slug, "full-match");
  assert.equal(outcome.results[0]!.score, 100);
  assert.equal(outcome.exactCount, 1);
  assert.ok(outcome.relaxed, "a list padded with near misses must say so");

  // The unrelated clinic matches nothing and is dropped rather than listed last.
  assert.ok(
    outcome.results.every((r) => r.clinic.slug !== "unrelated"),
    "a zero-score clinic is noise, not a third suggestion",
  );

  // Every listed clinic after the first carries its gaps.
  for (const result of outcome.results.slice(1)) {
    assert.ok(result.misses.length > 0);
    assert.ok(result.misses.every((m) => m.label.length > 0));
  }
});

test("a clinic that answered everything outranks one that could not", () => {
  // Both score 100: the unpriced clinic drops budget from its denominator
  // rather than failing it. Somebody who has just typed a budget in wants the
  // clinic whose published price actually fits it first.
  const outcome = matchClinics(
    INDEX,
    { condition: "knee-osteoarthritis", budgetMax: 9_000 },
    3,
  );
  // Three clinics tie on 100. The two whose published price fits go first, in
  // rating order; the one that could not answer the budget question goes last.
  assert.deepEqual(
    outcome.results.map((r) => r.clinic.slug),
    ["full-match", "wrong-country", "unpriced"],
  );
  assert.ok(outcome.results.every((r) => r.score === 100));
  assert.equal(outcome.results[0]!.misses.length, 0);
  assert.equal(outcome.results.at(-1)!.misses.length, 1);
});

test("matching ignores everything about a clinic except fit and reviews", () => {
  // A verified, heavily reviewed clinic that misses the condition must lose to
  // an unknown one that matches it. Placement is not for sale here.
  const index: ClinicMatchIndex = {
    ...INDEX,
    clinics: [
      clinic({
        slug: "famous",
        name: "Famous",
        verified: true,
        badge: "premier",
        ratingAvg: 5,
        reviewCount: 900,
        conditions: ["hair-restoration"],
        treatments: ["msc-therapy"],
      }),
      clinic({
        slug: "obscure",
        name: "Obscure",
        conditions: ["knee-osteoarthritis"],
        treatments: ["msc-therapy"],
      }),
    ],
  };
  const outcome = matchClinics(
    index,
    { condition: "knee-osteoarthritis", treatment: "msc-therapy" },
    2,
  );
  assert.equal(outcome.results[0]!.clinic.slug, "obscure");
  assert.ok(MATCH_WEIGHTS.condition > MATCH_WEIGHTS.budget);
});

test("no answers produces no shortlist rather than an arbitrary one", () => {
  const outcome = matchClinics(INDEX, {}, 3);
  assert.deepEqual(outcome.results, []);
  assert.equal(outcome.candidateCount, 0);
  assert.equal(directoryHref({}, INDEX), "/clinics");
});

test("the directory link carries the same filters the quiz used", () => {
  const href = directoryHref(
    {
      condition: "knee-osteoarthritis",
      treatment: "msc-therapy",
      country: "mexico",
      budgetMin: 5_000,
      budgetMax: 10_000,
    },
    INDEX,
  );
  assert.ok(href.startsWith("/clinics?"));
  const params = new URLSearchParams(href.split("?")[1]!);
  assert.equal(params.get("condition"), "knee-osteoarthritis");
  assert.equal(params.get("treatment"), "msc-therapy");
  // The directory matches a country by display name, not by slug.
  assert.equal(params.get("country"), "Mexico");
  assert.equal(params.get("priceMax"), "10000");
});

// ── Treatment comparison ────────────────────────────────────────────────────

test("every comparison option is internally consistent", () => {
  const focusKeys = new Set(COMPARISON_FOCUSES.map((f) => f.key));
  const seen = new Set<string>();
  for (const option of COMPARISON_OPTIONS) {
    assert.ok(!seen.has(option.key), `duplicate option ${option.key}`);
    seen.add(option.key);
    assert.ok(option.costLow > 0, `${option.key} needs a cost floor`);
    assert.ok(
      option.costHigh >= option.costLow,
      `${option.key} has an inverted cost range`,
    );
    assert.ok(option.focus.length > 0, `${option.key} applies to nothing`);
    for (const key of option.focus) {
      assert.ok(focusKeys.has(key), `${option.key} names unknown focus ${key}`);
    }
    // Every row has to be able to say what is known about it, because the table
    // has no score to fall back on.
    assert.ok(
      option.evidence.length > 40,
      `${option.key} needs an evidence note`,
    );
  }
});

test("every focus has options on both sides of the decision", () => {
  for (const focus of COMPARISON_FOCUSES) {
    const rows = comparisonRows(focus.key);
    assert.ok(rows.length >= 4, `${focus.key} has too few options to compare`);
    const kinds = new Set(rows.map((r) => r.kind));
    assert.ok(kinds.has("regenerative"), `${focus.key} has no regenerative row`);
    assert.ok(kinds.has("surgical"), `${focus.key} has no surgical row`);
    assert.ok(kinds.has("conventional"), `${focus.key} has no conventional row`);
    assert.ok(kinds.has("none"), `${focus.key} omits doing nothing invasive`);
  }
});

test("the comparison table never prices a row from a clinic-level range", () => {
  // A clinic's published range covers everything it charges for, so slicing it
  // by treatment answers "what do clinics offering PRP charge in general",
  // not "what does PRP cost". Wiring that in put PRP at roughly 4,000 to
  // 20,000 dollars, identical to the stem cell row beneath it. If a
  // `treatmentSlug` reappears on an option, that mistake is being rebuilt.
  for (const option of COMPARISON_OPTIONS) {
    assert.ok(
      !("treatmentSlug" in option),
      `${option.key} is being priced from directory listings again`,
    );
  }

  // PRP has to stay visibly cheaper than a stem cell course, which is the one
  // comparison a reader of this table most often comes for.
  const prp = COMPARISON_OPTIONS.find((o) => o.key === "prp")!;
  const stemCell = COMPARISON_OPTIONS.find((o) => o.key === "stem-cell")!;
  assert.ok(prp.costHigh < stemCell.costLow);
});

test("the comparison spread reads from the real floor and ceiling", () => {
  const rows = comparisonRows("knee");
  const spread = comparisonSpread(rows)!;
  assert.equal(spread.cheapest.costLow, Math.min(...rows.map((r) => r.costLow)));
  assert.equal(
    spread.dearest.costHigh,
    Math.max(...rows.map((r) => r.costHigh)),
  );
  assert.equal(comparisonSpread([]), null);
});
