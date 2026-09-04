/**
 * Symptom questionnaires — the item sets behind the knee and back score tools.
 *
 * IMPORTANT, and the reason this file exists separately from `calc.ts`:
 *
 * The two best known instruments in this space, WOMAC for knee osteoarthritis
 * and the Oswestry Disability Index for low back pain, are published,
 * validated, and *not* ours to reprint. WOMAC in particular is a licensed
 * instrument. So these are not those questionnaires. They cover the same
 * activity domains, in the same structure and on the same response scale,
 * with item wording written here, and the pages say so in as many words.
 *
 * Practically that means: use these to put a number on how you are doing and to
 * track whether it moves, and hand a clinician the real instrument if a formal
 * score is what is wanted. Every consumer of this file surfaces that caveat, and
 * the copy in `config/tools.ts` repeats it above the fold rather than burying it
 * in a footnote.
 *
 * Pure data plus the band definitions. Scoring itself lives in
 * `scoreQuestionnaire` (lib/tools/calc.ts), which both sets share.
 */
import type { ScoreBand } from "@/lib/tools/calc";

export interface QuestionnaireItem {
  id: string;
  /** The activity or symptom being rated. */
  label: string;
}

export interface QuestionnaireDomain {
  key: string;
  label: string;
  /** Shown once above the domain, not per item. */
  prompt: string;
  items: QuestionnaireItem[];
}

export interface QuestionnaireDef {
  /** Response options, index = points scored. */
  scale: string[];
  domains: QuestionnaireDomain[];
  bands: ScoreBand[];
}

/** Domain descriptors in the shape `scoreQuestionnaire` wants. */
export function domainsFor(
  def: QuestionnaireDef,
): { key: string; label: string; itemIds: string[] }[] {
  return def.domains.map((d) => ({
    key: d.key,
    label: d.label,
    itemIds: d.items.map((i) => i.id),
  }));
}

/** Every item id in a questionnaire, in display order. */
export function itemIdsFor(def: QuestionnaireDef): string[] {
  return def.domains.flatMap((d) => d.items.map((i) => i.id));
}

// ── Knee ────────────────────────────────────────────────────────────────────

const FIVE_POINT = ["None", "Mild", "Moderate", "Severe", "Extreme"];

/**
 * Knee pain, stiffness and function over the last 48 hours. Three domains and
 * 24 items, matching the structure clinicians expect, so a score here is at
 * least comparable in shape to one taken in clinic.
 */
export const KNEE_QUESTIONNAIRE: QuestionnaireDef = {
  scale: FIVE_POINT,
  domains: [
    {
      key: "pain",
      label: "Pain",
      prompt:
        "How much knee pain have you had in the last 48 hours when you are",
      items: [
        { id: "p1", label: "Walking on flat ground" },
        { id: "p2", label: "Going up or down stairs" },
        { id: "p3", label: "In bed at night" },
        { id: "p4", label: "Sitting or lying down" },
        { id: "p5", label: "Standing upright" },
      ],
    },
    {
      key: "stiffness",
      label: "Stiffness",
      prompt: "How stiff has the knee felt",
      items: [
        { id: "s1", label: "First thing after waking up" },
        { id: "s2", label: "Later in the day, after sitting or resting" },
      ],
    },
    {
      key: "function",
      label: "Daily function",
      prompt: "How much difficulty have you had",
      items: [
        { id: "f1", label: "Going down stairs" },
        { id: "f2", label: "Going up stairs" },
        { id: "f3", label: "Standing up from a chair" },
        { id: "f4", label: "Standing still for a few minutes" },
        { id: "f5", label: "Bending down to the floor" },
        { id: "f6", label: "Walking on flat ground" },
        { id: "f7", label: "Getting in or out of a car" },
        { id: "f8", label: "Going around a shop" },
        { id: "f9", label: "Putting on socks or shoes" },
        { id: "f10", label: "Getting out of bed" },
        { id: "f11", label: "Taking off socks or shoes" },
        { id: "f12", label: "Lying in bed and turning over" },
        { id: "f13", label: "Getting in or out of a bath" },
        { id: "f14", label: "Sitting down" },
        { id: "f15", label: "Getting on or off the toilet" },
        { id: "f16", label: "Heavier jobs around the house" },
        { id: "f17", label: "Lighter jobs around the house" },
      ],
    },
  ],
  bands: [
    {
      key: "minimal",
      label: "Minimal",
      min: 0,
      max: 19.9,
      summary:
        "Symptoms are limited and rarely getting in the way of everyday activity.",
    },
    {
      key: "mild",
      label: "Mild",
      min: 20,
      max: 39.9,
      summary:
        "Noticeable symptoms that show up in specific activities rather than across the day.",
    },
    {
      key: "moderate",
      label: "Moderate",
      min: 40,
      max: 59.9,
      summary:
        "Symptoms are shaping how you move through a normal day and are worth a clinical assessment.",
    },
    {
      key: "severe",
      label: "Severe",
      min: 60,
      max: 79.9,
      summary:
        "Most of the listed activities are affected. This is the range where surgical options are usually discussed.",
    },
    {
      key: "extreme",
      label: "Extreme",
      min: 80,
      max: 100,
      summary:
        "Symptoms dominate daily function. See a clinician rather than working from any online score.",
    },
  ],
};

// ── Back ────────────────────────────────────────────────────────────────────

/**
 * Ten sections, six statements each, scored 0 to 5, in the structure of a
 * disability index. Item wording is written here (see the file header) and each
 * section's statements run from no limitation to complete limitation.
 */
