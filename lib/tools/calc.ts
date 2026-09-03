/**
 * Calculator maths — every formula the `/tools` pages run, in one pure module.
 *
 * Deliberately dependency-free (no React, no `next`, no `mongoose`) for three
 * reasons that all matter here:
 *
 *  - The calculators are client components, so anything they import ships to the
 *    browser. Keeping the maths free of server imports keeps that payload to
 *    arithmetic.
 *  - The same functions back the server-rendered worked example on each page, so
 *    the number a crawler sees in the HTML is produced by the same code the
 *    widget runs. A calculator whose static copy and live output disagree is a
 *    thin-content signal, not a feature.
 *  - Formulas are the part worth testing (`tests/tools/calc.test.ts`). Pure
 *    functions with named, published sources are testable against the values
 *    those sources publish.
 *
 * Every function takes metric units. Unit conversion happens once, at the edge,
 * via the helpers at the top, so no formula below has to care which toggle the
 * visitor picked.
 */

// ── Units ───────────────────────────────────────────────────────────────────

export const LB_PER_KG = 2.2046226218;
export const CM_PER_INCH = 2.54;

export const lbToKg = (lb: number): number => lb / LB_PER_KG;
export const kgToLb = (kg: number): number => kg * LB_PER_KG;
export const inToCm = (inches: number): number => inches * CM_PER_INCH;
export const cmToIn = (cm: number): number => cm / CM_PER_INCH;

/** Feet + inches to centimetres, e.g. `feetInchesToCm(5, 10)` gives 177.8. */
export const feetInchesToCm = (feet: number, inches: number): number =>
  inToCm(feet * 12 + inches);

