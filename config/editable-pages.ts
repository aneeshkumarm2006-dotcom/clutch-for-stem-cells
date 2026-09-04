/**
 * Editable-page registry — the shipped content for every public route whose copy
 * lives in **code** rather than in a content collection.
 *
 * This is the same idea as `config/homepage.ts`, generalized from one route to
 * all of them. Each entry pairs a route with the exact strings and blocks it
 * renders today; `lib/page-content.ts` layers whatever an editor saved on top,
 * field by field, and anything blank falls back here. That is what makes
 * clearing a field in `/admin/content/site-pages` restore the shipped copy
 * instead of blanking a live page, and it is why no data migration is needed:
 * a route with no stored row renders exactly as it did before this existed.
 *
 * Four field kinds cover every page:
 *  - `title` / `lead` — the H1 and the paragraph under it. Every page has both.
 *  - `blocks` / `blocksAfter` — body composition, using the same block union the
 *    page CMS and taxonomy sections use. A prose page's blocks *are* its body;
 *    a functional page (the wizard, the directory) renders them around the
 *    working parts, which stay in code.
 *  - `extras` — the leftover one-off strings a page owns (an empty state, a
 *    section heading above a database-driven grid). Declared per page so the
 *    editor can label them properly.
 *  - `updated` / `legalReview` — the "Last updated" line and the legal-review
 *    notice, on the prose and legal pages that show them.
 *
 * `path` is both the registry key and the public route, with one exception:
 * `/contact/listing` is a *variant* — the copy `/contact?topic=listing` swaps
 * in. Variants are marked `variantOf` so they are hidden from sitemaps and
 * metadata lookups but still get their own editor screen.
 *
 * No server-only imports: the admin client form reads the defaults for its
 * placeholder text, so an editor always sees the live value rather than a copy
 * that can drift.
 */
import { SITE_NAME } from "@/config/site";
import type { StaticPageGroup } from "@/config/static-pages";
import { TOOLS, TOOLS_HUB, toolPath } from "@/config/tools";
import type { BlockInput } from "@/lib/validation/block";

/** A one-off string a page owns that is not a title, lead, or block. */
export interface EditablePageExtra {
  /** Stable key stored in `PageContent.extras`. */
  key: string;
  label: string;
  /** Where it appears on the page, shown under the field. */
  hint?: string;
  /** Render a textarea rather than a single-line input. */
  multiline?: boolean;
  /** The shipped string. */
  value: string;
}

/** Everything a route renders, before any editor override. */
export interface EditablePageDefaults {
  title: string;
  lead: string;
  updated: string;
  legalReview: boolean;
  blocks: BlockInput[];
  blocksAfter: BlockInput[];
  extras: Record<string, string>;
}

export interface EditablePage {
  /** Registry key. Also the public route, unless `variantOf` is set. */
  path: string;
  label: string;
  group: StaticPageGroup;
  /** Set when this entry is an alternate copy set for another route. */
  variantOf?: string;
  /** Human note about when the variant is shown. */
  variantWhen?: string;
  /** Field-level notes shown in the editor, so copy lands where expected. */
  notes: {
    title: string;
    lead: string;
    blocks?: string;
    blocksAfter?: string;
    /**
     * Set where the route's own code already decides part of its indexation,
     * so the meta panel doesn't imply a control it doesn't fully have.
     */
    seo?: string;
  };
  hasUpdated: boolean;
  hasLegalReview: boolean;
  hasBlocks: boolean;
  hasBlocksAfter: boolean;
  extras: EditablePageExtra[];
  /** Shipped title / lead / body. */
  title: string;
  lead: string;
  updated?: string;
  legalReview?: boolean;
  blocks?: BlockInput[];
  blocksAfter?: BlockInput[];
}

/** Shorthand for the one-block-of-HTML body most prose pages ship with. */
function prose(html: string): BlockInput[] {
  return [{ type: "richText", data: { html: html.trim() } }];
}

// ── Shipped bodies ──────────────────────────────────────────────────────────
//
// Lifted verbatim from the JSX these routes used to hold. Entities are written
// as the characters they rendered as, because this HTML goes through
// `dangerouslySetInnerHTML` rather than JSX.

const ABOUT_BODY = `
<h2>Why we exist</h2>
<p>Researching stem cell and regenerative treatments is hard. Information is scattered, claims are often unsubstantiated, and pricing is opaque. We bring clinics into one place with consistent profiles, accreditation details, transparent pricing ranges, and verified patient reviews, so you can make a more informed decision.</p>
<h2>What we are, and what we aren't</h2>
<p>We are an informational directory. We are <strong>not</strong> a medical provider, and we do not deliver care, give medical advice, or endorse the safety or efficacy of any treatment. Always consult a licensed physician. Individual results vary and no outcome is guaranteed.</p>
<h2>How clinics are listed</h2>
<p>Clinics are curated by our team. Verification is based on accreditation and record checks, and paid placement is always labelled. You can read exactly how we rank and verify on our <a href="/methodology">methodology page</a>.</p>
<p>No clinic can buy its way into a review score or edit what a patient wrote about it. We build profiles from a clinic's own published material, public registries and accreditation records, then check that against what the clinic tells us directly. When we cannot confirm a detail, we leave it out and say so. When a clinic disputes something, we look again, and we fix whatever turns out to be wrong.</p>
<h2>How we make money</h2>
<p>Clinics pay us for featured placement and for verification review. Patients pay nothing. Requesting a consultation is free, we do not sell patient data, and your details go only to the clinics you pick. Paid placement moves where a clinic appears. It never touches what the profile says, what the clinic scores, or which reviews go up. Every paid position is labelled.</p>
<h2>What we cannot tell you</h2>
<p>Whether a treatment works. Most of the therapies described here have not been through the trials that would settle that for any given condition, and several are legal in one country and not the next. Verification confirms a clinic is who it says it is, and stops there. We would rather be blunt about that limit than imply a certainty the field has not earned.</p>
<p>What we can do is line up the comparable facts: who runs the clinic, what it is accredited for, which therapies it uses, what it charges, and what patients who went there have said. Our <a href="/editorial-policy">editorial policy</a> covers how that content gets made and moderated. Read the <a href="/medical-disclaimer">medical disclaimer</a> before you act on any of it.</p>
<h2>Get in touch</h2>
<p>Questions, corrections, or a clinic to add? Visit our <a href="/contact">contact page</a>. Clinics looking to be listed can start on the <a href="/for-clinics">for clinics</a> page.</p>
`;

