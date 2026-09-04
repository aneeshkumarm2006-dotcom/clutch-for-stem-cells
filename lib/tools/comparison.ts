/**
 * Treatment option reference data for `/tools/treatment-comparison`.
 *
 * The question this page exists to answer is not "how much does stem cell
 * therapy cost", which the cost calculator already answers from live directory
 * pricing. It is the question people ask immediately afterwards: how does it
 * compare with the cortisone shot my doctor offered, with PRP, with waiting, and
 * with the replacement I am trying to avoid.
 *
 * ## Why none of these figures comes from the directory
 *
 * The obvious idea, and the one this file deliberately does not do, is to price
 * the regenerative rows from published clinic prices the way
 * `/tools/stem-cell-cost-calculator` does. It does not work, and the reason is
 * worth writing down so nobody adds it back.
 *
 * `Clinic.priceMin` and `Clinic.priceMax` are a *clinic-level* range: the span
 * of everything that clinic charges for. Slicing that by treatment gives you
 * "the general pricing of clinics that offer PRP", not "what PRP costs". Wired
 * into a comparison table it produced a PRP row reading roughly 4,000 to 20,000
 * dollars, which is five to ten times the real figure and identical to the stem
 * cell row directly beneath it, because the two are the same clinics. That is
 * not a rough number, it is a wrong one, and it lands in the exact column a
 * reader is using to tell the options apart.
 *
 * Per-line prices do exist on `Clinic.costPage.items`, but they are free-text
 * labels in mixed currencies over mixed units (per session, per year, one time),
 * and matching them to a row here would be a guess wearing a decimal point.
 *
 * So every figure below is **indicative**: a broad United States self-pay range,
 * dated with {@link REFERENCE_AS_OF}, approximate by design, and labelled that
 * way on the page. It is not the output of a price survey and no row claims a
 * citation it does not have. An insured patient's share bears almost no
 * relationship to a list price, which is the single most important caveat on the
 * whole page. For pricing that does come from this directory's own listings, the
 * page links to the cost calculator, where a clinic-level band is what is being
 * asked for and is framed as such.
 *
 * If somebody later runs a real price survey, replacing the numbers here is a
 * one-file change and every row keeps its labelling.
 *
 * ## What the table deliberately will not do
 *
 * It does not rank the options, score them, or name a winner. Cost and recovery
 * time are comparable across rows. Likelihood of benefit is not: joint
 * replacement has decades of registry outcomes behind it, corticosteroid has
 * large randomised trials, and most regenerative protocols have observational
 * series and small trials. Putting those in one "effectiveness" column with
 * three stars against five would imply a comparison nobody can honestly make, so
 * `evidence` is a sentence rather than a rating and there is no total.
 *
 * Pure data plus lookups, no server imports: the widget is a client component.
 */

/** When the indicative figures below were last reviewed. Rendered on the page. */
export const REFERENCE_AS_OF = "September 2026";

/** Which body of evidence a row sits on, used only for grouping and labels. */
export type OptionKind = "conventional" | "regenerative" | "surgical" | "none";

export interface ComparisonOption {
  key: string;
  label: string;
  kind: OptionKind;
  /** Indicative US self-pay cost. See the file header on why it is not live. */
  costLow: number;
  costHigh: number;
  /** What the cost figure covers, shown under the price. */
  costBasis: string;
  /** Time to a normal day, not to full sport. */
  recovery: string;
  /** Where and how it is delivered. */
  setting: string;
  /** What a course usually looks like. */
  course: string;
  /** How long benefit typically lasts, where that is known. */
  durability: string;
  /** One sentence on the state of the evidence. No stars, no score. */
  evidence: string;
  /** Typical insurance position in the United States. */
  insurance: string;
  /** Focus keys this option belongs to. */
  focus: string[];
}

/** One comparison view: a joint or region, and the options that apply to it. */
export interface ComparisonFocus {
  key: string;
  label: string;
  /** Two words at most, for the segmented control on a narrow screen. */
  short: string;
  /** Condition slug in the directory, for the "see clinics" link. */
  conditionSlug?: string;
  /** The sentence under the selector. */
  intro: string;
}

