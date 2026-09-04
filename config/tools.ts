/**
 * Tools registry — every calculator under `/tools`, and all of its copy.
 *
 * One entry per tool drives five things at once, which is the point: the hub
 * card, the route's H1 and lead, the explainer and FAQ rendered under the
 * widget, the `<title>` and meta description (via `config/static-pages.ts`), and
 * the CMS fields at `/admin/content/site-pages` (via `config/editable-pages.ts`).
 * Adding a calculator means adding an entry here and one small route file, and
 * everything else follows.
 *
 * On the copy being long: a calculator with a widget and forty words around it
 * is the definition of a thin page, and thin pages do not rank no matter how
 * good the widget is. The explainer under each tool answers what the number
 * means, what it cannot tell you, and why somebody researching regenerative
 * medicine would want it, because that is the part a search engine and a reader
 * are both there for.
 *
 * No server-only imports, no React, no block types. The admin form and the
 * public pages both read this, and `config/editable-pages.ts` is what turns the
 * `body` HTML and `faqs` below into the block compositions those pages render.
 */

export type ToolCategory =
  "Cost and budget" | "Candidacy" | "Symptom scores" | "Body metrics";

/** Icon key, resolved to a lucide icon in `components/tools/tool-icon.tsx`. */
export type ToolIcon =
  | "calculator"
  | "plane"
  | "scale"
  | "clipboard"
  | "gauge"
  | "activity"
  | "flame"
  | "percent"
  | "ruler"
  | "droplet"
  | "stethoscope";

export interface ToolFaq {
  question: string;
  answer: string;
}

export interface ToolDef {
  /** URL segment under `/tools`. */
  slug: string;
  /** Short name for cards, breadcrumbs and cross-links. */
  name: string;
  category: ToolCategory;
  icon: ToolIcon;
  /** One line on the hub card. */
  blurb: string;
  /** Shipped `<title>`, before the brand template. */
  title: string;
  /** Shipped meta description. */
  description: string;
  /** The pill above the H1. */
  eyebrow: string;
  /** The H1. */
  heading: string;
  /** The paragraph under the H1. */
  lead: string;
  /** Explainer HTML rendered below the calculator. */
  body: string;
  faqs: ToolFaq[];
  /** Slugs of other tools shown at the foot of this one. */
  related: string[];
}

/** Root path of the tools section. */
export const TOOLS_PATH = "/tools";

export const toolPath = (slug: string): string => `${TOOLS_PATH}/${slug}`;

// ── Hub copy ────────────────────────────────────────────────────────────────

export const TOOLS_HUB = {
  path: TOOLS_PATH,
  title: "Health and Cost Calculators",
  description:
    "Free calculators for people researching regenerative medicine, covering treatment cost, travel budget, candidacy screening, joint symptom scores and body metrics.",
  eyebrow: "Free tools",
  heading: "Calculators and tools",
  lead: "Work out what treatment is likely to cost, whether you fit the profile clinics treat, and how your symptoms score today. Nothing here asks for an email and no result is stored.",
  /** Intro rendered above the tool grid. */
  intro:
    "Every calculator runs in your browser. Numbers you type are not sent anywhere, and results are not saved between visits.",
  body: `
<h2>What these are for</h2>
<p>Researching a treatment you pay for yourself involves a lot of arithmetic that nobody does for you. What is this likely to cost once travel is in it. Am I even the sort of patient this is offered to. Is my knee bad enough to be worth it, or bad enough that the window has closed. These tools do that arithmetic and show their working.</p>
<p>The cost tools are built on prices published by clinics listed in this directory, so the starting figure is not a guess and you can click through to the profiles behind it. The screening and symptom tools encode what clinics ask on their own intake forms, which is a reasonable proxy for whether a consultation is worth booking.</p>
<h2>What they are not</h2>
<p>None of these is a diagnosis, and none replaces an examination. A score of 62 on a symptom questionnaire is a number to take to an appointment, not a decision. The candidacy tool can tell you that active cancer rules treatment out today because every reputable clinic screens for it, but it cannot tell you that a treatment will work, because for most of the conditions clinics advertise, nobody can say that yet.</p>
<p>Use them to arrive at a consultation with better questions and a realistic budget. That is genuinely worth something, and it is all a calculator can honestly offer.</p>
`,
} as const;

// ── Tools ───────────────────────────────────────────────────────────────────