const METHODOLOGY_BODY = `
<h2>How clinics are ranked</h2>
<p>The default "Recommended" order combines several signals into a single ranking score, then applies a clear priority:</p>
<ul>
<li><strong>Featured clinics</strong> appear first and are clearly labelled "Featured". This is paid placement.</li>
<li><strong>Verified clinics</strong> are prioritised next.</li>
<li>Remaining clinics are ordered by their <strong>ranking score</strong>.</li>
</ul>
<p>The ranking score weighs:</p>
<ul>
<li>Average rating from approved, verified-eligible reviews</li>
<li>Number of reviews (more reviews, more signal)</li>
<li>Recency of recent reviews</li>
<li>Profile completeness (media, team, pricing, case studies)</li>
<li>Number and strength of verified accreditations</li>
<li>Listing tier</li>
</ul>
<h2>What verification means</h2>
<p>Verification is <strong>accreditation- and record-based</strong>. We check accreditations and registrations a clinic provides and confirm review authenticity where possible. Verification is <strong>not</strong> an endorsement of the safety or efficacy of any treatment, and it is not a clinical or regulatory approval.</p>
<h2>How reviews are handled</h2>
<p>Reviews require email verification and are moderated before they go live. We never publish a reviewer's email address, and reviewers may post anonymously as a "Verified Patient." Reviews reflect individual experiences; results vary.</p>
<h2>Paid placement</h2>
<p>Clinics can pay for Verified or Featured tiers. Paid placement is always labelled, and it never changes the content of patient reviews. See plans on the <a href="/for-clinics">for clinics</a> page.</p>
`;

const EDITORIAL_POLICY_BODY = `
<h2>Independence</h2>
<p>Editorial decisions are independent of advertising. Paid placement is always labelled "Featured" and never changes the content of patient reviews or our <a href="/methodology">ranking methodology</a>.</p>
<h2>Review moderation</h2>
<p>Reviews require email verification and are moderated before publishing. We remove spam, conflicts of interest, and content that can't be substantiated. We may lightly edit reviews to redact personal information or fix typos, without changing their meaning.</p>
<h2>Health claims</h2>
<p>We flag and do not publish language that promises a cure or guaranteed outcome. Treatment descriptions and case studies are labelled as provider- or patient-supplied, and we pair clinical content with the appropriate disclaimers.</p>
<h2>Who writes and reviews content</h2>
<p>Our editorial team compiles clinic profiles from the clinic's own published material, public registries and accreditation records, then checks the result with the clinic. Treatment and condition explainers are written in-house. Where the subject is clinical, a medically qualified reviewer reads the page and their name and credentials appear on it. That byline means they read it. It is not an endorsement of any clinic listed there.</p>
<h2>Sourcing</h2>
<p>Claims about what a therapy is, how it is given and what is known about it trace back to regulators, peer-reviewed literature or the clinic, and we say which. Where the evidence is thin, we write that it is thin instead of reaching for a stronger verb. We will not publish a success rate without saying where the number came from, and we do not repeat a clinic's marketing copy as though it were a finding.</p>
<h2>Keeping content current</h2>
<p>Prices, accreditations and treatment lists change. We recheck clinic records on a rolling schedule and after any correction, and pages with a reviewer byline carry the date they were last read. A clinic that closes or loses an accreditation gets its profile updated or pulled, not quietly left standing.</p>
<h2>Conflicts of interest</h2>
<p>Advertising and editorial are kept apart. Nobody who sells a listing has a say in how a clinic is described, scored or ordered, and paid placement is labelled everywhere it shows up. Our <a href="/methodology">ranking methodology</a> lists every input, so you can check the ordering instead of trusting it.</p>
<h2>Use of automated tools</h2>
<p>We use software to gather and structure data, flag prohibited health claims and catch errors. People write and check what gets published, and a human reviewer reads clinical pages before they go live. Nothing here ships straight from a generated draft.</p>
<h2>Corrections</h2>
<p>Spotted something inaccurate? Tell us via the <a href="/contact">contact page</a> and we'll review it promptly. We fix factual errors on the page itself. A clinic that disputes a published review can raise it the same way, though disagreeing with a review is not grounds for taking it down. Showing it is false is.</p>
`;

const MEDICAL_DISCLAIMER_BODY = `
<h2>Information only</h2>
<p>The content on ${SITE_NAME}, including clinic profiles, treatment descriptions, case studies, and patient reviews, is provided for general informational purposes only. It is <strong>not medical advice</strong>, diagnosis, or treatment, and it is not a substitute for the advice of a qualified healthcare professional.</p>
<h2>No endorsement or guarantee</h2>
<p>Listing or verification of a clinic does not constitute an endorsement of the safety or efficacy of any treatment. Regenerative and stem cell therapies may be experimental or unproven, and regulations vary by country. <strong>Individual results vary and no outcome is guaranteed.</strong></p>
<h2>Provider- and patient-supplied content</h2>
<p>Treatment descriptions and case studies are supplied by clinics or patients and are labelled as such. Reviews reflect individual experiences and are not typical or guaranteed.</p>
<h2>Regulatory status varies by country</h2>
<p>Many therapies described on this site are not approved by the FDA, the EMA or an equivalent regulator for the conditions patients ask about. What a clinic may legally offer changes from country to country, so a treatment that is routine in one place can be unavailable or unlawful in another. A clinic operating within its own country's rules has satisfied that regulator. Nothing more follows from it. That is not evidence a treatment is effective, and this site does not assess effectiveness.</p>
<h2>Prices are indicative</h2>
<p>The price ranges here come from the clinics and change without notice. Use them to compare, not as a quote. What you are actually charged depends on your diagnosis, the protocol, how many sessions are involved and what the clinic folds into its figure. Get the total, and what it covers, in writing from the clinic before you commit.</p>
<h2>Reviews are individual experiences</h2>
<p>A review describes what happened to one person. It is not a clinical outcome measure, it does not predict your result, and where there are only a handful of them a single review moves the average a long way. Read them for texture on communication, facilities and aftercare. Do not read them as proof a treatment works.</p>
<h2>Travelling for treatment</h2>
<p>Considering treatment abroad? Settle three things before you fly: who is responsible if a complication develops after you get back, what follow-up is included, and whether your own insurer or doctor will pick up the aftermath. Those answers are often what separates a manageable problem from an expensive one.</p>
<h2>Always consult a physician</h2>
<p>Never disregard professional medical advice or delay seeking it because of something you read on ${SITE_NAME}. Always consult a licensed physician before making any treatment decision. In a medical emergency, contact your local emergency services.</p>
`;

