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
} from "@/lib/tools/price-band";
import {
  BACK_QUESTIONNAIRE,
  KNEE_QUESTIONNAIRE,
  domainsFor,
  itemIdsFor,
} from "@/lib/tools/questionnaires";
import { CANDIDACY_QUESTIONS } from "@/lib/tools/candidacy";

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
  for (const def of [KNEE_QUESTIONNAIRE, BACK_QUESTIONNAIRE]) {
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
