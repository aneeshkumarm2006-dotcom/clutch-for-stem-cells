/**
 * Guide-capture modal — copy, question list, and trigger rules.
 *
 * Build-time config (like `config/site.ts`): the on/off switch is a runtime
 * feature flag in admin Settings, but the wording and the thresholds live here
 * so the modal and the email it promises can never drift apart. Nothing in this
 * file may contain an em dash (see `lib/meta-text.ts`).
 */

/** Number of distinct clinic profiles that arms the view trigger. */
export const CAPTURE_PROFILE_THRESHOLD = 2;

/** How long a browser is left alone after the modal has been shown once. */
export const CAPTURE_COOLDOWN_DAYS = 30;

/** Delay before the modal opens, so it never lands on top of a toast. */
export const CAPTURE_OPEN_DELAY_MS = 900;

/**
 * Routes the modal must never interrupt. These are the pages a visitor reads
 * precisely when they are checking whether to trust us, and an email prompt on
 * top of a disclaimer reads as a bait. Matched as exact path or prefix.
 */
export const CAPTURE_SUPPRESSED_PATHS = [
  "/methodology",
  "/medical-disclaimer",
  "/privacy",
] as const;

/** True when the modal must stay closed on this path. */
export function isCaptureSuppressed(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return CAPTURE_SUPPRESSED_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );
}

/** Matches a clinic profile URL and its two sub-pages, and nothing else. */
export const CLINIC_PATH_RE = /^\/clinic\/([^/]+)(?:\/(?:reviews|cost))?$/;

/** Clinic slug for a clinic-profile path, or null for any other route. */
export function clinicSlugFromPath(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  return CLINIC_PATH_RE.exec(path)?.[1] ?? null;
}

export const CAPTURE_COPY = {
  title: "Email me my shortlist + the 12 questions",
  /** Shown when the visitor has saved at least one clinic. */
  bodyWithShortlist:
    "We will send the clinics you have saved, plus the 12 questions to ask any stem cell clinic before you book.",
  /** Shown when the shortlist is still empty (2nd-profile trigger). */
  bodyEmptyShortlist:
    "We will send the 12 questions to ask any stem cell clinic before you book, along with any clinics you have saved.",
  bullets: [
    "Your saved clinics, with location, focus, and a link back to each profile.",
    "12 questions covering approvals, evidence, risk, cost, and follow-up care.",
  ],
  emailLabel: "Your email",
  emailPlaceholder: "you@email.com",
  submitLabel: "Email me my shortlist",
  submitBusyLabel: "Sending",
  dismissLabel: "No thanks",
  privacyNote:
    "One email, sent once. We never sell or share your address, and you can unsubscribe from the email itself.",
  successTitle: "Check your inbox",
  successBody:
    "Your shortlist and the 12 questions are on the way. If it has not arrived in a few minutes, check your spam folder.",
} as const;

export interface GuideQuestion {
  question: string;
  why: string;
}

/**
 * The 12 questions. Written to be answerable: each one has a wrong answer a
 * visitor can recognise without a medical background, which is the whole point
 * of handing them over before a consultation.
 */
export const GUIDE_QUESTIONS: readonly GuideQuestion[] = [
  {
    question:
      "What exactly is in the product you would give me: which cell type, from which source, and at what dose?",
    why: "A clinic that cannot name the cell type and dose is not measuring what it gives you.",
  },
  {
    question:
      "Is this treatment approved by a regulator for my condition, or is it offered off-label, under an exemption, or as part of a trial?",
    why: "Very few stem cell treatments are approved for most conditions. An honest answer here is a good sign, not a bad one.",
  },
  {
    question:
      "Is the clinic registered with the FDA or the equivalent regulator in its country, and has it been inspected?",
    why: "Registration and inspection history are public in most countries, so you can check the answer afterwards.",
  },
  {
    question:
      "Who performs the procedure, what is their licence and specialty, and how many of these have they done?",
    why: "The person injecting is often not the doctor you spoke to during the sales call.",
  },
  {
    question:
      "Where are the cells processed, and is that laboratory accredited, for example to AABB, FACT, ISO, or GMP standards?",
    why: "Processing is where contamination and potency problems happen, and accreditation is verifiable.",
  },
  {
    question:
      "What published, peer-reviewed evidence supports this treatment for my condition, and can you send it to me?",
    why: "Ask for papers, not testimonials. Check whether the studies are in your condition and not just in the lab.",
  },
  {
    question:
      "What outcome is realistic for someone like me, and what does a non-response look like?",
    why: "A clinic that has never had a patient fail to respond is not describing medicine.",
  },
  {
    question:
      "What are the risks and side effects, and what is your own complication rate?",
    why: "Every real procedure has both. A number the clinic tracks is more meaningful than a reassurance.",
  },
  {
    question:
      "What is the total cost, what is included, and what gets billed separately?",
    why: "Imaging, travel, repeat doses, and follow-up are common extras that turn a quoted price into a much larger one.",
  },
  {
    question:
      "What follow-up is included, and who treats me if there is a complication after I fly home?",
    why: "Cross-border treatment fails most often on aftercare, not on the procedure itself.",
  },
  {
    question:
      "Will my data or tissue be used for research or a registry, and how is that consent handled?",
    why: "You are entitled to know, and to say no, without it changing your treatment.",
  },
  {
    question:
      "Can I see the consent forms before I pay, and can I speak with a past patient who had my condition?",
    why: "Reading the consent form early tells you what the clinic expects to go wrong.",
  },
];