const PRIVACY_BODY = `
<h2>What we collect</h2>
<p>We collect the information you provide when you create an account, submit a review, request a consultation, or contact us, such as your name, email, and the details of your inquiry. We also collect limited usage analytics to improve the service.</p>
<h2>How we use it</h2>
<ul>
<li>To operate the directory and your account</li>
<li>To route consultation requests to the clinics you choose</li>
<li>To verify and moderate reviews</li>
<li>To improve our content and search</li>
</ul>
<h2>Reviews and health information</h2>
<p>Your reviewer email is <strong>never shown publicly</strong>. You may post reviews anonymously. We ask you to share only the health details you are comfortable disclosing and we minimise what we store.</p>
<h2>Sharing</h2>
<p>We share your contact details only with the clinics you choose to contact. We do not sell your personal information.</p>
<h2>Your rights</h2>
<p>You can access, correct, or delete your account and data at any time from your <a href="/account">account page</a> or by contacting us.</p>
<h2>Cookies</h2>
<p>We use essential cookies to keep you signed in and optional analytics cookies to understand usage. You can control cookies in your browser settings.</p>
<h2>Why we are allowed to hold it</h2>
<p>We process your information to run a service you asked for, such as your account or a consultation request going to a clinic; to meet a legal obligation; or because we have a legitimate interest in keeping the directory accurate and free of abuse. Where the law requires consent, as it does for optional analytics cookies, we ask for it, and you can withdraw it whenever you like.</p>
<h2>How long we keep it</h2>
<p>Account data lasts as long as your account and goes when you close it. A published review stays up after an account closes unless you ask us to take it down, because pulling it would leave a hole in a record other readers use. We hold consultation requests for as long as we might need them to settle a dispute about what was sent and to whom. Aggregated analytics that cannot be traced back to you may be kept indefinitely.</p>
<h2>Who else touches it</h2>
<p>Third parties host the site, send our email, process uploads and measure traffic. They act on our instructions and cannot use your data for their own ends. We do not sell personal information, and none of it goes to advertisers.</p>
<h2>Where it is processed</h2>
<p>Our providers may process data in countries other than the one you live in. When that happens we rely on the safeguards the law provides for those transfers.</p>
<h2>Children</h2>
<p>This service is for adults. You must be 18 or older to create an account, submit a review or send an inquiry, and we do not knowingly collect information from children.</p>
<h2>Changes and contact</h2>
<p>If this policy changes in any material way we will update the date above and email account holders about it. For questions about your data, or to ask for a copy or a deletion, use the <a href="/contact">contact page</a>.</p>
`;

const TERMS_BODY = `
<h2>Acceptance</h2>
<p>By using ${SITE_NAME}, you agree to these terms. If you don't agree, please don't use the service.</p>
<h2>Informational service</h2>
<p>${SITE_NAME} is an informational directory and not a medical provider. See our <a href="/medical-disclaimer">medical disclaimer</a>. We do not guarantee the accuracy of clinic-supplied information, and we do not endorse any treatment.</p>
<h2>Your content</h2>
<p>You must be 18 or older to submit a review or inquiry. You are responsible for the accuracy of what you submit, and you grant us a licence to publish moderated reviews. We may edit or remove content that violates these terms or our <a href="/editorial-policy">editorial policy</a>.</p>
<h2>Acceptable use</h2>
<ul>
<li>No false, misleading, or spam submissions</li>
<li>No content that infringes others' rights or privacy</li>
<li>No attempts to disrupt or abuse the service</li>
</ul>
<h2>Reviews and moderation</h2>
<p>We moderate reviews before they appear and may decline or remove one that breaks these terms or our <a href="/editorial-policy">editorial policy</a>. Clinics get no approval, edit or veto over what is written about them. A clinic that believes a review is false can raise it with us and we will look, but simply disagreeing with a review is not a reason to take it down. If you submit one, keep it to your own experience and leave out anyone else's personal or health information.</p>
<h2>Clinic listings</h2>
<p>Profiles include material the clinic supplied. We check what we reasonably can, and we do not warrant that any of it is accurate, complete or current. A listing is not an endorsement. Neither is a verification badge or a paid featured position, and none of the three says anything about whether a treatment is safe or works. Whatever you arrange with a clinic is a contract between you and them. We are not a party to it and we do not act as anyone's agent.</p>
<h2>Consultation requests</h2>
<p>Request a consultation and we pass your details to the clinics you picked so they can reply. What they do with the inquiry, and how they handle your data, falls under their policies rather than ours. We cannot guarantee a clinic will respond, or how fast.</p>
<h2>Intellectual property</h2>
<p>The site, its content and its design belong to us or our licensors. Read and share pages for personal use as much as you like. Copying the directory, scraping it, or reusing the content commercially needs our written permission first.</p>
<h2>Limitation of liability</h2>
<p>${SITE_NAME} is provided "as is." To the fullest extent permitted by law, we are not liable for decisions made based on information found here, for the acts or omissions of any clinic, or for any outcome of a treatment you arrange. Nothing in these terms limits liability that cannot lawfully be limited. Always consult a licensed physician.</p>
<h2>Changes and ending access</h2>
<p>We may update these terms. Carrying on using the site after a change means you accept the revised version. We may suspend or close an account that breaks them. You can walk away whenever you want and delete your account from your <a href="/account">account page</a>.</p>
`;

const FAQ_AFTER_BODY = `
<h2>Still deciding where to start</h2>
<p>Know your diagnosis? Start from <a href="/conditions">the condition list</a> and see who accepts patients for it. Know the procedure instead? Start from <a href="/treatments">the treatment list</a>. If cost or travel is what decides it, browse <a href="/locations">by destination</a>, or answer a few questions in the <a href="/find-a-clinic">guided match</a> and let it cut the directory down for you.</p>
<p>Before you lean on any ordering here, read how we <a href="/methodology">rank and verify clinics</a> and how we <a href="/editorial-policy">produce and moderate content</a>. The <a href="/medical-disclaimer">medical disclaimer</a> is worth five minutes too. It spells out what this site is not: not medical advice, not an endorsement of anyone listed, and no promise that an outcome described here will be yours.</p>
`;