export interface BackSection {
  id: string;
  label: string;
  options: string[];
}

export const BACK_SECTIONS: BackSection[] = [
  {
    id: "pain",
    label: "Pain intensity",
    options: [
      "I have no pain at the moment",
      "The pain is very mild at the moment",
      "The pain is moderate at the moment",
      "The pain is fairly severe at the moment",
      "The pain is very severe at the moment",
      "The pain is the worst imaginable at the moment",
    ],
  },
  {
    id: "care",
    label: "Washing and dressing",
    options: [
      "I manage normally without extra pain",
      "I manage normally but it causes extra pain",
      "It is painful and I am slow and careful",
      "I need some help but manage most of it myself",
      "I need help every day with most of it",
      "I cannot dress or wash without help and stay in bed",
    ],
  },
  {
    id: "lifting",
    label: "Lifting",
    options: [
      "I can lift heavy weights without extra pain",
      "I can lift heavy weights but it causes extra pain",
      "Pain stops me lifting heavy weights off the floor, but I manage if they are on a table",
      "Pain stops me lifting heavy weights, but I manage light to medium weights on a table",
      "I can lift only very light weights",
      "I cannot lift or carry anything",
    ],
  },
  {
    id: "walking",
    label: "Walking",
    options: [
      "Pain does not stop me walking any distance",
      "Pain stops me walking more than about 1.5 km",
      "Pain stops me walking more than about 750 m",
      "Pain stops me walking more than about 250 m",
      "I can only walk with a stick or crutches",
      "I am in bed most of the time and crawl to the toilet",
    ],
  },
  {
    id: "sitting",
    label: "Sitting",
    options: [
      "I can sit in any chair as long as I like",
      "I can sit in my favourite chair as long as I like",
      "Pain stops me sitting for more than an hour",
      "Pain stops me sitting for more than 30 minutes",
      "Pain stops me sitting for more than 10 minutes",
      "Pain stops me sitting at all",
    ],
  },
  {
    id: "standing",
    label: "Standing",
    options: [
      "I can stand as long as I want without extra pain",
      "I can stand as long as I want but it gives extra pain",
      "Pain stops me standing for more than an hour",
      "Pain stops me standing for more than 30 minutes",
      "Pain stops me standing for more than 10 minutes",
      "Pain stops me standing at all",
    ],
  },
  {
    id: "sleeping",
    label: "Sleeping",
    options: [
      "My sleep is never disturbed by pain",
      "My sleep is occasionally disturbed by pain",
      "Because of pain I get less than 6 hours of sleep",
      "Because of pain I get less than 4 hours of sleep",
      "Because of pain I get less than 2 hours of sleep",
      "Pain stops me sleeping at all",
    ],
  },
  {
    id: "social",
    label: "Social life",
    options: [
      "My social life is normal and causes me no extra pain",
      "My social life is normal but increases the pain",
      "Pain has cut out the more physical parts of my social life, such as sport",
      "Pain has limited my social life and I go out less often",
      "Pain has restricted my social life to what happens at home",
      "I have no social life because of pain",
    ],
  },
  {
    id: "travel",
    label: "Travelling",
    options: [
      "I can travel anywhere without pain",
      "I can travel anywhere but it gives extra pain",
      "Pain is bad but I manage journeys of over two hours",
      "Pain restricts me to journeys of under an hour",
      "Pain restricts me to short necessary journeys under 30 minutes",
      "Pain stops me travelling except to receive treatment",
    ],
  },
  {
    id: "work",
    label: "Work and housework",
    options: [
      "My normal work and housework cause no extra pain",
      "I can do my normal work and housework but it causes extra pain",
      "I can do most of it but pain stops the more physical jobs, such as lifting",
      "Pain stops me doing anything but light duties",
      "Pain stops me doing even light duties",
      "Pain stops me doing any work or housework at all",
    ],
  },
];

export const BACK_QUESTIONNAIRE: QuestionnaireDef = {
  // Each section has its own six statements, so the shared `scale` is only the
  // point labels used for the compact summary readout.
  scale: ["0", "1", "2", "3", "4", "5"],
  domains: [
    {
      key: "disability",
      label: "Overall disability",
      prompt: "Pick the statement that best describes you today",
      items: BACK_SECTIONS.map((s) => ({ id: s.id, label: s.label })),
    },
  ],
  bands: [
    {
      key: "minimal",
      label: "Minimal disability",
      min: 0,
      max: 20,
      summary:
        "Everyday activity is largely intact. Most people here are managed with activity advice and exercise rather than a procedure.",
    },
    {
      key: "moderate",
      label: "Moderate disability",
      min: 20.1,
      max: 40,
      summary:
        "Sitting, lifting and standing are affected. Conservative care is usually still the first line.",
    },
    {
      key: "severe",
      label: "Severe disability",
      min: 40.1,
      max: 60,
      summary:
        "Pain is the main problem in daily life. This is the range where imaging and a specialist opinion are normally arranged.",
    },
    {
      key: "crippling",
      label: "Crippling back pain",
      min: 60.1,
      max: 80,
      summary:
        "Pain intrudes on every area of life and warrants prompt, careful clinical investigation.",
    },
    {
      key: "bed-bound",
      label: "Bed bound or exaggerated",
      min: 80.1,
      max: 100,
      summary:
        "Scores this high need a clinician in the room, not an online questionnaire.",
    },
  ],
};