/** Round to `places` decimals without the float dust `toFixed` leaves behind. */
export function round(value: number, places = 1): number {
  const f = 10 ** places;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** Clamp into an inclusive range. Guards every user-typed number below. */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export type Sex = "male" | "female";

// ── BMI ─────────────────────────────────────────────────────────────────────

export type BmiCategory =
  | "underweight"
  | "healthy"
  | "overweight"
  | "obese-1"
  | "obese-2"
  | "obese-3";

export interface BmiBand {
  key: BmiCategory;
  label: string;
  /** Inclusive lower bound. */
  min: number;
  /** Exclusive upper bound; `Infinity` on the top band. */
  max: number;
}

/** WHO adult BMI cut-points. */
export const BMI_BANDS: BmiBand[] = [
  { key: "underweight", label: "Underweight", min: 0, max: 18.5 },
  { key: "healthy", label: "Healthy weight", min: 18.5, max: 25 },
  { key: "overweight", label: "Overweight", min: 25, max: 30 },
  { key: "obese-1", label: "Obesity class I", min: 30, max: 35 },
  { key: "obese-2", label: "Obesity class II", min: 35, max: 40 },
  { key: "obese-3", label: "Obesity class III", min: 40, max: Infinity },
];

export interface BmiResult {
  bmi: number;
  band: BmiBand;
  /** Weight range (kg) that would put this height in the healthy band. */
  healthyRangeKg: { min: number; max: number };
  /** Kilograms to the nearest edge of the healthy band; 0 when already inside. */
  kgToHealthy: number;
}

export function bmiBandFor(bmi: number): BmiBand {
  return BMI_BANDS.find((b) => bmi >= b.min && bmi < b.max) ?? BMI_BANDS[0]!;
}

export function calcBmi(weightKg: number, heightCm: number): BmiResult {
  const kg = clamp(weightKg, 20, 400);
  const m = clamp(heightCm, 100, 250) / 100;
  const bmi = round(kg / (m * m), 1);

  const healthyRangeKg = {
    min: round(18.5 * m * m, 1),
    max: round(24.9 * m * m, 1),
  };
  const kgToHealthy =
    kg < healthyRangeKg.min
      ? round(healthyRangeKg.min - kg, 1)
      : kg > healthyRangeKg.max
        ? round(kg - healthyRangeKg.max, 1)
        : 0;

  return { bmi, band: bmiBandFor(bmi), healthyRangeKg, kgToHealthy };
}

/**
 * Extra load a knee carries per kilogram of body weight.
 *
 * The multiplier is why a BMI calculator belongs on a regenerative medicine site
 * rather than being a traffic-only widget: knee joint loading during walking
 * runs at roughly three to four times body weight, so a change on the scale is a
 * much larger change at the joint. It is stated as a range because gait, speed
 * and slope all move it.
 */
export const KNEE_LOAD_MULTIPLIER = { min: 3, max: 4 } as const;

/** Extra kilograms of peak knee load carried per kilogram over the healthy band. */
export function kneeLoadFromExcessKg(excessKg: number): {
  min: number;
  max: number;
} {
  const kg = Math.max(0, excessKg);
  return {
    min: round(kg * KNEE_LOAD_MULTIPLIER.min, 1),
    max: round(kg * KNEE_LOAD_MULTIPLIER.max, 1),
  };
}

// ── BMR and TDEE ────────────────────────────────────────────────────────────

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very-active";

export const ACTIVITY_FACTORS: Record<
  ActivityLevel,
  { label: string; hint: string; factor: number }
> = {
  sedentary: {
    label: "Sedentary",
    hint: "Desk work, little or no exercise",
    factor: 1.2,
  },
  light: {
    label: "Lightly active",
    hint: "Light exercise 1 to 3 days a week",
    factor: 1.375,
  },
  moderate: {
    label: "Moderately active",
    hint: "Moderate exercise 3 to 5 days a week",
    factor: 1.55,
  },
  active: {
    label: "Very active",
    hint: "Hard exercise 6 to 7 days a week",
    factor: 1.725,
  },
  "very-active": {
    label: "Extra active",
    hint: "Physical job or twice daily training",
    factor: 1.9,
  },
};

export interface BmrInput {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
}

/** Mifflin-St Jeor resting metabolic rate, in kcal per day. */
export function calcBmr({ weightKg, heightCm, age, sex }: BmrInput): number {
  const kg = clamp(weightKg, 20, 400);
  const cm = clamp(heightCm, 100, 250);
  const yrs = clamp(age, 15, 100);
  const base = 10 * kg + 6.25 * cm - 5 * yrs;
  return Math.round(sex === "male" ? base + 5 : base - 161);
}

/** Harris-Benedict (1984 revision), kept as the cross-check the page shows. */
export function calcBmrHarrisBenedict({
  weightKg,
  heightCm,
  age,
  sex,
}: BmrInput): number {
  const kg = clamp(weightKg, 20, 400);
  const cm = clamp(heightCm, 100, 250);
  const yrs = clamp(age, 15, 100);
  return Math.round(
    sex === "male"
      ? 88.362 + 13.397 * kg + 4.799 * cm - 5.677 * yrs
      : 447.593 + 9.247 * kg + 3.098 * cm - 4.33 * yrs,
  );
}

export interface TdeeResult {
  bmr: number;
  bmrHarrisBenedict: number;
  tdee: number;
  /** Common calorie targets built off the maintenance figure. */
  targets: { key: string; label: string; kcal: number; note: string }[];
}

export function calcTdee(input: BmrInput, activity: ActivityLevel): TdeeResult {
  const bmr = calcBmr(input);
  const tdee = Math.round(bmr * ACTIVITY_FACTORS[activity].factor);
  return {
    bmr,
    bmrHarrisBenedict: calcBmrHarrisBenedict(input),
    tdee,
    targets: [
      {
        key: "lose-slow",
        label: "Gradual weight loss",
        kcal: Math.round(tdee - 250),
        note: "About 0.25 kg a week",
      },
      {
        key: "lose",
        label: "Steady weight loss",
        kcal: Math.round(tdee - 500),
        note: "About 0.5 kg a week",
      },
      {
        key: "maintain",
        label: "Maintain weight",
        kcal: tdee,
        note: "Energy in matches energy out",
      },
      {
        key: "gain",
        label: "Gradual weight gain",
        kcal: Math.round(tdee + 300),
        note: "About 0.25 kg a week",
      },
    ],
  };
}

// ── Body fat ────────────────────────────────────────────────────────────────

export interface NavyBodyFatInput {
  sex: Sex;
  heightCm: number;
  neckCm: number;
  waistCm: number;
  /** Required for women, ignored for men. */
  hipCm?: number;
}

/**
 * US Navy circumference method. Published in inches with base-10 logs, so the
 * conversion happens here rather than asking callers to think in inches.
 *
 * Returns `null` when the measurements cannot produce a value: the log terms go
 * undefined once waist is at or below neck (or waist plus hip at or below neck),
 * which is a typo rather than a body.
 */
export function calcBodyFatNavy(input: NavyBodyFatInput): number | null {
  const height = cmToIn(clamp(input.heightCm, 100, 250));
  const neck = cmToIn(clamp(input.neckCm, 15, 80));
  const waist = cmToIn(clamp(input.waistCm, 40, 250));

  if (input.sex === "male") {
    const diff = waist - neck;
    if (diff <= 0) return null;
    const bf =
      495 /
        (1.0324 - 0.19077 * Math.log10(diff) + 0.15456 * Math.log10(height)) -
      450;
    return bf > 0 && bf < 75 ? round(bf, 1) : null;
  }

  const hip = cmToIn(clamp(input.hipCm ?? 0, 40, 250));
  const sum = waist + hip - neck;
  if (sum <= 0) return null;
  const bf =
    495 / (1.29579 - 0.35004 * Math.log10(sum) + 0.221 * Math.log10(height)) -
    450;
  return bf > 0 && bf < 75 ? round(bf, 1) : null;
}

/** Deurenberg BMI estimate, the fallback when tape measurements are missing. */
export function calcBodyFatDeurenberg(
  bmi: number,
  age: number,
  sex: Sex,
): number {
  const bf =
    1.2 * bmi + 0.23 * clamp(age, 15, 100) - 10.8 * (sex === "male" ? 1 : 0) - 5.4;
  return round(Math.max(2, bf), 1);
}

export interface BodyFatBand {
  key: string;
  label: string;
  min: number;
  max: number;
}

/** ACE descriptive ranges, split by sex. */
export const BODY_FAT_BANDS: Record<Sex, BodyFatBand[]> = {
  male: [
    { key: "essential", label: "Essential fat", min: 0, max: 6 },
    { key: "athletic", label: "Athletic", min: 6, max: 14 },
    { key: "fitness", label: "Fitness", min: 14, max: 18 },
    { key: "average", label: "Average", min: 18, max: 25 },
    { key: "above", label: "Above average", min: 25, max: Infinity },
  ],
  female: [
    { key: "essential", label: "Essential fat", min: 0, max: 14 },
    { key: "athletic", label: "Athletic", min: 14, max: 21 },
    { key: "fitness", label: "Fitness", min: 21, max: 25 },
    { key: "average", label: "Average", min: 25, max: 32 },
    { key: "above", label: "Above average", min: 32, max: Infinity },
  ],
};

export function bodyFatBandFor(percent: number, sex: Sex): BodyFatBand {
  const bands = BODY_FAT_BANDS[sex];
  return bands.find((b) => percent >= b.min && b.max > percent) ?? bands[0]!;
}

export interface BodyFatResult {
  percent: number;
  method: "navy" | "bmi";
  band: BodyFatBand;
  fatMassKg: number;
  leanMassKg: number;
}

export function calcBodyFat(opts: {
  sex: Sex;
  age: number;
  weightKg: number;
  heightCm: number;
  neckCm?: number;
  waistCm?: number;
  hipCm?: number;
}): BodyFatResult {
  const navy =
    opts.neckCm && opts.waistCm
      ? calcBodyFatNavy({
          sex: opts.sex,
          heightCm: opts.heightCm,
          neckCm: opts.neckCm,
          waistCm: opts.waistCm,
          hipCm: opts.hipCm,
        })
      : null;

  const percent =
    navy ??
    calcBodyFatDeurenberg(
      calcBmi(opts.weightKg, opts.heightCm).bmi,
      opts.age,
      opts.sex,
    );

  const kg = clamp(opts.weightKg, 20, 400);
  const fatMassKg = round((percent / 100) * kg, 1);

  return {
    percent,
    method: navy === null ? "bmi" : "navy",
    band: bodyFatBandFor(percent, opts.sex),
    fatMassKg,
    leanMassKg: round(kg - fatMassKg, 1),
  };
}

// ── Ideal weight ────────────────────────────────────────────────────────────

export interface IdealWeightResult {
  /** One row per published formula, all in kilograms. */
  formulas: { key: string; label: string; kg: number }[];
  /** Mean of the four formulas, the headline number. */
  averageKg: number;
  /** The healthy-BMI window for this height, which is the range clinicians use. */
  healthyBmiRangeKg: { min: number; max: number };
}

/**
 * The four circulating ideal body weight formulas.
 *
 * All four are height-only and were built for drug dosing, not for describing a
 * body, which is why the healthy-BMI window is returned alongside them and gets
 * the emphasis on the page. Reporting a single kilogram figure as a target would
 * be the wrong reading of what these equations are.
 */
export function calcIdealWeight(heightCm: number, sex: Sex): IdealWeightResult {
  const cm = clamp(heightCm, 100, 250);
  const overFiveFeet = Math.max(0, cmToIn(cm) - 60);
  const male = sex === "male";

  const formulas = [
    {
      key: "devine",
      label: "Devine (1974)",
      kg: round((male ? 50 : 45.5) + 2.3 * overFiveFeet, 1),
    },
    {
      key: "robinson",
      label: "Robinson (1983)",
      kg: round((male ? 52 : 49) + (male ? 1.9 : 1.7) * overFiveFeet, 1),
    },
    {
      key: "miller",
      label: "Miller (1983)",
      kg: round((male ? 56.2 : 53.1) + (male ? 1.41 : 1.36) * overFiveFeet, 1),
    },
    {
      key: "hamwi",
      label: "Hamwi (1964)",
      kg: round((male ? 48 : 45.5) + (male ? 2.7 : 2.2) * overFiveFeet, 1),
    },
  ];

  const m = cm / 100;
  return {
    formulas,
    averageKg: round(
      formulas.reduce((sum, f) => sum + f.kg, 0) / formulas.length,
      1,
    ),
    healthyBmiRangeKg: {
      min: round(18.5 * m * m, 1),
      max: round(24.9 * m * m, 1),
    },
  };
}

// ── Water intake ────────────────────────────────────────────────────────────

export type Climate = "temperate" | "warm" | "hot";

export const CLIMATE_FACTORS: Record<
  Climate,
  { label: string; hint: string; factor: number }
> = {
  temperate: { label: "Temperate", hint: "Under 24C most days", factor: 1 },
  warm: { label: "Warm", hint: "24C to 30C", factor: 1.1 },
  hot: { label: "Hot or humid", hint: "Above 30C", factor: 1.2 },
};

export interface WaterIntakeResult {
  /** Total water a day, including what comes from food. */
  totalMl: number;
  /** What to actually drink, once food water is deducted. */
  drinkMl: number;
  /** Roughly 20% of total water intake arrives in food. */
  fromFoodMl: number;
  glasses: number;
  breakdown: { label: string; ml: number }[];
}

/**
 * Baseline 35 ml per kilogram, plus 12 ml per minute of activity, scaled for
 * climate. Then split: about a fifth of daily water arrives in food, so the
 * "drink this much" figure is four fifths of the total rather than all of it.
 * Glasses are counted at 250 ml.
 */
export function calcWaterIntake(opts: {
  weightKg: number;
  activityMinutes: number;
  climate: Climate;
}): WaterIntakeResult {
  const kg = clamp(opts.weightKg, 20, 400);
  const minutes = clamp(opts.activityMinutes, 0, 480);
  const factor = CLIMATE_FACTORS[opts.climate].factor;

  const baseMl = kg * 35;
  const activityMl = minutes * 12;
  const climateMl = (baseMl + activityMl) * (factor - 1);
  const totalMl = Math.round(baseMl + activityMl + climateMl);
  const fromFoodMl = Math.round(totalMl * 0.2);
  const drinkMl = totalMl - fromFoodMl;

  return {
    totalMl,
    drinkMl,
    fromFoodMl,
    glasses: Math.round(drinkMl / 250),
    breakdown: [
      { label: "Body weight baseline", ml: Math.round(baseMl) },
      { label: "Activity", ml: Math.round(activityMl) },
      { label: "Climate", ml: Math.round(climateMl) },
    ].filter((row) => row.ml > 0),
  };
}

// ── Symptom scores ──────────────────────────────────────────────────────────

export interface ScoreBand {
  key: string;
  label: string;
  /** Inclusive lower bound on the 0 to 100 scale. */
  min: number;
  max: number;
  summary: string;
}

export interface QuestionnaireResult {
  /** 0 to 100, higher means more symptoms. */
  score: number;
  band: ScoreBand;
  /** Raw points, before normalising. */
  raw: number;
  rawMax: number;
  /** Per-domain scores, also 0 to 100. */
  domains: { key: string; label: string; score: number }[];
  /** Number of items the visitor has answered. */
  answered: number;
  total: number;
}

/** Normalise a raw point total onto 0 to 100. */
export function normaliseScore(raw: number, rawMax: number): number {
  if (rawMax <= 0) return 0;
  return round((raw / rawMax) * 100, 1);
}

export function bandFor(bands: ScoreBand[], score: number): ScoreBand {
  return (
    bands.find((b) => score >= b.min && score <= b.max) ??
    bands[bands.length - 1]!
  );
}

/**
 * Score a Likert questionnaire whose items are grouped into domains.
 *
 * Shared by the knee and back tools because the shape is identical: fixed
 * domains, an integer answer per item, a per-item maximum. Unanswered items are
 * excluded from both the numerator and the denominator so a partly-filled form
 * still reads sensibly rather than scoring every blank as "no symptoms".
 */
export function scoreQuestionnaire(opts: {
  domains: { key: string; label: string; itemIds: string[] }[];
  answers: Record<string, number | undefined>;
  maxPerItem: number;
  bands: ScoreBand[];
}): QuestionnaireResult {
  const { domains, answers, maxPerItem, bands } = opts;

  let raw = 0;
  let rawMax = 0;
  let answered = 0;
  let total = 0;

  const domainScores = domains.map((domain) => {
    let dRaw = 0;
    let dMax = 0;
    for (const id of domain.itemIds) {
      total += 1;
      const value = answers[id];
      if (typeof value !== "number") continue;
      answered += 1;
      dRaw += clamp(value, 0, maxPerItem);
      dMax += maxPerItem;
    }
    raw += dRaw;
    rawMax += dMax;
    return {
      key: domain.key,
      label: domain.label,
      score: normaliseScore(dRaw, dMax),
    };
  });

  const score = normaliseScore(raw, rawMax);
  return {
    score,
    band: bandFor(bands, score),
    raw,
    rawMax,
    domains: domainScores,
    answered,
    total,
  };
}