const CONTACT_BODY = `
<h2>What we can help with</h2>
<p>Corrections to a clinic profile. Questions about how a listing or a review was handled. Press and partnership enquiries. Anything to do with your own account or data. If you are reporting something inaccurate, a link to the page plus a line on what is wrong is enough for us to start.</p>
<p>We reply by email, usually inside two working days. Corrections that affect something a page states as fact jump the queue.</p>
<h2>What we cannot help with</h2>
<p>Medical advice, in any form. We cannot recommend a treatment, tell you whether a therapy will work for your condition, or read a quote or a scan for you. Nobody here is your doctor, and answering those questions properly takes someone who knows your history. If you are weighing up clinics, take your shortlist and the questions from our <a href="/faq">FAQ</a> to someone who does.</p>
<p>We also cannot forward a message to a clinic outside the usual route. Use the consultation request on the clinic's own profile, which sends your details only to the clinics you pick. And if this is a medical emergency, call your local emergency services rather than filling in a form.</p>
<h2>Before you write</h2>
<p>The <a href="/faq">FAQ</a> already covers a lot of it. So does our <a href="/methodology">methodology</a>, on how clinics get ranked and verified, and the <a href="/editorial-policy">editorial policy</a>, on how reviews are moderated. Clinics after a listing should start on the <a href="/for-clinics">for clinics</a> page. What we do with whatever you send us is in the <a href="/privacy">privacy policy</a>.</p>
`;

const CONTACT_LISTING_BODY = `
<h2>What we can help with</h2>
<p>Send us the clinic name, where it operates, which regenerative therapies it offers and which accreditations it holds. We will come back with whatever else the profile needs, usually the issuing bodies behind your accreditations, the physicians who actually perform the procedures, and a price range you are comfortable publishing. Listing is reviewed rather than automatic, and we turn down clinics whose basic details we cannot verify.</p>
<p>We reply by email, usually inside two working days. Corrections that affect something a page states as fact jump the queue.</p>
<h2>What we cannot help with</h2>
<p>Medical advice, in any form. We cannot recommend a treatment, tell you whether a therapy will work for your condition, or read a quote or a scan for you. Nobody here is your doctor, and answering those questions properly takes someone who knows your history. If you are weighing up clinics, take your shortlist and the questions from our <a href="/faq">FAQ</a> to someone who does.</p>
<p>We also cannot forward a message to a clinic outside the usual route. Use the consultation request on the clinic's own profile, which sends your details only to the clinics you pick. And if this is a medical emergency, call your local emergency services rather than filling in a form.</p>
<h2>Before you write</h2>
<p>The <a href="/faq">FAQ</a> already covers a lot of it. So does our <a href="/methodology">methodology</a>, on how clinics get ranked and verified, and the <a href="/editorial-policy">editorial policy</a>, on how reviews are moderated. Clinics after a listing should start on the <a href="/for-clinics">for clinics</a> page. What we do with whatever you send us is in the <a href="/privacy">privacy policy</a>.</p>
`;

/** The 12 shipped FAQs. Also what feeds the page's `FAQPage` JSON-LD. */
const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: `Is ${SITE_NAME} a clinic or medical provider?`,
    answer: `No. ${SITE_NAME} is an independent directory. We provide information to help you research clinics and do not deliver care or give medical advice. Always consult a licensed physician.`,
  },
  {
    question: "How are clinics verified?",
    answer:
      "Verification is based on accreditation and record checks. It confirms credentials a clinic provides, and it is not an endorsement of any treatment's safety or efficacy. See our methodology page for details.",
  },
  {
    question: "Are the reviews real?",
    answer:
      "Reviews require email verification and are moderated before publishing. We never show a reviewer's email, and reviewers may post anonymously as a Verified Patient.",
  },
  {
    question: "Is the pricing accurate?",
    answer:
      "Pricing ranges are indicative and set by each clinic. Always confirm the final cost directly with the clinic before treatment.",
  },
  {
    question: "Does it cost anything to contact a clinic?",
    answer:
      "No. Requesting a consultation or getting matched is free for patients. We never sell your data; your details are shared only with the clinics you contact.",
  },
  {
    question: "How do I add or correct a clinic?",
    answer:
      "Clinics are curated by our team. If you represent a clinic or spot an error, reach out through our contact page.",
  },
  {
    question: "Does a listing mean the treatment works?",
    answer:
      "No. It means a clinic accepts patients for a condition and has a profile here. Most therapies described on this site have not been through the trials that would make them standard care for the conditions patients ask about, and some are legal in one country and not the next. We compare clinics. Whether a treatment is effective is not something we assess.",
  },
  {
    question: "Why do clinics abroad offer treatments my country does not?",
    answer:
      "Countries disagree on how much may be done to cells before they go back in. In the United States, culturing or expanding them crosses into drug territory, so domestic clinics mostly stick to minimally manipulated tissue. Several other countries allow expanded-cell protocols. The difference is regulatory rather than evidential, and it is the main reason people get on planes.",
  },
  {
    question: "What does the verified badge actually check?",
    answer:
      "The credentials and accreditations a clinic gives us, checked against the issuing bodies and public records, plus basic business and licensing details. It does not look at clinical outcomes and it is not an endorsement. The methodology page lists what is checked and what is not.",
  },
  {
    question: "How are clinics ordered in the directory?",
    answer:
      "The default order weighs verification status, how complete a profile is, published patient reviews, and how closely a clinic matches whatever filters you set. Paid placement is labelled Featured wherever it appears, and it changes nothing about a clinic's reviews, score or profile. You can re-sort any directory page yourself.",
  },
  {
    question: "Can a clinic remove a bad review?",
    answer:
      "No. Clinics get no approval, edit or veto over reviews. One that believes a review is false can raise it with us and we will look at the evidence, but disagreeing with a review is not grounds for pulling it. The reviews we do remove are the ones that break our content rules or that nobody can substantiate.",
  },
  {
    question: "What should I ask a clinic before booking?",
    answer:
      "Which cell source and preparation they would use for your condition. Who performs the procedure and what they are licensed to do. What the quoted total covers. What follow-up comes with it. Who is responsible if a complication develops once you are home. And what evidence supports that protocol for your diagnosis, rather than for the field in general.",
  },
];

