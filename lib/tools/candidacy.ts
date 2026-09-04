/**
 * The candidacy questionnaire behind `/tools/am-i-a-candidate`.
 *
 * This is a screening aid, not a triage tool and not a diagnosis. It encodes the
 * things clinics in this directory routinely ask on an intake form, and it says
 * out loud what a clinic will not: that some answers mean the honest response is
 * "not this, and not now".
 *
 * Two design decisions worth stating, because they are what keep it defensible:
 *
 *  - Absolute contraindications are modelled as blockers, not as heavy negative
 *    weights (see `CandidacyEffect` in `lib/tools/cost.ts`). Active cancer cannot
 *    be outscored by being young and otherwise healthy.
 *  - Expectations are scored. Somebody who expects cartilage to regrow and the
 *    joint to be new again is, on the evidence as it stands, going to be
 *    disappointed, and a screening tool that stayed quiet about that would be
 *    setting them up for it.
 *
 * Pure data. Scoring lives in `scoreCandidacy`.
 */
import type { CandidacyQuestion } from "@/lib/tools/cost";

export const CANDIDACY_QUESTIONS: CandidacyQuestion[] = [
  {
    id: "area",
    question: "What are you looking to have treated?",
    hint: "Most clinics in this directory work in orthopaedics first.",
    answers: [
      {
        value: "joint",
        label: "A specific joint, such as a knee, hip or shoulder",
        effect: "positive",
        points: 10,
        note: "A single named joint is the best studied use and the easiest to get a straight answer on.",
      },
      {
        value: "spine",
        label: "Back or neck pain",
        effect: "neutral",
        points: 6,
      },
      {
        value: "soft-tissue",
        label: "A tendon, ligament or soft tissue injury",
        effect: "positive",
        points: 9,
      },
      {
        value: "autoimmune",
        label: "An autoimmune or inflammatory condition",
        effect: "negative",
        points: 3,
        note: "Systemic conditions are treated by some clinics, but the evidence is thinner and the claims are bolder. Scrutinise both.",
      },
      {
        value: "neuro",
        label: "A neurological condition",
        effect: "negative",
        points: 2,
        note: "Neurological indications attract the most overstated marketing in this field. Ask for trial data specific to your diagnosis.",
      },
      {
        value: "anti-aging",
        label: "General wellness, longevity or anti-ageing",
        effect: "negative",
        points: 1,
        note: "There is no accepted evidence that cell therapy slows ageing. Treat any clinic that says otherwise as a warning sign.",
      },
    ],
  },
  {
    id: "diagnosis",
    question: "Do you have a diagnosis confirmed by imaging or a specialist?",
    hint: "An MRI, X-ray or ultrasound report, or a consultant letter.",
    answers: [
      {
        value: "yes-recent",
        label: "Yes, within the last 12 months",
        effect: "positive",
        points: 10,
        note: "Recent imaging is the single most useful thing you can bring to a consultation.",
      },
      {
        value: "yes-old",
        label: "Yes, but it is more than a year old",
        effect: "neutral",
        points: 6,
      },
      {
        value: "no",
        label: "No, I have not been formally assessed",
        effect: "negative",
        points: 2,
        note: "Get a diagnosis first. A clinic that offers to treat without one is skipping the step that decides whether treatment makes sense.",
      },
    ],
  },
  {
    id: "severity",
    question: "How advanced is the problem?",
    hint: "For arthritis, roughly what your imaging report described.",
    answers: [
      {
        value: "early",
        label: "Early or mild changes",
        effect: "positive",
        points: 10,
        note: "Earlier disease is where reported results are strongest.",
      },
      {
        value: "moderate",
        label: "Moderate changes",
        effect: "positive",
        points: 8,
      },
      {
        value: "severe",
        label: "Severe, bone on bone or end stage",
        effect: "negative",
        points: 3,
        note: "In end-stage joint disease most clinicians expect little from an injection. Joint replacement is the comparison to weigh it against.",
      },
      {
        value: "unknown",
        label: "I do not know",
        effect: "neutral",
        points: 5,
      },
    ],
  },
  {
    id: "conservative",
    question: "What have you already tried?",
    answers: [
      {
        value: "several",
        label: "Physiotherapy plus injections, medication or bracing",
        effect: "positive",
        points: 10,
        note: "Having exhausted conservative care is the usual threshold for considering anything more.",
      },
      {
        value: "some",
        label: "Physiotherapy or medication alone",
        effect: "neutral",
        points: 7,
      },
      {
        value: "none",
        label: "Nothing structured yet",
        effect: "negative",
        points: 3,
        note: "Conservative care first. It is cheaper, it is better evidenced, and clinics will ask.",
      },
    ],
  },
  {
    id: "cancer",
    question: "Have you been treated for cancer, or are you being treated now?",
    answers: [
      {
        value: "active",
        label: "I am in active treatment or have an active diagnosis",
        effect: "blocker",
        points: 0,
        note: "Active malignancy is an absolute contraindication at reputable clinics. Cell therapy is not offered while cancer is active.",
      },
      {
        value: "remission",
        label: "In remission",
        effect: "negative",
        points: 4,
        note: "Remission is not automatically a bar, but it needs your oncologist's view in writing before a clinic will proceed.",
      },
      {
        value: "never",
        label: "No history of cancer",
        effect: "positive",
        points: 10,
      },
    ],
  },
  {
    id: "infection",
    question: "Any current infection, or an infection in the joint concerned?",
    answers: [
      {
        value: "yes",
        label: "Yes, currently",
        effect: "blocker",
        points: 0,
        note: "An active infection has to be cleared before any injection. This is a timing issue, not a permanent one.",
      },
      { value: "no", label: "No", effect: "positive", points: 10 },
    ],
  },
  {
    id: "blood",
    question:
      "Are you taking blood thinners or do you have a clotting disorder?",
    answers: [
      {
        value: "yes",
        label: "Yes",
        effect: "negative",
        points: 4,
        note: "Anticoagulation usually needs managing around the procedure. Your prescriber decides that, not the clinic.",
      },
      { value: "no", label: "No", effect: "positive", points: 10 },
    ],
  },
  {
    id: "smoking",
    question: "Do you smoke or vape nicotine?",
    hint: "Nicotine constricts blood supply and is consistently linked to worse healing.",
    answers: [
      {
        value: "yes",
        label: "Yes",
        effect: "negative",
        points: 4,
        note: "Nicotine works against every healing response a regenerative procedure depends on. Some clinics ask you to stop first.",
      },
      { value: "former", label: "I quit", effect: "neutral", points: 8 },
      { value: "no", label: "No", effect: "positive", points: 10 },
    ],
  },
  {
    id: "bmi",
    question: "Roughly where does your BMI sit?",
    hint: "Not sure? Work it out on the BMI calculator first.",
    answers: [
      { value: "under-25", label: "Under 25", effect: "positive", points: 10 },
      { value: "25-30", label: "25 to 30", effect: "neutral", points: 8 },
      {
        value: "30-35",
        label: "30 to 35",
        effect: "negative",
        points: 5,
        note: "Higher body weight raises joint loading and is associated with weaker results after joint procedures.",
      },
      {
        value: "over-35",
        label: "Over 35",
        effect: "negative",
        points: 3,
        note: "Some clinics set a BMI ceiling. Ask before you travel rather than after.",
      },
    ],
  },
  {
    id: "expectations",
    question: "What are you expecting treatment to do?",
    answers: [
      {
        value: "realistic",
        label: "Reduce pain and improve function for a period",
        effect: "positive",
        points: 10,
        note: "That is the outcome the published reports actually describe.",
      },
      {
        value: "delay",
        label: "Put off surgery for a few years",
        effect: "positive",
        points: 9,
      },
      {
        value: "regrow",
        label: "Regrow cartilage and make the joint new again",
        effect: "negative",
        points: 2,
        note: "No cell therapy has been shown to reliably regrow joint cartilage in humans. Any clinic promising it is overselling.",
      },
      {
        value: "cure",
        label: "Cure the condition",
        effect: "negative",
        points: 1,
        note: "Cure language is a red flag in this field, and in several countries it is not lawful to advertise.",
      },
    ],
  },
  {
    id: "budget",
    question: "Have you set a budget?",
    hint: "Almost all of this is paid privately.",
    answers: [
      {
        value: "yes",
        label: "Yes, and it covers travel and follow-up",
        effect: "positive",
        points: 10,
      },
      {
        value: "treatment-only",
        label: "Yes, for the treatment itself",
        effect: "neutral",
        points: 7,
        note: "Travel, accommodation and follow-up often add a third again on top. The travel cost calculator prices that.",
      },
      {
        value: "no",
        label: "Not yet",
        effect: "negative",
        points: 4,
      },
    ],
  },
  {
    id: "travel",
    question: "Would you travel abroad for treatment?",
    answers: [
      { value: "yes", label: "Yes", effect: "positive", points: 10 },
      {
        value: "maybe",
        label: "Possibly, for the right clinic",
        effect: "neutral",
        points: 8,
      },
      {
        value: "no",
        label: "No, treatment has to be local",
        effect: "neutral",
        points: 6,
        note: "That narrows the shortlist, and in some countries it narrows what is legally available. Worth checking early.",
      },
    ],
  },
];