export const TOOLS: ToolDef[] = [
  {
    slug: "stem-cell-cost-calculator",
    name: "Treatment cost calculator",
    category: "Cost and budget",
    icon: "calculator",
    blurb:
      "Estimate a course of treatment from prices clinics in this directory publish.",
    title: "Stem Cell Therapy Cost Calculator",
    description:
      "Estimate what stem cell therapy costs by treatment type, number of joints and destination, using prices published by clinics in our directory.",
    eyebrow: "Built on published clinic prices",
    heading: "Stem cell therapy cost calculator",
    lead: "Pick a treatment, how many areas you need treated and where you would go. The estimate starts from what clinics on this site actually publish, not from a made-up average.",
    body: `
<h2>Where the numbers come from</h2>
<p>The starting band for each treatment is taken from the price ranges published by clinics listed in this directory, in US dollars. The low figure is the 25th percentile of what those clinics quote at the bottom of their range, the high figure is the 75th percentile of their upper bounds, and the typical figure is the median midpoint. Percentiles rather than the raw minimum and maximum, so one unusually cheap or unusually expensive clinic does not stretch the whole band out of shape.</p>
<p>Every band shows how many clinics produced it. A band built from four clinics is a hint. A band built from thirty is close to a market rate. Where a treatment has too few published prices to stand on its own, the calculator falls back to the all-clinics band and tells you it has.</p>
<h2>How the adjustments work</h2>
<p>Two extra areas do not cost twice one area. The consultation, the cell harvest or vial preparation and the procedure time are paid once whichever joint is being injected, so each additional area is costed at roughly two thirds of the first. Repeat sessions are costed at four fifths, because a second session repeats most of the procedure but not the workup.</p>
<p>Choosing a destination scales the result by that country's median against the global median across the directory. That is a real effect and often a large one, but it is a price signal, not a quality signal.</p>
<h2>What a quote leaves out</h2>
<p>Clinic pricing is quoted for the procedure. Imaging, pre-treatment bloodwork, physiotherapy afterwards and follow-up appointments are frequently billed separately, and if you are travelling then flights and accommodation can add a third again on top. Price the trip, not the injection, and get in writing what a figure covers before you commit to it.</p>
`,
    faqs: [
      {
        question: "How much does stem cell therapy cost?",
        answer:
          "For a single joint, published prices from clinics in this directory typically land in the low-to-mid five figures in US dollars, with a wide spread by treatment type and country. Systemic or intravenous protocols usually cost more than a single local injection. Use the calculator above for a band based on the specific treatment and destination you are considering, and treat any figure as a starting point for a written quote.",
      },
      {
        question: "Is stem cell therapy covered by insurance?",
        answer:
          "Almost never. Most of these treatments are not approved by the FDA, the EMA or equivalent regulators for the conditions patients ask about, and insurers do not reimburse unapproved treatments. Assume you are paying privately unless your insurer has confirmed otherwise in writing.",
      },
      {
        question: "Why do prices vary so much between clinics?",
        answer:
          "Cell source is the biggest driver. Autologous treatments that harvest your own bone marrow or fat cost more to deliver than an off-the-shelf product. After that: how many cells are given, whether imaging guidance is used, whether the price includes follow-up, the country's cost base, and how the clinic positions itself. A higher price is not evidence of a better outcome.",
      },
      {
        question: "Does the estimate include travel?",
        answer:
          "No. This calculator prices the treatment only. The medical travel cost calculator adds flights, accommodation, daily spend and follow-up trips, which for an overseas treatment routinely comes to a quarter or more of the total.",
      },
      {
        question: "Are cheaper clinics abroad worse?",
        answer:
          "Not necessarily, and not automatically better either. Lower prices in many destinations reflect local staffing, facility and regulatory costs rather than corner-cutting. What matters is accreditation, who is performing the procedure, what happens if something goes wrong after you fly home, and whether the clinic will put its claims in writing. Price tells you none of that.",
      },
    ],
    related: [
      "medical-travel-cost-calculator",
      "stem-cell-vs-surgery-cost",
      "am-i-a-candidate",
    ],
  },
  {
    slug: "medical-travel-cost-calculator",
    name: "Medical travel cost calculator",
    category: "Cost and budget",
    icon: "plane",
    blurb:
      "Add flights, stay, daily spend and follow-ups to a quote to see the real total.",
    title: "Medical Travel Cost Calculator",
    description:
      "Add flights, accommodation, daily spend and follow-up trips to a treatment quote and see what travelling abroad for care actually costs.",
    eyebrow: "Total trip budget",
    heading: "Medical travel cost calculator",
    lead: "A treatment quote is the part of the bill that arrives first. This adds the rest, so you can compare a cheaper clinic further away against a dearer one closer to home on the same basis.",
    body: `
<h2>The number to look at</h2>
<p>Not the total. The share of the total that is not treatment. Once two people fly and stay two weeks, overheads of a quarter to a third of the trip are normal, and that is what decides whether a saving on the procedure survives contact with the itinerary. A clinic quoting several thousand less in a country that costs two thousand more to reach and stay in has saved you a good deal less than the quote suggests.</p>
<h2>What the lines cover</h2>
<p>Flights are return, per traveller. Accommodation is priced per night for the whole party, on the assumption you share a room or apartment. Daily spend covers food and local transport per person, and it is the line people most often forget when the stay runs into weeks rather than days.</p>
<p>Pre-travel extras are the one-off items: a visa, travel insurance that will actually cover a planned medical procedure, and any imaging or bloodwork the clinic asks for before you fly. Read the insurance wording closely, because many policies exclude planned treatment abroad and the complications that follow it.</p>
<p>Follow-up trips are costed as the same airfare plus a third of the original stay, which is what a review visit usually looks like. If your protocol involves several sessions weeks apart, this line is often the difference between the plan you budgeted and the one you end up on.</p>
<h2>The contingency line</h2>
<p>It defaults to ten percent because things move. A session gets added, recovery takes longer than planned and the flight home has to change, or aftercare turns out to be billed separately. Ten percent on a five-figure trip is not caution, it is the cost of one changed flight and a few extra nights.</p>
<h2>Before you book anything</h2>
<p>Settle three questions in writing. Who is responsible if a complication develops after you get home. What follow-up is included in the quoted price. Whether your own doctor or insurer will pick up the aftermath of a procedure they did not authorise. The answers are often what separates a manageable problem from an expensive one.</p>
`,
    faqs: [
      {
        question: "How much extra should I budget on top of the treatment?",
        answer:
          "For an intercontinental trip with one companion and a stay of one to two weeks, plan on the non-treatment costs adding twenty to forty percent of the total. Regional travel with a short stay can come in under fifteen percent. The calculator gives you the figure for your own itinerary rather than a rule of thumb.",
      },
      {
        question: "Does travel insurance cover treatment abroad?",
        answer:
          "Standard travel insurance almost always excludes planned medical treatment and anything arising from it. Some specialist medical travel policies cover complications, usually with conditions about accreditation and the treatment being lawful where it is given. Read the exclusions before you rely on a policy, not after.",
      },
      {
        question: "Should I take someone with me?",
        answer:
          "For a procedure involving sedation, most clinics require it, and the practical case is strong even where it is optional. Add the second traveller to the calculator and see what it does to the total, then weigh that against travelling alone after a procedure that limits how well you can move.",
      },
      {
        question: "How many nights should I plan for?",
        answer:
          "Ask the clinic, because it varies from a two-day visit to several weeks for multi-session protocols. Then add buffer nights at the end. Flying the day after a procedure is common advice and a bad plan if anything is slower to settle than expected.",
      },
    ],
    related: [
      "stem-cell-cost-calculator",
      "stem-cell-vs-surgery-cost",
      "am-i-a-candidate",
    ],
  },
  {
    slug: "stem-cell-vs-surgery-cost",
    name: "Therapy vs surgery cost",
    category: "Cost and budget",
    icon: "scale",
    blurb:
      "Set a regenerative course against knee replacement, fusion and other surgery.",
    title: "Stem Cell Therapy vs Surgery Cost",
    description:
      "Compare the typical cost and recovery time of a regenerative course against knee replacement, hip replacement, rotator cuff repair and spinal fusion.",
    eyebrow: "Cost and recovery comparison",
    heading: "Stem cell therapy vs surgery cost",
    lead: "Surgery is the alternative most people are actually weighing this against. Here is what each costs, how long each takes to recover from, and where the comparison stops being useful.",
    body: `
<h2>Reading the comparison honestly</h2>
<p>Cost and recovery time are the two things that can be compared directly, so those are what the tool shows. What it cannot compare is the thing that matters most, which is how likely each option is to fix your problem. Joint replacement has decades of outcome registries behind it and known survivorship figures for the implant. Most regenerative protocols have observational studies, a handful of controlled trials, and a great deal of marketing. Those are not two comparable evidence bases, and a price comparison should not be read as though they are.</p>
<h2>Where a regenerative course genuinely competes</h2>
<p>In earlier disease, where surgery is not on the table yet and the honest surgical answer is come back in five years. A treatment that reduces pain for a period, in a joint that is not ready for replacement, is competing against waiting rather than against surgery, and the cost comparison changes shape accordingly.</p>
<p>It also competes for people who cannot have surgery soon, whether because of other health problems, work they cannot step away from, or age. Recovery time is a real cost, and a procedure with a two week recovery sits differently against one with six months of rehabilitation.</p>
<h2>Where it does not</h2>
<p>End-stage joint disease. When imaging shows bone on bone, most clinicians expect very little from an injection, and the money spent finding that out is money not spent on the operation that would have helped. Any clinic offering to treat an end-stage joint should be asked directly what result it expects and on what evidence.</p>
<h2>About the surgery figures</h2>
<p>They are indicative United States self-pay ranges, and the spread inside each one is real. List prices for the same operation vary several fold between hospitals in the same city, and what an insured patient actually pays has little relationship to the list price. Outside the United States the numbers are different again, and in single-payer systems the out-of-pocket cost may be nothing at all with a wait attached. Treat these as an order of magnitude and get a written quote for your own situation.</p>
`,
    faqs: [
      {
        question: "Is stem cell therapy cheaper than a knee replacement?",
        answer:
          "Usually yes on the single procedure, at typical directory prices against typical US self-pay knee replacement costs. That comparison assumes one course of treatment. If the effect wears off and is repeated every year or two, the lifetime figures converge, and a replacement that lasts fifteen to twenty years starts to look different. Ask any clinic how long its patients typically go before repeat treatment.",
      },
      {
        question: "Can stem cell therapy help me avoid surgery?",
        answer:
          "It may delay it for some people with earlier disease, and that is the outcome the more careful clinics describe. Avoiding surgery permanently is a much stronger claim and is not supported for advanced joint disease. If a clinic tells you a joint replacement will never be needed, ask what evidence that is based on.",
      },
      {
        question: "Which has the shorter recovery?",
        answer:
          "Injection-based regenerative treatment, by a wide margin. Most people are back to normal daily activity within days to a couple of weeks, against three to twelve months for a joint replacement or spinal fusion. Recovery time is one of the few advantages here that is not in dispute.",
      },
      {
        question: "Does insurance change the comparison?",
        answer:
          "Substantially. Surgery is usually covered and regenerative treatment usually is not, so an insured patient may be comparing a large private bill against a modest co-payment. Run the comparison on what each option would cost you personally, not on list prices.",
      },
    ],
    related: [
      "stem-cell-cost-calculator",
      "am-i-a-candidate",
      "knee-pain-score",
    ],
  },
  {
    slug: "am-i-a-candidate",
    name: "Candidacy checker",
    category: "Candidacy",
    icon: "clipboard",
    blurb:
      "Twelve screening questions covering what clinics ask before they accept a patient.",
    title: "Am I a Candidate for Stem Cell Therapy",
    description:
      "Answer 12 screening questions to see whether cell therapy fits your diagnosis, history and expectations, and what to raise at a consultation.",
    eyebrow: "Screening questions",
    heading: "Am I a candidate for stem cell therapy?",
    lead: "These are the questions clinics ask on their own intake forms, plus the ones they tend not to ask. Nothing is sent anywhere, and the result is a read on fit rather than a decision.",
    body: `
<h2>What the result means</h2>
<p>It is a read on whether you match the patient profile clinics in this field usually treat. It is not a prediction that treatment will work, which is a different question and one that mostly does not have an answer yet for the conditions clinics advertise.</p>
<p>Some answers stop the assessment rather than counting against it. An active cancer diagnosis or a current infection is not a mark against a strong profile that other answers can outweigh, it is a reason any responsible clinic will decline to treat you now. A scoring model that let those average out would be giving dangerous advice in a polite voice.</p>
<h2>The questions that carry the most weight</h2>
<p><strong>Do you have a diagnosis.</strong> Confirmed by imaging or a specialist, ideally within the last year. Without one, nobody can say whether treatment is appropriate, and a clinic willing to proceed anyway is skipping the step that decides everything else.</p>
<p><strong>How advanced it is.</strong> Reported results are strongest in earlier disease and weakest at end stage. This one cuts both ways: too early and conservative care has not been tried, too late and the window has closed.</p>
<p><strong>What you have already tried.</strong> Physiotherapy, medication, bracing and conventional injections come first. They are cheaper, better evidenced, and clinics will ask.</p>
<p><strong>What you expect.</strong> Scored deliberately. Someone expecting cartilage to regrow and the joint to be new again is going to be disappointed on the evidence as it stands, and a screening tool that stayed quiet about that would be setting them up for it.</p>
<h2>What to do with the flags</h2>
<p>Each flagged answer comes with a note. Take those to the consultation as questions rather than as reasons not to go. A clinic that answers them directly, in writing, and tells you when the answer is that nobody knows, is behaving the way you want a clinic to behave. One that talks around them has told you something useful too.</p>
`,
    faqs: [
      {
        question: "Who is not a candidate for stem cell therapy?",
        answer:
          "Anyone with an active cancer diagnosis or in active cancer treatment, and anyone with a current infection, particularly in the joint concerned. Beyond those, reputable clinics are cautious with uncontrolled diabetes, significant clotting disorders, pregnancy, and end-stage joint disease where an injection is unlikely to achieve anything. Your own doctor should be part of this decision.",
      },
      {
        question: "Is there an age limit?",
        answer:
          "Rarely a hard one. Overall health and the state of the joint matter far more than the year on your passport, and plenty of clinics treat patients in their seventies. What does change with age is the expected result, and some clinics report weaker responses from older autologous cell harvests.",
      },
      {
        question: "Do I need an MRI before a consultation?",
        answer:
          "It is the single most useful thing you can bring. Recent imaging lets a clinic tell you whether treatment is plausible for your joint rather than for a hypothetical one, and it protects you from being accepted for a procedure that was never likely to help.",
      },
      {
        question: "Will a clinic tell me if I am not a good candidate?",
        answer:
          "A good one will, and turning patients away is one of the more reliable signals you can look for. A clinic that accepts everyone who enquires is running a sales process rather than a screening process. Ask directly what proportion of enquiries it declines and why.",
      },
      {
        question: "Does my BMI affect whether I can be treated?",
        answer:
          "It can. Some clinics set a BMI ceiling for procedures under sedation, and higher body weight increases joint loading in ways that work against a result in weight-bearing joints. Check before you book travel rather than after.",
      },
    ],
    related: ["bmi-calculator", "knee-pain-score", "stem-cell-cost-calculator"],
  },
  {
    slug: "bmi-calculator",
    name: "BMI calculator",
    category: "Body metrics",
    icon: "gauge",
    blurb:
      "Metric or imperial, with the healthy range for your height and what it means for joints.",
    title: "BMI Calculator",
    description:
      "Work out your BMI in metric or imperial units, see the healthy weight range for your height, and what the result means for joint loading and treatment.",
    eyebrow: "Body mass index",
    heading: "BMI calculator",
    lead: "Enter your height and weight in whichever units you think in. You get the number, the band it falls in, and the weight range that would put you in the healthy band for your height.",
    body: `
<h2>How BMI is worked out</h2>
<p>Weight in kilograms divided by height in metres squared. Someone who is 1.75 m and 78 kg has a BMI of 78 divided by 3.0625, which is 25.5. The imperial version multiplies pounds over inches squared by 703 and arrives at the same place.</p>
<p>The World Health Organization bands for adults are under 18.5 underweight, 18.5 to 24.9 healthy weight, 25 to 29.9 overweight, and 30 upwards obese, split into three classes at 35 and 40.</p>
<h2>What it cannot tell you</h2>
<p>It has no way to distinguish muscle from fat. A rower and a sedentary person of the same height and weight get the same number, and only one of them should be worried by it. It also reads differently across populations. Several health bodies apply lower thresholds for people of South Asian, Chinese and other Asian descent because metabolic risk starts rising at a lower BMI. If the question you are really asking is what your weight is made of, the body fat calculator is closer to it.</p>
<h2>Why this matters for joints</h2>
<p>Weight in orthopaedics is not a vanity figure, it is load. Walking puts roughly three to four times body weight through the knee, so a kilogram on the scale is three or four at the joint, and stairs and running are higher again. That multiplier is the arithmetic behind the repeated finding that modest weight loss produces meaningful improvement in knee osteoarthritis pain, without anyone injecting anything.</p>
<p>It also decides what gets offered to you. Clinics performing procedures under sedation often set a BMI ceiling on safety grounds, and surgeons frequently ask for weight loss before agreeing to a joint replacement. If you are researching treatment for a knee, hip or ankle, this number will come up at the first consultation, so it is worth knowing before you get there.</p>
`,
    faqs: [
      {
        question: "What is a healthy BMI?",
        answer:
          "For adults, 18.5 to 24.9 on the World Health Organization scale. The calculator converts that band into an actual weight range for your height, which is more useful than the number itself. Lower thresholds are recommended for some populations, including people of South Asian and Chinese descent.",
      },
      {
        question: "Is BMI accurate for muscular people?",
        answer:
          "No. It measures weight against height and has no way to tell what the weight is made of, so people carrying a lot of muscle are routinely classified as overweight or obese while carrying very little fat. If that describes you, use the body fat calculator and a waist measurement instead.",
      },
      {
        question: "How does BMI affect stem cell treatment for knees?",
        answer:
          "Two ways. Higher body weight means more load through the joint, which works against any treatment aimed at reducing pain in a weight-bearing joint. And some clinics apply a BMI limit for procedures involving sedation. Ask about any limit before booking travel.",
      },
      {
        question: "How much weight would move me into the healthy band?",
        answer:
          "The calculator shows it. Enter your height and weight, and it gives the kilograms between where you are and the nearest edge of the healthy range for your height, along with the extra load that weight is putting through your knees.",
      },
      {
        question: "Does BMI apply to children?",
        answer:
          "Not in this form. Children and teenagers are assessed against age and sex percentile charts rather than fixed adult cut-points, so an adult BMI band means nothing for someone under 18. This calculator is for adults.",
      },
    ],
    related: [
      "body-fat-calculator",
      "ideal-weight-calculator",
      "am-i-a-candidate",
    ],
  },
  {
    slug: "knee-pain-score",
    name: "Knee pain and function score",
    category: "Symptom scores",
    icon: "activity",
    blurb:
      "Rate 24 everyday activities for a 0 to 100 score across pain, stiffness and function.",
    title: "Knee Pain and Function Score",
    description:
      "Rate knee pain, stiffness and daily function across 24 everyday activities for a 0 to 100 score you can track over time and take to a consultation.",
    eyebrow: "24 activities, three domains",
    heading: "Knee pain and function score",
    lead: "Rate how the last 48 hours have gone across pain, stiffness and the things you do every day. You get a score out of 100, broken down by domain, that means something when repeated in three months.",
    body: `
<h2>What this is, and what it is not</h2>
<p>It is a structured self-assessment covering the same three domains clinicians use for knee osteoarthritis: pain, stiffness, and difficulty with daily activity. Twenty-four items, each rated from none to extreme, normalised onto a 0 to 100 scale where higher means more symptoms.</p>
<p>It is not WOMAC. WOMAC is a licensed instrument and its item wording is not ours to reprint, so the questions here are written for this page. They cover the same activity domains in the same structure and on the same response scale, which makes the score comparable in shape but not identical to a formal one. If a clinician needs a WOMAC or a KOOS score, they will administer the real instrument.</p>
<h2>Why a number is worth having</h2>
<p>Because "a bit better, I think" is unusable and 58 down to 41 is not. Symptom recall is poor over months, and pain in particular is remembered against how you feel today rather than how you felt in March. A score taken before treatment and repeated at three and six months is the closest thing you get to an honest answer about whether something worked.</p>
<p>The domain breakdown is often more informative than the total. A knee that scores high on stiffness and low on pain is a different problem from one that scores the other way round, and a treatment that shifts function while leaving night pain untouched has told you something specific.</p>
<h2>What the bands mean</h2>
<p>Below 20 is minimal, symptoms are around but not shaping the day. From 20 to 40 is mild, showing up in particular activities. From 40 to 60 is moderate and is the range where a clinical assessment is worth arranging. Above 60 is severe, most listed activities affected, and the range in which surgical options are usually discussed. Above 80, see a clinician rather than working from anything you scored online.</p>
<h2>Taking it to an appointment</h2>
<p>Print or note the domain scores and the date. Clinicians take a dated, structured self-report seriously, and it saves the first ten minutes of the appointment being spent constructing one from memory.</p>
`,
    faqs: [
      {
        question: "Is this the WOMAC score?",
        answer:
          "No. WOMAC is a licensed instrument and its wording is not reproduced here. This questionnaire covers the same three domains, pain, stiffness and physical function, across the same number of items and on the same five-point scale, with wording written for this page. Use it to track yourself over time. For a formal score, a clinician will administer the validated instrument.",
      },
      {
        question: "What score means I need a knee replacement?",
        answer:
          "No score decides that on its own. Surgical decisions rest on imaging, examination, what has already been tried, your other health conditions and how much the knee is affecting your life. A high score is a reason to have the conversation, not an answer to it.",
      },
      {
        question: "How often should I retake it?",
        answer:
          "Before starting any treatment, then at three and six months. More often than monthly adds noise rather than signal, because normal week-to-week variation in knee symptoms is larger than most people expect.",
      },
      {
        question: "Does a lower score mean treatment worked?",
        answer:
          "It is evidence, not proof. Knee symptoms fluctuate on their own, they improve with activity changes and weight loss, and expectation affects reported pain substantially. A drop after treatment is encouraging and worth recording. It is not the same as knowing the treatment caused it.",
      },
      {
        question: "Can I use this for both knees?",
        answer:
          "Score them separately, one at a time, thinking about a single knee as you answer. Rating both together produces a number that describes neither.",
      },
    ],
    related: [
      "back-pain-disability-score",
      "am-i-a-candidate",
      "stem-cell-vs-surgery-cost",
    ],
  },
  {
    slug: "back-pain-disability-score",
    name: "Back pain disability score",
    category: "Symptom scores",
    icon: "stethoscope",
    blurb:
      "Ten sections on how back pain affects daily life, scored as a percentage.",
    title: "Back Pain Disability Score",
    description:
      "Ten questions on how back pain affects daily life, scored 0 to 100 percent, with what each band usually means for treatment options.",
    eyebrow: "Ten sections, scored as a percentage",
    heading: "Back pain disability score",
    lead: "Pick the statement that fits you today in each of ten areas of daily life. The result is a percentage disability score, the same shape of measure used to track back pain in clinic.",
    body: `
<h2>How it is scored</h2>
<p>Ten sections, each with six statements running from no limitation to complete limitation, scored zero to five. The total out of fifty is expressed as a percentage. Fifty percent means back pain is limiting half of what the questionnaire measures.</p>
<p>Like the knee tool, this is written for this page rather than reproducing a licensed instrument. It follows the structure of a disability index and covers the same areas of daily life, so it tracks the same thing and moves the same way, but a clinician wanting a formal Oswestry score will administer the real questionnaire.</p>
<h2>What each band usually means</h2>
<p><strong>0 to 20 percent, minimal.</strong> Most people here are managed with activity advice, exercise and time. Bed rest is specifically not the answer, and the evidence on that is not close.</p>
<p><strong>20 to 40 percent, moderate.</strong> Sitting, lifting and standing are affected. Conservative care is still first line, and physiotherapy at this stage does more than most people expect.</p>
<p><strong>40 to 60 percent, severe.</strong> Pain is the main problem in daily life. This is where imaging and a specialist opinion are normally arranged, and where the more invasive options start being discussed.</p>
<p><strong>Above 60 percent.</strong> Pain intrudes on every area of life. This needs a clinician, promptly, and not an internet questionnaire.</p>
<h2>Signs that need attention now</h2>
<p>Some back pain symptoms are not a matter of scoring. Loss of bladder or bowel control, numbness around the groin or inner thighs, progressive weakness in a leg, or severe pain following a significant injury all need urgent medical assessment rather than a self-assessment score. If any of those apply, stop here and seek care today.</p>
<h2>Back pain and regenerative treatment</h2>
<p>Clinics offer cell therapy for degenerative disc disease and facet joint pain, among other back diagnoses. The evidence base is thinner than for knee osteoarthritis and the anatomy is harder, since a disc is a poorly vascularised structure that is difficult to deliver anything into and difficult to assess afterwards. Ask any clinic which specific diagnosis it is treating, what it expects to change, and how that change will be measured. A dated score before and after is one reasonable answer to the last part.</p>
`,
    faqs: [
      {
        question: "Is this the Oswestry Disability Index?",
        answer:
          "No. It follows the same ten-section structure and the same zero to five scoring, with statements written for this page rather than reproduced from the published instrument. It tracks the same thing and moves in the same way. A clinician needing a formal ODI score will use the validated version.",
      },
      {
        question: "What is a normal back pain disability score?",
        answer:
          "Below 20 percent is generally treated as minimal disability, which is where most people with ordinary episodic back pain sit. Anything above 40 percent means pain is dominating daily function and is worth a specialist assessment.",
      },
      {
        question: "When should I see a doctor urgently?",
        answer:
          "Loss of bladder or bowel control, numbness around the groin or inner thighs, progressive leg weakness, or severe pain after a significant injury all need same-day medical assessment. So does back pain with fever, or in anyone with a history of cancer. These are not questionnaire situations.",
      },
      {
        question: "Can stem cell therapy help back pain?",
        answer:
          "Some clinics offer it for degenerative disc disease and facet joint pain. The evidence is less developed than for knee osteoarthritis, and delivering anything into a disc and then measuring what happened is genuinely difficult. Ask for the specific diagnosis being treated and what published results exist for it.",
      },
    ],
    related: [
      "knee-pain-score",
      "am-i-a-candidate",
      "stem-cell-cost-calculator",
    ],
  },
  {
    slug: "bmr-calculator",
    name: "BMR and TDEE calculator",
    category: "Body metrics",
    icon: "flame",
    blurb:
      "Resting metabolic rate by Mifflin-St Jeor, then daily burn by activity level.",
    title: "BMR and TDEE Calculator",
    description:
      "Calculate resting metabolic rate with the Mifflin-St Jeor equation, then daily calorie burn by activity level, with targets for loss, maintenance and gain.",
    eyebrow: "Mifflin-St Jeor",
    heading: "BMR and TDEE calculator",
    lead: "Your basal metabolic rate is what you burn doing nothing. Multiply it by how you actually live and you get total daily energy expenditure, which is the number that decides whether weight moves.",
    body: `
<h2>The two numbers</h2>
<p><strong>BMR</strong> is what your body spends staying alive at complete rest: circulation, breathing, temperature, cell repair. For most adults it is between 60 and 70 percent of everything they burn in a day.</p>
<p><strong>TDEE</strong> is BMR multiplied by an activity factor, from 1.2 for desk-bound to 1.9 for a physical job or twice-daily training. That is the maintenance figure. Eat consistently below it and weight falls, above it and weight rises.</p>
<h2>Which equation</h2>
<p>Mifflin-St Jeor, published in 1990, is the default here because it predicts measured resting energy expenditure more accurately than the older Harris-Benedict equation in most adult populations. The calculator shows the Harris-Benedict figure alongside it so you can see the gap, which is usually small and occasionally not.</p>
<p>Both are population estimates. Individual metabolic rate varies by something like ten percent either side of a prediction for reasons including thyroid function, body composition and genetics. Treat the output as a starting point and adjust from what the scale actually does over three or four weeks.</p>
<h2>The activity multiplier is where people go wrong</h2>
<p>Almost everyone overestimates it. Three gym sessions a week alongside a desk job is lightly active, not very active. Very active means hard training six or seven days a week. If your weight is not moving on a deficit that should work, the multiplier is the first thing to check, before the calorie target.</p>
<h2>Why it appears on a regenerative medicine site</h2>
<p>Because weight loss is the intervention with the strongest evidence base for knee osteoarthritis pain, and it is free. Walking loads the knee at three to four times body weight, so a sustained deficit does more for a painful knee than most of what gets sold for it. Clinics that ask patients to lose weight before treating a weight-bearing joint are not stalling, they are improving the odds of the thing you are paying for.</p>
`,
    faqs: [
      {
        question: "What is the difference between BMR and TDEE?",
        answer:
          "BMR is what you burn at complete rest. TDEE is BMR multiplied by an activity factor and is what you burn in a real day, including moving around, exercising and digesting food. TDEE is the number to eat against.",
      },
      {
        question: "Which formula is most accurate?",
        answer:
          "Mifflin-St Jeor outperforms Harris-Benedict for most adults, which is why it is the primary figure here. Neither is exact for any individual, since prediction equations are built on population averages and real metabolic rates scatter around them by roughly ten percent.",
      },
      {
        question: "How many calories should I eat to lose weight?",
        answer:
          "A deficit of 500 kcal a day below TDEE corresponds to roughly half a kilogram a week, and 250 to about a quarter. Faster is not better: steeper deficits cost more lean mass and are harder to sustain, which matters if you are trying to protect the muscle supporting a painful joint.",
      },
      {
        question: "Why has my weight stopped moving on a deficit?",
        answer:
          "Usually the activity multiplier was too generous, intake has crept up, or both. Energy expenditure also falls somewhat as you lose weight, since a smaller body costs less to run. Recalculate at your current weight every five kilograms or so.",
      },
    ],
    related: [
      "bmi-calculator",
      "body-fat-calculator",
      "water-intake-calculator",
    ],
  },
  {
    slug: "body-fat-calculator",
    name: "Body fat calculator",
    category: "Body metrics",
    icon: "percent",
    blurb:
      "US Navy tape method, or a BMI estimate when you have no tape measure.",
    title: "Body Fat Percentage Calculator",
    description:
      "Estimate body fat percentage with the US Navy tape method, or from BMI without a tape measure, and see fat mass and lean mass in kilograms.",
    eyebrow: "Navy tape method",
    heading: "Body fat percentage calculator",
    lead: "Three tape measurements give a better read on body composition than weight alone. No tape measure to hand? Leave those fields blank and the calculator falls back to a BMI-based estimate.",
    body: `
<h2>How to take the measurements</h2>
<p><strong>Neck.</strong> Just below the larynx, tape sloping slightly down at the front. Do not flex.</p>
<p><strong>Waist.</strong> Men measure at the navel. Women measure at the narrowest point of the waist. Tape snug against skin but not compressing it, measured at the end of a normal exhale.</p>
<p><strong>Hips, women only.</strong> The widest point around the buttocks.</p>
<p>Measure at the same time of day each time, ideally in the morning before eating. A centimetre of error moves the result by roughly a percentage point, so consistency matters more than precision.</p>
<h2>How accurate it is</h2>
<p>The US Navy circumference method typically lands within three to four percentage points of a DEXA scan, which is enough to place you in a band and to track direction over time. It is not enough to argue about a single point. Where it struggles is with unusual fat distribution and with very lean or very heavy people, both of which sit outside the population it was fitted on.</p>
<p>Without tape measurements the calculator uses the Deurenberg equation, which estimates body fat from BMI, age and sex. It carries all of BMI's problems, including calling muscular people fat, so treat it as a rough placeholder rather than a measurement.</p>
<h2>What the bands mean</h2>
<p>Essential fat is the minimum the body needs to function, around 3 to 5 percent for men and 10 to 13 percent for women, and going below it is dangerous rather than impressive. The athletic and fitness bands above it describe what regular training tends to produce. The average band is where most of the adult population sits, and being in it diagnoses nothing.</p>
<h2>Why it is more useful than BMI</h2>
<p>Because it separates the two things BMI cannot. Lean mass is what supports and stabilises a joint, and fat mass is what loads it. Two people with the same BMI and a fifteen point difference in body fat are in genuinely different positions when it comes to a painful knee, and only one of those numbers can see it.</p>
`,
    faqs: [
      {
        question: "What is a healthy body fat percentage?",
        answer:
          "Roughly 14 to 24 percent for men and 21 to 31 percent for women covers the fitness and average bands used here. Women carry more essential fat than men, so the bands are set separately by sex.",
      },
      {
        question: "How accurate is the Navy method?",
        answer:
          "Within about three to four percentage points of a DEXA scan for most people, which is good enough for banding and for tracking. It is less reliable at the extremes of leanness and size, and for people whose fat distribution is unusual.",
      },
      {
        question: "Can I calculate body fat without a tape measure?",
        answer:
          "Yes, the calculator falls back to a BMI-based estimate using the Deurenberg equation. It is noticeably less accurate, particularly for muscular people, because it inherits everything BMI cannot see. Buy a tape measure if you plan to track this.",
      },
      {
        question: "Does body fat affect joint treatment outcomes?",
        answer:
          "Fat mass loads weight-bearing joints and adipose tissue is metabolically active in ways associated with systemic inflammation. Lean mass, meanwhile, supports the joint. Both directions matter for a knee or hip, which is why composition is a better question than weight alone.",
      },
    ],
    related: ["bmi-calculator", "bmr-calculator", "ideal-weight-calculator"],
  },
  {
    slug: "ideal-weight-calculator",
    name: "Ideal weight calculator",
    category: "Body metrics",
    icon: "ruler",
    blurb:
      "Four published formulas for your height, alongside the healthy BMI range.",
    title: "Ideal Weight Calculator",
    description:
      "Compare the Devine, Robinson, Miller and Hamwi formulas for your height, alongside the healthy BMI weight range clinicians actually use.",
    eyebrow: "Four formulas, one range",
    heading: "Ideal weight calculator",
    lead: "Four formulas have circulated as ideal body weight since the 1960s. Here is what each gives for your height, and why the healthy BMI range underneath them is the number worth using.",
    body: `
<h2>Where these formulas came from</h2>
<p>Not from research into what people should weigh. Hamwi in 1964 was a rule of thumb for insulin dosing in diabetes. Devine in 1974 was for calculating drug doses. Robinson and Miller in 1983 were refits of Devine against better data. All four are height-only, all four ignore build, age and body composition, and none was ever intended to describe a target weight for a person.</p>
<p>They survive because clinical pharmacy still uses them. Some drugs are dosed on ideal or adjusted body weight rather than actual weight, and Devine remains the standard for several of those calculations. That is a genuine use, and it is not this one.</p>
<h2>Use the range, not the number</h2>
<p>The healthy BMI window for your height, shown under the formulas, is what clinicians actually work with. It is a range rather than a point, typically spanning fifteen kilograms or more for an adult, and everywhere inside it is fine. A single kilogram figure implies a precision that nothing about human bodies supports.</p>
<p>Where you sit inside that range reasonably depends on build and on how much muscle you carry. Someone lifting seriously may sit at the top of it or above it at a low body fat percentage, which is a limitation of BMI rather than a problem with them.</p>
<h2>If you are trying to reduce joint pain</h2>
<p>The target that matters is not an ideal weight, it is a change from where you are now. Sustained loss of five to ten percent of body weight is associated with clinically meaningful improvement in knee osteoarthritis pain, and that holds whether or not it lands you anywhere near a formula's output. Someone at 110 kg who reaches 100 kg has done the thing the evidence supports, regardless of what Devine says about their height.</p>
`,
    faqs: [
      {
        question: "Which ideal weight formula is best?",
        answer:
          "For dosing certain drugs, Devine, because that is what the protocols specify. For describing what a person should weigh, none of them. They are height-only equations from the 1960s to 1980s that were built for other purposes. The healthy BMI range is the better answer.",
      },
      {
        question: "Why do the four formulas disagree?",
        answer:
          "They were fitted to different data for different purposes at different times. The spread between them for the same height is usually five to eight kilograms, which is a fair indication of how much precision to read into any single one.",
      },
      {
        question: "Should I aim for my ideal weight before treatment?",
        answer:
          "Aim for a percentage change instead. Five to ten percent of body weight lost and kept off is the target with evidence behind it for knee osteoarthritis pain, and it is achievable from any starting point. A clinic asking for weight loss before treating a weight-bearing joint is usually asking for something like that, not for a formula's number.",
      },
      {
        question: "Do these formulas work for very tall or short people?",
        answer:
          "Poorly. All four extrapolate linearly from a five-foot baseline and were fitted on populations near average height, so they drift at both extremes. The BMI range handles the tails somewhat better, though it has its own problems there.",
      },
    ],
    related: ["bmi-calculator", "body-fat-calculator", "bmr-calculator"],
  },
  {
    slug: "water-intake-calculator",
    name: "Water intake calculator",
    category: "Body metrics",
    icon: "droplet",
    blurb:
      "Daily water from body weight, activity and climate, split by drink and food.",
    title: "Daily Water Intake Calculator",
    description:
      "Work out how much water to drink a day from body weight, activity minutes and climate, split between what you drink and what food provides.",
    eyebrow: "Weight, activity and climate",
    heading: "Daily water intake calculator",
    lead: "The eight glasses rule was never based on anything. This works from your body weight, how much you move and how hot it is, then separates what you need to drink from what food already provides.",
    body: `
<h2>How the figure is built</h2>
<p>A baseline of 35 ml per kilogram of body weight, plus 12 ml for every minute of exercise, scaled up by ten to twenty percent in warm or hot conditions. That gives total daily water. About a fifth of it arrives in food, more if you eat a lot of fruit, vegetables and soup, so the amount to actually drink is roughly four fifths of the total.</p>
<p>Coffee and tea count. The mild diuretic effect of caffeine at normal intakes does not offset the water in the cup, and that has been tested repeatedly. So do milk, juice and most soft drinks, though the sugar makes them a poor way to hydrate.</p>
<h2>Where the eight glasses figure came from</h2>
<p>A 1945 US Food and Nutrition Board recommendation of about 2.5 litres a day, immediately followed by a sentence noting most of it comes from prepared food. The sentence got dropped and the number stuck. It has been repeated for eighty years without ever having been the evidence-based rule people take it for.</p>
<h2>A better indicator than any calculator</h2>
<p>Urine colour. Pale straw means you are fine. Dark yellow means drink more. Completely clear all day means you are probably drinking more than you need, which is not harmful for most people but is not helping either. Thirst is also more reliable than it gets credit for in healthy adults under 65, and less reliable above that age, which is why older adults are advised to drink on a schedule rather than waiting for the signal.</p>
<h2>When to ignore this and ask a doctor</h2>
<p>Kidney disease, heart failure and some liver conditions come with fluid restrictions that override any general calculation, sometimes by a large margin. Certain medications change fluid balance too. If you have been given a fluid target by a clinician, that target wins and this calculator does not apply to you.</p>
<p>Before a procedure involving sedation, follow the clinic's fasting instructions rather than a hydration plan. They are specific for a reason.</p>
`,
    faqs: [
      {
        question: "How much water should I drink a day?",
        answer:
          "For most adults, somewhere between 1.6 and 3 litres of drinking water depending on body weight, activity and climate. The calculator gives the figure for your inputs. Fixed rules like eight glasses ignore that a 55 kg office worker and a 95 kg outdoor labourer have very different requirements.",
      },
      {
        question: "Does coffee count towards water intake?",
        answer:
          "Yes. At normal consumption the diuretic effect of caffeine does not cancel out the fluid in the drink, and studies comparing coffee against water find no meaningful difference in hydration status. Alcohol is the genuine exception.",
      },
      {
        question: "Can you drink too much water?",
        answer:
          "Yes, though it takes effort. Drinking large volumes rapidly can dilute blood sodium to dangerous levels, a condition called hyponatraemia, most often seen in endurance athletes over-drinking during long events. Spreading intake through the day rather than forcing litres at once avoids it entirely.",
      },
      {
        question: "Should I drink more before a medical procedure?",
        answer:
          "Follow the clinic's instructions, not a general calculator. Procedures involving sedation come with specific fasting rules covering both food and fluid, and they exist for safety reasons.",
      },
    ],
    related: ["bmr-calculator", "bmi-calculator", "body-fat-calculator"],
  },
];

// ── Lookups ─────────────────────────────────────────────────────────────────

const BY_SLUG = new Map(TOOLS.map((t) => [t.slug, t]));

export function toolBySlug(slug: string): ToolDef | undefined {
  return BY_SLUG.get(slug);
}

/** Every tool path, hub first. Used by the sitemap and the registries. */
export function toolPaths(): string[] {
  return [TOOLS_PATH, ...TOOLS.map((t) => toolPath(t.slug))];
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  "Cost and budget",
  "Candidacy",
  "Symptom scores",
  "Body metrics",
];

/** Tools grouped for the hub, in category order, skipping empty groups. */
export function toolsByCategory(): {
  category: ToolCategory;
  tools: ToolDef[];
}[] {
  return TOOL_CATEGORIES.map((category) => ({
    category,
    tools: TOOLS.filter((t) => t.category === category),
  })).filter((g) => g.tools.length > 0);
}

/** The related tools for a slug, resolved and with unknown slugs dropped. */
export function relatedTools(slug: string): ToolDef[] {
  const tool = BY_SLUG.get(slug);
  if (!tool) return [];
  return tool.related
    .map((s) => BY_SLUG.get(s))
    .filter((t): t is ToolDef => Boolean(t) && t!.slug !== slug);
}