const FIND_A_CLINIC_BODY = `
<h2>How the match works</h2>
<p>Four questions: what you are trying to treat, which treatment you have in mind if you already know, roughly what you can spend, and how far you will travel. From there it filters the directory to clinics that accept patients for your condition and orders what is left the same way <a href="/clinics">the main directory</a> does. Nothing you type is stored against your name, and using it does not contact anyone. You get a shortlist. What happens next is up to you.</p>
<p>That ordering is not a ranking of medical quality. It weighs verification status, how complete a profile is, published patient reviews, and how closely the clinic matches what you asked for. Paid placement is labelled wherever it turns up. The <a href="/methodology">methodology page</a> has the full breakdown.</p>
<h2>What to do with the shortlist</h2>
<p>Contact more than one clinic. Quotes for the same procedure vary a lot, and the difference between two of them is often what each one includes rather than the treatment itself. Put the same questions to each: which cell source and preparation they would use for your condition, who performs the procedure and what they are licensed to do, what the total covers, what follow-up comes with it, and what evidence supports that protocol for your diagnosis in particular.</p>
<p>Then take the answers to a doctor who knows your history. Most of these treatments are not approved for the conditions patients ask about, results differ from person to person, and we have not vetted any clinic here for clinical outcomes. Our job stops at listing and comparing. The decision is a medical one and it is not ours to make.</p>
<p>Prefer to browse yourself? Start from <a href="/conditions">a condition</a>, <a href="/treatments">a treatment</a>, or <a href="/locations">a destination</a>.</p>
`;

const TREATMENTS_BODY = `
<h2>How these treatments differ</h2>
<p>Nearly everything clinics call stem cell therapy varies along three axes: where the cells came from, how much was done to them in between, and how they get into you. Cells taken from your own body are autologous, and bone marrow and fat are the usual sources. Donor cells are allogeneic, most often from perinatal tissue such as umbilical cord or placenta. Stromal vascular fraction is what a clinic separates out of fat on the day. Exosomes are not cells at all, but the signalling particles cells release. Platelet-rich plasma is a blood product rather than a cell therapy, though you will see it listed alongside the rest.</p>
<p>Delivery matters as much as the source. An injection placed into one joint under ultrasound or fluoroscopy is a different proposition to an IV infusion meant to act on the whole body, and evidence for one does not carry over to the other. Orthopedic clinics mostly do the first. Longevity and autoimmune programmes mostly do the second.</p>
<h2>What the regulatory picture looks like</h2>
<p>In the United States, tissue that is only minimally manipulated and used for the same purpose it served in the donor sits outside the drug approval process. That is the space most American clinics work in. Culturing or expanding cells in a lab crosses the line into drug territory, so domestic clinics generally will not do it. Several countries do permit expanded-cell protocols, and that gap is a large part of why patients get on planes. What a clinic is allowed to offer tells you about the local rulebook, not about whether the treatment works.</p>
<p>Very few of these therapies have been through randomised trials large enough to settle the question for any one condition. Where published evidence exists it tends to be small, early, and tied to one specific preparation and one indication. So ask a clinic what supports the exact protocol it is proposing for you. Evidence for the field in general is not the same thing.</p>
<h2>Using this list</h2>
<p>Each treatment page covers what the therapy is, which clinics here offer it, the prices those clinics publish, and what patients have said. Starting from a diagnosis instead of a procedure? <a href="/conditions">Browse by condition</a>. Already decided you are willing to travel? <a href="/locations">Browse by destination</a>. The <a href="/find-a-clinic">guided match</a> works backwards from your condition, your budget and how far you will go.</p>
<p>None of this is medical advice, and a listing is not an endorsement. Read how we <a href="/methodology">rank and verify clinics</a> before you lean on the ordering, and take any treatment you are considering to a doctor who knows your history.</p>
`;

const CONDITIONS_BODY = `
<h2>What a condition page tells you</h2>
<p>A condition appears here because clinics in this directory accept patients for it. That is a much weaker claim than it might look. For most of the conditions below, cell therapy is not established treatment. Entries marked supportive are the clinic's own framing: they are offering something alongside standard care, not instead of it.</p>
<p>Each page shows which clinics treat the condition, what they charge, which therapies they use, and what patients treated for it have written. Where enough clinics take the same approach, the page links to a longer guide on that treatment and condition together.</p>
<h2>Where the evidence stands</h2>
<p>Orthopedics has the strongest published evidence. Injections into a knee, hip or shoulder have been studied reasonably often, though results still swing on the preparation used and who is holding the needle. Autoimmune, neurological and metabolic conditions are a different story. There are trials, some of them promising, and almost none have produced a result strong enough to make a therapy standard of care. Clinics treating those conditions are working out ahead of the evidence. That is legal in plenty of countries. It is not the same as effective.</p>
<p>Treat three things as warnings: a promised cure, a success rate quoted with no source, and one protocol that supposedly treats an unrelated list of conditions. Our <a href="/methodology">methodology page</a> sets out what we check and what we do not, and <a href="/for-clinics">clinics can tell us</a> when we have a listing wrong.</p>
<h2>Starting somewhere else</h2>
<p>Know which procedure you are researching? <a href="/treatments">Browse by treatment</a>. If cost or travel is what decides it, <a href="/locations">browse by destination</a>, or answer a few questions in the <a href="/find-a-clinic">guided match</a> and let it narrow things down. Whichever way in you take, get the shortlist in front of a doctor who knows your case before you commit to anything.</p>
`;