export const COMPARISON_FOCUSES: ComparisonFocus[] = [
  {
    key: "knee",
    label: "Knee osteoarthritis",
    short: "Knee",
    conditionSlug: "knee-osteoarthritis",
    intro:
      "The most studied joint of the four, and the one where the gap between what conventional care offers and what regenerative clinics claim is widest.",
  },
  {
    key: "hip",
    label: "Hip osteoarthritis",
    short: "Hip",
    conditionSlug: "hip-osteoarthritis",
    intro:
      "Fewer injection options than the knee, and a replacement that tends to satisfy patients more than a knee replacement does, which changes the calculation.",
  },
  {
    key: "shoulder",
    label: "Shoulder and rotator cuff",
    short: "Shoulder",
    conditionSlug: "rotator-cuff-shoulder",
    intro:
      "Where the tear is and whether it is full thickness matters more than any figure in this table. A full thickness tear that has retracted will not be injected back together.",
  },
  {
    key: "back",
    label: "Low back and disc pain",
    short: "Back",
    conditionSlug: "back-and-spine",
    intro:
      "The widest price spread in the table and the least predictable outcomes, on both the conventional and the regenerative side.",
  },
];

export const COMPARISON_OPTIONS: ComparisonOption[] = [
  {
    key: "conservative",
    label: "Physiotherapy and load management",
    kind: "none",
    costLow: 600,
    costHigh: 2400,
    costBasis: "A course of six to twelve sessions, self-pay",
    recovery: "None. It is the activity",
    setting: "Outpatient, over weeks to months",
    course: "Ongoing, with a home programme",
    durability: "Holds while the programme continues",
    evidence:
      "Recommended first for osteoarthritis by essentially every clinical guideline, on consistent trial evidence. Unglamorous and routinely skipped.",
    insurance: "Usually covered, at least in part",
    focus: ["knee", "hip", "shoulder", "back"],
  },
  {
    key: "cortisone",
    label: "Corticosteroid injection",
    kind: "conventional",
    costLow: 100,
    costHigh: 600,
    costBasis: "Per injection, including the visit, self-pay",
    recovery: "A day or two of soreness",
    setting: "Outpatient, minutes",
    course: "Usually limited to three or four a year",
    durability: "Weeks to a few months",
    evidence:
      "Reliable short-term pain relief in trials, with the effect fading by around three months. Repeated knee injections have been associated with cartilage loss, which is why the frequency is capped.",
    insurance: "Usually covered",
    focus: ["knee", "hip", "shoulder", "back"],
  },
  {
    key: "hyaluronic",
    label: "Hyaluronic acid injection",
    kind: "conventional",
    costLow: 300,
    costHigh: 1500,
    costBasis: "A course of one to five injections, self-pay",
    recovery: "A day or two of soreness",
    setting: "Outpatient, minutes",
    course: "One injection, or a weekly series",
    durability: "Up to about six months where it works",
    evidence:
      "Contested. Some guidelines recommend against it in the knee on the grounds that the average benefit is small; others still offer it. Rarely used outside the knee.",
    insurance: "Sometimes covered for the knee",
    focus: ["knee"],
  },
  {
    key: "prp",
    label: "PRP injection",
    kind: "regenerative",
    costLow: 700,
    costHigh: 2500,
    costBasis: "Per injection, self-pay",
    recovery: "Days to two weeks",
    setting: "Outpatient, an hour or two including the blood draw",
    course: "One to three injections, weeks apart",
    durability: "Six to twelve months in the trials that report it",
    evidence:
      "The best studied of the regenerative options, with mixed results. Preparation methods vary so much between clinics that trials are difficult to compare with each other, which is a real limitation rather than a technicality.",
    insurance: "Rarely covered",
    focus: ["knee", "hip", "shoulder", "back"],
  },
  {
    key: "stem-cell",
    label: "Stem cell therapy",
    kind: "regenerative",
    costLow: 4000,
    costHigh: 12000,
    costBasis: "Per treated area, self-pay",
    recovery: "Days to two weeks",
    setting: "Outpatient, half a day for an autologous harvest",
    course: "One session, sometimes repeated",
    durability: "Reported in months to a year or two, on limited follow-up",
    evidence:
      "Not approved by the FDA or the EMA for these conditions. The published work is mostly small studies and observational series, and long-term outcomes are largely unknown. Claims made in marketing routinely run ahead of it.",
    insurance: "Not covered",
    focus: ["knee", "hip", "shoulder", "back"],
  },
  {
    key: "arthroscopy",
    label: "Arthroscopic surgery",
    kind: "surgical",
    costLow: 8000,
    costHigh: 15000,
    costBasis: "Day case, surgeon and facility, self-pay list price",
    recovery: "Four to eight weeks",
    setting: "Day surgery under anaesthetic",
    course: "One procedure",
    durability: "Depends entirely on what was found and done",
    evidence:
      "For degenerative knee disease without mechanical locking, several trials found no benefit over placebo surgery or physiotherapy, and guidelines advise against it. For a genuine mechanical problem it remains standard.",
    insurance: "Usually covered when indicated",
    focus: ["knee", "shoulder"],
  },
  {
    key: "rotator-cuff-repair",
    label: "Rotator cuff repair",
    kind: "surgical",
    costLow: 10000,
    costHigh: 25000,
    costBasis: "Arthroscopic repair, self-pay list price",
    recovery: "Sixteen to twenty six weeks",
    setting: "Day surgery under anaesthetic",
    course: "One procedure, then months of physiotherapy",
    durability: "Years, though re-tear rates rise with tear size and age",
    evidence:
      "Standard care for a symptomatic full thickness tear. For smaller degenerative tears the case against a trial of conservative care first is much weaker.",
    insurance: "Usually covered when indicated",
    focus: ["shoulder"],
  },
  {
    key: "fusion",
    label: "Lumbar spinal fusion",
    kind: "surgical",
    costLow: 60000,
    costHigh: 110000,
    costBasis: "Surgeon, hardware, facility and stay, self-pay list price",
    recovery: "Six months to a year",
    setting: "Inpatient, general anaesthetic",
    course: "One procedure, then extended rehabilitation",
    durability: "Permanent, including the loss of movement at the fused level",
    evidence:
      "Clear indications exist, such as instability or deformity. For non-specific low back pain the evidence is genuinely contested and rates vary enormously between countries and even between hospitals.",
    insurance: "Usually covered when indicated",
    focus: ["back"],
  },
  {
    key: "replacement",
    label: "Joint replacement",
    kind: "surgical",
    costLow: 30000,
    costHigh: 55000,
    costBasis: "Surgeon, implant, facility and stay, self-pay list price",
    recovery: "Three months to a year",
    setting: "Inpatient, general or spinal anaesthetic",
    course: "One procedure, then months of physiotherapy",
    durability: "Fifteen to twenty five years for most modern implants",
    evidence:
      "The most thoroughly documented option on this page, with national registries tracking implant survival for decades. Satisfaction is high but not universal: a meaningful minority of knee replacements do not meet the patient's expectations.",
    insurance: "Usually covered when indicated",
    focus: ["knee", "hip"],
  },
];

export function focusByKey(key: string): ComparisonFocus | undefined {
  return COMPARISON_FOCUSES.find((f) => f.key === key);
}

/**
 * The options that apply to one focus, in table order.
 *
 * Deliberately a plain filter with no pricing injection. See the file header:
 * the directory's clinic-level price ranges cannot answer "what does this
 * procedure cost", so every row here is the indicative figure and the page says
 * so on each one.
 */
export function comparisonRows(focusKey: string): ComparisonOption[] {
  return COMPARISON_OPTIONS.filter((o) => o.focus.includes(focusKey));
}

/** The cheapest and dearest rows in a set, for the summary line above the table. */
export function comparisonSpread(rows: ComparisonOption[]): {
  cheapest: ComparisonOption;
  dearest: ComparisonOption;
} | null {
  if (!rows.length) return null;
  const byFloor = [...rows].sort((a, b) => a.costLow - b.costLow);
  const byCeiling = [...rows].sort((a, b) => a.costHigh - b.costHigh);
  return { cheapest: byFloor[0]!, dearest: byCeiling[byCeiling.length - 1]! };
}