const LOCATIONS_BODY = `
<h2>Why patients travel for this</h2>
<p>Usually one of two reasons. The first is what a country permits. Rules on culturing and expanding cells differ enough that a protocol which is routine in one place cannot legally be offered in another, so anyone set on an expanded-cell treatment often has to leave home for it. The second is money. The same procedure can cost several times as much in one country as another, and when insurance covers none of it, that gap decides plenty of cases on its own.</p>
<p>Neither reason tells you anything about quality. A permissive regulator is not a careless one. An expensive clinic is not automatically a good one. What actually changes when you travel is how much of the checking lands on you.</p>
<h2>What to check before you book abroad</h2>
<ul>
<li>Who performs the procedure, what they are licensed to do in that country, and whether you will meet them before the day.</li>
<li>Where the cells come from, how they are processed, and which lab does it. Ask for the lab's certifications, not only the clinic's.</li>
<li>What the price covers. Ask outright whether consultation, imaging, the procedure, follow-up doses and accommodation are inside the number or outside it.</li>
<li>What happens if something goes wrong once you are home, who you call, and whether any of it is covered.</li>
<li>Whether your own doctor has seen the proposed protocol and thinks it is reasonable for your case.</li>
</ul>
<h2>Using these pages</h2>
<p>Each destination page lists the clinics we have on file in that country, which cities they are in, what they charge and what they offer, plus any longer guides written for that country and treatment together. One caveat on the numbers: a clinic count reflects what we have published, not the size of a country's market. A low number means we list few clinics there, not that few exist.</p>
<p>If the destination matters less to you than the procedure or the diagnosis, <a href="/treatments">browse by treatment</a> or <a href="/conditions">by condition</a> instead. Our <a href="/methodology">methodology</a> covers how clinics get ranked and verified. Everything here is research material, not medical advice.</p>
`;

// ── The registry ────────────────────────────────────────────────────────────

export const EDITABLE_PAGES: EditablePage[] = [
  // Content
  {
    path: "/about",
    label: "About",
    group: "Content",
    notes: {
      title: "The page H1.",
      lead: "The paragraph under the H1. Links are allowed.",
      blocks: "The page body.",
    },
    hasUpdated: true,
    hasLegalReview: true,
    hasBlocks: true,
    hasBlocksAfter: false,
    extras: [],
    title: `About ${SITE_NAME}`,
    lead: `${SITE_NAME} is an independent directory that helps patients research, compare, and connect with regenerative-medicine clinics worldwide.`,
    blocks: prose(ABOUT_BODY),
  },
  {
    path: "/methodology",
    label: "Methodology",
    group: "Content",
    notes: {
      title: "The page H1.",
      lead: "The paragraph under the H1. Links are allowed.",
      blocks: "The page body.",
    },
    hasUpdated: true,
    hasLegalReview: true,
    hasBlocks: true,
    hasBlocksAfter: false,
    extras: [],
    title: "Ranking & verification methodology",
    lead: "Transparency matters in a sensitive medical category. Here's exactly how clinics are ranked, what verification means, and how paid placement is labelled.",
    updated: "June 2026",
    blocks: prose(METHODOLOGY_BODY),
  },
  {
    path: "/faq",
    label: "FAQ",
    group: "Content",
    notes: {
      title: "The page H1.",
      lead: "The paragraph under the H1. Links are allowed.",
      blocks:
        "Rendered as the accordion. Keep the FAQ block first: it is also what emits this page's FAQPage structured data.",
      blocksAfter: "Rendered below the accordion, above the footer.",
    },
    hasUpdated: false,
    hasLegalReview: false,
    hasBlocks: true,
    hasBlocksAfter: true,
    extras: [],
    title: "Frequently asked questions",
    lead: "Can't find what you're looking for? <a href=\"/contact\">Contact our team</a>.",
    blocks: [{ type: "faq", data: { title: undefined, items: FAQ_ITEMS } }],
    blocksAfter: prose(FAQ_AFTER_BODY),
  },
  {
    path: "/contact",
    label: "Contact",
    group: "Content",
    notes: {
      title: "The page H1.",
      lead: "The paragraph under the H1. Links are allowed.",
      blocks: "Rendered below the form, above the footer.",
    },
    hasUpdated: false,
    hasLegalReview: false,
    hasBlocks: true,
    hasBlocksAfter: false,
    extras: [
      {
        key: "asideTitle",
        label: "Sidebar heading",
        hint: "Above the email / phone / address list.",
        value: "Other ways to reach us",
      },
      {
        key: "asideEmpty",
        label: "Sidebar fallback",
        hint: "Shown when no contact details are set in Settings.",
        value: "Use the form and we'll reply by email.",
      },
      {
        key: "asideNote",
        label: "Sidebar footnote",
        multiline: true,
        value: `${SITE_NAME} is an informational directory, not a medical provider. For medical concerns, contact a licensed physician.`,
      },
      {
        key: "submitLabel",
        label: "Form button label",
        value: "Send message",
      },
    ],
    title: "Contact us",
    lead: "Questions, feedback, or a correction? Send us a message and we'll get back to you by email.",
    blocks: prose(CONTACT_BODY),
  },
  {
    path: "/contact/listing",
    label: "Contact (clinic listing)",
    group: "Content",
    variantOf: "/contact",
    variantWhen: "Shown at /contact?topic=listing, the link clinics arrive on.",
    notes: {
      title: "The page H1.",
      lead: "The paragraph under the H1. Links are allowed.",
      blocks: "Rendered below the form, above the footer.",
    },
    hasUpdated: false,
    hasLegalReview: false,
    hasBlocks: true,
    hasBlocksAfter: false,
    extras: [
      {
        key: "submitLabel",
        label: "Form button label",
        value: "Send message",
      },
    ],
    title: "Get your clinic listed",
    lead: "Tell us about your clinic and our team will set up your profile and confirm your accreditation details.",
    blocks: prose(CONTACT_LISTING_BODY),
  },
  {
    path: "/for-clinics",
    label: "For clinics",
    group: "Content",
    notes: {
      title: "The hero H1.",
      lead: "The paragraph under the hero H1. Links are allowed.",
      blocks: "Rendered between the hero and the pricing table.",
      blocksAfter: "Rendered below the pricing table.",
    },
    hasUpdated: false,
    hasLegalReview: false,
    hasBlocks: true,
    hasBlocksAfter: true,
    extras: [
      {
        key: "ctaPrimaryLabel",
        label: "Hero button (primary)",
        value: "Get listed",
      },
      {
        key: "ctaSecondaryLabel",
        label: "Hero button (secondary)",
        value: "See pricing",
      },
      {
        key: "pricingTitle",
        label: "Pricing heading",
        hint: "Above the plans grid. The plans themselves live in Plans.",
        value: "Listing plans",
      },
      {
        key: "pricingDescription",
        label: "Pricing description",
        multiline: true,
        value:
          "Start free and upgrade as you grow. Plans are display-only today, and our team activates your tier when you get listed.",
      },
      {
        key: "pricingNote",
        label: "Pricing footnote",
        multiline: true,
        value:
          "Pricing is indicative and shown for planning. Billing is handled by our team, and no payment is collected on this site.",
      },
    ],
    title: "Reach patients researching regenerative medicine",
    lead: "List your clinic, build trust with verification, and receive qualified consultation requests from patients who are ready to connect.",
    blocks: [
      {
        type: "featureGrid",
        data: {
          title: undefined,
          items: [
            {
              title: "Qualified inquiries",
              description:
                "Receive consultation requests and matched leads from patients filtered by condition, treatment, and budget.",
              icon: "Users",
            },
            {
              title: "Verified trust signals",
              description:
                "Showcase accreditations and earn a verified badge so patients can shortlist you with confidence.",
              icon: "ShieldCheck",
            },
            {
              title: "Discoverability",
              description:
                "Appear across treatment, condition, and destination pages built to rank in search.",
              icon: "TrendingUp",
            },
          ],
        },
      },
    ],
    blocksAfter: [
      {
        type: "cta",
        data: {
          title: "Ready to get listed?",
          body: "Tell us about your clinic and our team will set up your profile and confirm your accreditation details.",
          buttonLabel: "Contact our team",
          buttonHref: "/contact?topic=listing",
        },
      },
    ],
  },
  {
    path: "/find-a-clinic",
    label: "Find a clinic (wizard)",
    group: "Content",
    notes: {
      title: "The page H1.",
      lead: "The paragraph under the H1. Links are allowed.",
      blocks: "Rendered below the wizard.",
    },
    hasUpdated: false,
    hasLegalReview: false,
    hasBlocks: true,
    hasBlocksAfter: false,
    extras: [
      {
        key: "eyebrow",
        label: "Eyebrow badge",
        hint: "The small pill above the H1.",
        value: "Guided matching",
      },
    ],
    title: "Find a clinic that fits",
    lead: "Answer a few quick questions and we'll match you with accredited clinics by condition, treatment, location, and budget.",
    blocks: prose(FIND_A_CLINIC_BODY),
  },
  {
    path: "/reviews/new",
    label: "Write a review",
    group: "Content",
    notes: {
      title: "The page H1.",
      lead: "The paragraph under the H1. Links are allowed.",
      blocks: "Rendered below the form.",
      seo: "This page is noindex in code either way, so the toggle below changes nothing here.",
    },
    hasUpdated: false,
    hasLegalReview: false,
    hasBlocks: true,
    hasBlocksAfter: false,
    extras: [
      {
        key: "pickerTitle",
        label: "Clinic picker heading",
        hint: "Shown when the visitor arrives without a clinic.",
        value: "Which clinic would you like to review?",
      },
      {
        key: "pickerDescription",
        label: "Clinic picker description",
        multiline: true,
        value:
          "Search for the clinic you visited, open its profile, and choose “Write a review”.",
      },
    ],
    title: "Write a review",
    lead: "Your honest experience helps other patients. Reviews are checked by our team before they go live.",
  },

  // Directory
  {
    path: "/clinics",
    label: "Clinic directory",
    group: "Directory",
    notes: {
      title: "The page H1.",
      lead: "The paragraph under the H1. Links are allowed.",
      blocks: "Rendered below the results and pagination.",
      seo: "Applies to the clean /clinics URL. Filtered views (?treatment=, ?page=) are already noindex in code.",
    },
    hasUpdated: false,
    hasLegalReview: false,
    hasBlocks: true,
    hasBlocksAfter: false,
    extras: [],
    title: "Stem cell & regenerative-medicine clinics",
    lead: "Compare accredited clinics worldwide. Filter by treatment, condition, cell source, location, price, and verified patient reviews. Every result is ranked by our published methodology.",
  },
  {
    path: "/treatments",
    label: "Treatments hub",
    group: "Directory",
    notes: {
      title: "The page H1.",
      lead: "The paragraph under the H1. Links are allowed.",
      blocks: "Rendered below the treatment grid.",
    },
    hasUpdated: false,
    hasLegalReview: false,
    hasBlocks: true,
    hasBlocksAfter: false,
    extras: [],
    title: "Browse by treatment type",
    lead: "Explore the regenerative therapies clinics offer. Select a treatment to see clinics, pricing ranges, and verified patient reviews.",
    blocks: prose(TREATMENTS_BODY),
  },
  {
    path: "/conditions",
    label: "Conditions hub",
    group: "Directory",
    notes: {
      title: "The page H1.",
      lead: "The paragraph under the H1. Links are allowed.",
      blocks: "Rendered below the condition grid.",
    },
    hasUpdated: false,
    hasLegalReview: false,
    hasBlocks: true,
    hasBlocksAfter: false,
    extras: [],
    title: "Browse by condition",
    lead: "Select a condition to see clinics that treat it, the treatments they offer, and verified patient experiences.",
    blocks: prose(CONDITIONS_BODY),
  },
  {
    path: "/locations",
    label: "Destinations hub",
    group: "Directory",
    notes: {
      title: "The page H1.",
      lead: "The paragraph under the H1. Links are allowed.",
      blocks: "Rendered below the destination grid.",
    },
    hasUpdated: false,
    hasLegalReview: false,
    hasBlocks: true,
    hasBlocksAfter: false,
    extras: [],
    title: "Browse by destination",
    lead: "Many patients travel for regenerative care. Explore clinics by country and compare accredited providers in each destination.",
    blocks: prose(LOCATIONS_BODY),
  },
  {
    path: "/search",
    label: "Site search",
    group: "Directory",
    notes: {
      title:
        "The H1 shown before a query is typed. With a query the H1 becomes the query itself.",
      lead: "The paragraph under the H1. Links are allowed.",
      blocks: "Rendered below the results.",
      seo: "Applies to the bare /search landing. Every ?q= results page is already noindex in code.",
    },
    hasUpdated: false,
    hasLegalReview: false,
    hasBlocks: true,
    hasBlocksAfter: false,
    extras: [
      {
        key: "emptyTitle",
        label: "No-results heading",
        value: "No results found",
      },
      {
        key: "emptyDescription",
        label: "No-results description",
        multiline: true,
        value:
          "Try a different term, or browse clinics by treatment, condition, or destination.",
      },
    ],
    title: "Search",
    lead: "Search across clinics, treatments, and conditions.",
  },
  {
    path: "/blog",
    label: "Blog index",
    group: "Content",
    notes: {
      title: "The page H1.",
      lead: "The paragraph under the H1. Links are allowed.",
      blocks: "Rendered below the post grid and pagination.",
      seo: "Applies to page 1. Paginated pages (?page=2) keep their own generated title.",
    },
    hasUpdated: false,
    hasLegalReview: false,
    hasBlocks: true,
    hasBlocksAfter: false,
    extras: [
      {
        key: "emptyTitle",
        label: "Empty-state heading",
        value: "No posts yet",
      },
      {
        key: "emptyDescription",
        label: "Empty-state description",
        multiline: true,
        value: "New articles are on the way. Check back soon.",
      },
    ],
    title: "Blog",
    lead: `Guides, updates, and insights from the ${SITE_NAME} team.`,
  },

  // Legal
  {
    path: "/editorial-policy",
    label: "Editorial policy",
    group: "Legal",
    notes: {
      title: "The page H1.",
      lead: "The paragraph under the H1. Links are allowed.",
      blocks: "The page body.",
    },
    hasUpdated: true,
    hasLegalReview: true,
    hasBlocks: true,
    hasBlocksAfter: false,
    extras: [],
    title: "Editorial policy",
    lead: "Our standards for curating clinics, moderating reviews, and keeping content trustworthy.",
    updated: "June 2026",
    legalReview: true,
    blocks: prose(EDITORIAL_POLICY_BODY),
  },
  {
    path: "/medical-disclaimer",
    label: "Medical disclaimer",
    group: "Legal",
    notes: {
      title: "The page H1.",
      lead: "The paragraph under the H1. Links are allowed.",
      blocks: "The page body.",
    },
    hasUpdated: true,
    hasLegalReview: true,
    hasBlocks: true,
    hasBlocksAfter: false,
    extras: [],
    title: "Medical disclaimer",
    lead: `${SITE_NAME} is an informational directory, not a medical provider.`,
    updated: "June 2026",
    legalReview: true,
    blocks: prose(MEDICAL_DISCLAIMER_BODY),
  },
  {
    path: "/privacy",
    label: "Privacy policy",
    group: "Legal",
    notes: {
      title: "The page H1.",
      lead: "The paragraph under the H1. Links are allowed. Ships empty.",
      blocks: "The page body.",
    },
    hasUpdated: true,
    hasLegalReview: true,
    hasBlocks: true,
    hasBlocksAfter: false,
    extras: [],
    title: "Privacy policy",
    lead: "",
    updated: "June 2026",
    legalReview: true,
    blocks: prose(PRIVACY_BODY),
  },
  {
    path: "/terms",
    label: "Terms of service",
    group: "Legal",
    notes: {
      title: "The page H1.",
      lead: "The paragraph under the H1. Links are allowed. Ships empty.",
      blocks: "The page body.",
    },
    hasUpdated: true,
    hasLegalReview: true,
    hasBlocks: true,
    hasBlocksAfter: false,
    extras: [],
    title: "Terms of service",
    lead: "",
    updated: "June 2026",
    legalReview: true,
    blocks: prose(TERMS_BODY),
  },
  // ── Calculators ───────────────────────────────────────────────────────────
  //
  // Generated from `config/tools.ts` rather than typed out again, so the copy an
  // editor sees in the admin is the copy the page renders, and a new calculator
  // arrives in the CMS the moment it is added to the registry.
  //
  // Each tool ships two blocks: the explainer, then the FAQ. Splitting them is
  // what lets an editor rewrite one without touching the other, and the FAQ
  // block is the one that emits `FAQPage` JSON-LD, so keeping it a real block
  // rather than folding it into the prose is load-bearing for the structured
  // data as well as for the editing.
  {
    path: TOOLS_HUB.path,
    label: "Tools hub",
    group: "Tools",
    notes: {
      title: "The page H1.",
      lead: "The paragraph under the H1. Links are allowed.",
      blocks: "Rendered below the grid of tools.",
    },
    hasUpdated: false,
    hasLegalReview: false,
    hasBlocks: true,
    hasBlocksAfter: false,
    extras: [
      {
        key: "eyebrow",
        label: "Eyebrow badge",
        hint: "The small pill above the H1.",
        value: TOOLS_HUB.eyebrow,
      },
      {
        key: "intro",
        label: "Privacy line",
        hint: "Shown under the H1, above the tool grid.",
        value: TOOLS_HUB.intro,
      },
    ],
    title: TOOLS_HUB.heading,
    lead: TOOLS_HUB.lead,
    blocks: prose(TOOLS_HUB.body),
  },
  ...TOOLS.map((tool): EditablePage => ({
    path: toolPath(tool.slug),
    label: tool.name,
    group: "Tools",
    notes: {
      title: "The page H1.",
      lead: "The paragraph under the H1. Links are allowed.",
      blocks:
        "Rendered below the calculator: the explainer, then the FAQ. The FAQ block is what produces this page's FAQ structured data.",
    },
    hasUpdated: false,
    hasLegalReview: false,
    hasBlocks: true,
    hasBlocksAfter: false,
    extras: [
      {
        key: "eyebrow",
        label: "Eyebrow badge",
        hint: "The small pill above the H1.",
        value: tool.eyebrow,
      },
    ],
    title: tool.heading,
    lead: tool.lead,
    blocks: [
      ...prose(tool.body),
      {
        type: "faq",
        data: {
          title: "Common questions",
          items: tool.faqs.map((f) => ({
            question: f.question,
            answer: f.answer,
          })),
        },
      },
    ],
  })),
];

const BY_PATH = new Map(EDITABLE_PAGES.map((p) => [p.path, p]));

/** The registry entry for a path, or `undefined` if the route is not editable. */
export function editablePage(path: string): EditablePage | undefined {
  return BY_PATH.get(path);
}

/** Every shipped value for a route, as one object. */
export function pageDefaults(path: string): EditablePageDefaults {
  const entry = BY_PATH.get(path);
  return {
    title: entry?.title ?? "",
    lead: entry?.lead ?? "",
    updated: entry?.updated ?? "",
    legalReview: entry?.legalReview ?? false,
    blocks: entry?.blocks ?? [],
    blocksAfter: entry?.blocksAfter ?? [],
    extras: Object.fromEntries(
      (entry?.extras ?? []).map((e) => [e.key, e.value]),
    ),
  };
}

export const EDITABLE_PAGE_GROUPS: StaticPageGroup[] = [
  "Core",
  "Directory",
  "Content",
  "Tools",
  "Legal",
];
