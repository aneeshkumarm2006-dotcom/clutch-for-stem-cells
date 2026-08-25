/**
 * Builds the importer files for the "25-08 Additional sections" brief.
 *
 * Blog bodies are spliced into the STORED body read back by
 * `scripts/_dump-targets.ts`, so each `body` in the output is the complete new
 * document and the insertion point is verifiable before anything is written.
 *
 *   node scripts/_build-extra-sections-2026-08-25.mjs
 */
import fs from "node:fs";

const dump = JSON.parse(fs.readFileSync("scripts/_targets-dump.json", "utf8"));

/** Collapse an authored template literal down to the single line the CMS stores. */
const h = (s) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("");

/** Insert `html` immediately before `anchor` in `body`, failing loudly if absent. */
function insertBefore(key, anchor, html) {
  const body = dump[key].body;
  const at = body.indexOf(anchor);
  if (at === -1) throw new Error(`${key}: anchor not found -> ${anchor}`);
  return body.slice(0, at) + html + body.slice(at);
}

/** Replace everything from `from` up to (not including) `to`. */
function replaceBetween(key, from, to, html) {
  const body = dump[key].body;
  const a = body.indexOf(from);
  const b = body.indexOf(to);
  if (a === -1) throw new Error(`${key}: start anchor not found -> ${from}`);
  if (b === -1 || b < a) throw new Error(`${key}: end anchor not found -> ${to}`);
  return body.slice(0, a) + html + body.slice(b);
}

// ───────────────────────────── blog ─────────────────────────────────────────

const blog = {};

// 1. Healing timeline. The stored "Typical Recovery Timeline" list is the thin
//    version of exactly what the brief specifies, so it is replaced rather than
//    followed by a second timeline saying the same thing at more length.
const TIMELINE = h(`
<h2>Typical Recovery Timeline</h2>
<p>Most clinic websites answer this with a vague "results vary," which is not wrong but is not much use to anyone planning around a recovery. Based on the pattern reported across published case series, here is a more honest shape of what to expect.</p>
<p><strong>Weeks 1 to 2: often the roughest part, counterintuitively.</strong> Some swelling and soreness at the injection site is normal as the area reacts to the procedure itself. It is not a sign that something went wrong, and it is not yet related to whether the treatment is working.</p>
<p><strong>Weeks 3 to 6: the first real signal, if there is going to be one.</strong> Many patients report the initial inflammation subsiding and a modest, early improvement in pain. Nothing dramatic yet.</p>
<p><strong>Months 2 to 4: where most of the meaningful change tends to show up</strong> in the published data, once the regenerative process rather than the injection itself has had time to take effect.</p>
<p><strong>Months 6 to 12 and beyond: where the full effect, if any, is generally assessed.</strong> This is also why most credible clinics will not call a treatment a failure before the three to six month mark. It is simply too early to tell.</p>
<p>The honest caveat: a meaningful minority of patients across published studies report no noticeable improvement at all. That is not unique to stem cell therapy, and it is true of most orthopedic interventions short of surgery. But it is worth going in with that realistic range of outcomes rather than an assumption that something will definitely change.</p>
<p>Timelines also differ by joint. Our guides to <a href="/blog/stem-cell-therapy-for-hip-arthritis-benefits-safety-and-what-to-expect">stem cell therapy for hip arthritis</a> and <a href="/blog/can-stem-cell-therapy-help-with-knee-pain-and-joint-arthritis">stem cell therapy for knee pain and joint arthritis</a> cover what recovery looks like for each, and our <a href="/faq">frequently asked questions</a> cover what to ask a clinic before you book.</p>
`);

blog["how-long-do-stem-cells-take-to-work-understanding-the-healing-timeline"] = {
  _id: dump[
    "blog/how-long-do-stem-cells-take-to-work-understanding-the-healing-timeline"
  ]._id,
  body: replaceBetween(
    "blog/how-long-do-stem-cells-take-to-work-understanding-the-healing-timeline",
    "<h2>Typical Recovery Timeline</h2>",
    "<h2>Factors That Influence How Quickly Stem Cells Work</h2>",
    TIMELINE,
  ),
};

// 2. How stem cell therapy works. The brief's mechanism section belongs directly
//    after the stored "How Do Stem Cells Help?" summary it makes specific.
const MECHANISM = h(`
<h2>The mechanism, without the hand-waving</h2>
<p>A lot of explainer content on this topic stops at "stem cells help your body heal itself," which is true and explains almost nothing. Here is the more specific version.</p>
<p>Mesenchymal stem cells, the type used in almost all joint and orthopedic applications, do not typically turn directly into new cartilage or bone in meaningful quantities once injected. What the current research suggests is happening instead is mostly signaling: the injected cells release growth factors and anti-inflammatory proteins that recruit the body's own repair processes and calm the chronic inflammation often driving the pain in the first place.</p>
<p>That nuance matters, because it reframes what a realistic outcome looks like. You are not getting a cartilage refill. You are getting a biological nudge toward your own tissue managing inflammation and repair better than it currently does. That is a meaningfully different, and more honest, claim than "regrows your cartilage," a phrase worth being skeptical of if a clinic uses it without qualification.</p>
<p>For how this translates into an actual appointment, see <a href="/blog/what-to-expect-during-your-first-regenerative-medicine-consultation">what to expect during your first regenerative medicine consultation</a>. For the collection methods behind step two above, see <a href="/treatments/adipose-derived-therapy">adipose-derived therapy</a> and <a href="/treatments/bone-marrow-derived-therapy">bone marrow-derived therapy</a>.</p>
`);

blog[
  "how-stem-cell-therapy-works-a-step-by-step-guide-to-the-science-behind-regenerative-medicine"
] = {
  _id: dump[
    "blog/how-stem-cell-therapy-works-a-step-by-step-guide-to-the-science-behind-regenerative-medicine"
  ]._id,
  body: insertBefore(
    "blog/how-stem-cell-therapy-works-a-step-by-step-guide-to-the-science-behind-regenerative-medicine",
    "<h2>Conditions Being Studied</h2>",
    MECHANISM,
  ),
};

// 3. Stem cells vs PRP. Front-loaded above the definitions, because the decision
//    is what the query is actually asking for.
const PRP = h(`
<h2>The actual decision-making difference, not just a definitions table</h2>
<p>Most comparison pages on this topic list what each treatment is and stop there, leaving you to work out which one applies to you. Here is the more direct version.</p>
<p><a href="/treatments/prp">PRP</a> uses concentrated platelets from your own blood, with no stem cells involved at all, and works primarily by delivering a burst of growth factors to speed up the healing response your body already runs. It is simpler to prepare, usually a blood draw and a centrifuge inside 30 to 45 minutes, cheaper at roughly $500 to $1,500 per session in the United States, and it has a longer track record in mainstream orthopedic and sports medicine. It is genuinely common in professional sports at this point.</p>
<p>Stem cell therapy costs more, takes longer to prepare, and involves an actual cell population capable of a broader range of regenerative signaling rather than a growth-factor boost alone. Our <a href="/treatments/prp-vs-stem-cell-therapy">PRP vs stem cell therapy comparison</a> sets the two side by side on cost, recovery time and evidence quality, and our guide to <a href="/blog/how-much-do-stem-cell-injections-cost">how much stem cell injections cost</a> covers the current price ranges.</p>
<p>The practical pattern across clinics: PRP tends to get recommended first for mild to moderate cases, tendon injuries, and as a lower-cost starting point. Stem cell therapy tends to be reserved for more advanced joint degeneration, or for patients who have already tried PRP without enough improvement.</p>
<p>A combination is increasingly common. Many clinics now offer both in the same session, on the reasoning that PRP's growth factors may support the injected cells rather than the two approaches competing with each other. Where a clinic offers that, it is a reasonable middle ground to ask about rather than an automatic upsell to be suspicious of.</p>
`);

blog["stem-cells-vs-prp-what-s-the-difference-and-which-treatment-is-right-for-you"] =
  {
    _id: dump[
      "blog/stem-cells-vs-prp-what-s-the-difference-and-which-treatment-is-right-for-you"
    ]._id,
    body: insertBefore(
      "blog/stem-cells-vs-prp-what-s-the-difference-and-which-treatment-is-right-for-you",
      "<h2>What Is PRP Therapy?</h2>",
      PRP,
    ),
  };

// 4. Benefits & cost. Angled at the "is it worth it" decision rather than
//    repeating the cost breakdown the dedicated cost post already owns.
const WORTH_IT = h(`
<h2>Is it actually worth the cost? A more useful way to think about it</h2>
<p>This question shows up in search as literally "is stem cell therapy worth the cost," and the honest answer is that it depends entirely on what you are comparing it against, which most content on the topic skips over. Comparing it to doing nothing and living with the pain is a different calculation from comparing it to a surgery your insurance would actually cover.</p>
<p>A more useful frame. Stem cell therapy is generally worth considering when three things are true at once:</p>
<ul>
<li><p>You have mild to moderate joint degeneration rather than advanced, bone-on-bone arthritis.</p></li>
<li><p>You have already tried the more conservative and less expensive options, such as physical therapy, weight management, or PRP.</p></li>
<li><p>You are financially able to treat it as a self-pay medical expense rather than something you are stretching to afford, since it is rarely covered by insurance and no particular outcome is promised.</p></li>
</ul>
<p>If any of those three do not apply to your situation, it is worth talking it through with a clinic directly before spending anything. Our <a href="/find-a-clinic">clinic directory</a> and <a href="/methodology">methodology page</a> explain how we vet the providers we list, which is a reasonable starting point for that conversation, and our breakdown of <a href="/blog/how-much-do-stem-cell-injections-cost">what stem cell injections cost</a> covers where the money actually goes.</p>
`);

blog["understanding-stem-cell-therapy-benefits-cost"] = {
  _id: dump["blog/understanding-stem-cell-therapy-benefits-cost"]._id,
  body: insertBefore(
    "blog/understanding-stem-cell-therapy-benefits-cost",
    "<h2>Questions to Ask Before Stem Cell Treatments</h2>",
    WORTH_IT,
  ),
};

// 5. SMA. Sits after the stored evidence section and before the question list it
//    adds the single most important question to.
const SMA = h(`
<h2>Where the science actually stands for SMA specifically</h2>
<p>Spinal muscular atrophy is a genuinely different situation from the joint-pain research that dominates regenerative medicine, and it deserves to be treated that way rather than folded into general stem cell marketing language.</p>
<p>SMA is caused by a specific, identified genetic mutation affecting motor neurons, and it already has FDA-approved gene therapy and gene-modifying drugs on the market. This is one of the few areas in the field where a genuinely disease-modifying treatment already exists and is not experimental.</p>
<p>Stem cell therapy for SMA, by contrast, remains investigational. It is not a standard or FDA-approved treatment for SMA, and families researching it should treat it as a research-stage possibility rather than an established alternative to the approved gene therapies. This is a case where "speak to the neuromuscular specialist managing the approved treatment first" carries more weight than almost any other advice on this site.</p>
<p>If you are researching this for a family member, put one question to any clinic offering SMA treatment directly: are you operating under an FDA-registered clinical trial, searchable on clinicaltrials.gov, or offering this as a direct-to-consumer procedure? That distinction matters enormously for both safety oversight and for how seriously to weigh any claimed results. Our <a href="/faq">frequently asked questions</a> and <a href="/methodology">methodology page</a> cover the other questions worth putting to a provider before you commit.</p>
`);

blog["stem-cell-treatment-for-sma-what-patients-and-families-should-know"] = {
  _id: dump["blog/stem-cell-treatment-for-sma-what-patients-and-families-should-know"]
    ._id,
  body: insertBefore(
    "blog/stem-cell-treatment-for-sma-what-patients-and-families-should-know",
    "<h2>Questions to Ask Before Considering Stem Cell Therapy</h2>",
    SMA,
  ),
};

// ───────────────────────── taxonomy terms ───────────────────────────────────

/**
 * Hand-written em-dash rewrites for RETAINED stored copy, same convention as
 * `scripts/_strip-em-dashes.ts`: each `from` must appear verbatim or the build
 * aborts, because a silent skip would leave a banned dash in a block this file
 * is about to rewrite wholesale.
 */
const CARRIED_REWRITES = {
  "treatments/exosome-therapy": [
    {
      from: "<strong>exosomes</strong>—tiny extracellular vesicles released by cells—to support",
      to: "<strong>exosomes</strong>, tiny extracellular vesicles released by cells, to support",
    },
  ],
};

/** A term's stored blocks with the carried-copy rewrites above applied. */
function carried(key) {
  const blocks = JSON.parse(JSON.stringify(dump[key].blocks ?? []));
  for (const { from, to } of CARRIED_REWRITES[key] ?? []) {
    let hit = false;
    for (const b of blocks) {
      if (typeof b.data?.html === "string" && b.data.html.includes(from)) {
        b.data.html = b.data.html.split(from).join(to);
        hit = true;
      }
    }
    if (!hit) throw new Error(`${key}: rewrite target not found -> ${from}`);
  }
  return blocks;
}

/** Append a richText block to a term's stored blocks. */
const appended = (key, html) => [
  ...carried(key),
  { type: "richText", data: { html: h(html) } },
];

/** Splice a richText block in at `index` among a term's stored blocks. */
function splicedAt(key, index, html) {
  const blocks = carried(key);
  blocks.splice(index, 0, { type: "richText", data: { html: h(html) } });
  return blocks;
}

const treatments = {
  segment: "treatments",
  terms: [
    {
      slug: "autologous-therapy",
      blocks: appended(
        "treatments/autologous-therapy",
        `
<h2>Autologous therapy: the one term worth actually understanding</h2>
<p>If a single word separates a straightforward regenerative treatment from a legally murkier one, it is this one. Autologous means the cells come from your own body: collected, minimally processed, and put back into you in the same procedure, usually the same day.</p>
<p>That matters beyond the science. In the United States, autologous procedures meeting the FDA's "minimal manipulation" and "homologous use" standards can generally be offered without the years-long clinical trial process required for drugs, which is exactly why most US clinics offering stem cell joint injections use autologous cells.</p>
<p>The alternative is allogeneic therapy: cells from a donor rather than yourself, whether from umbilical cord tissue, donated bone marrow, or a cell bank. Allogeneic products face a stricter regulatory path in the United States because they are treated more like a drug than a same-day procedure. That is part of why you will see more allogeneic and expanded-cell options at clinics outside the US, where the regulatory framework differs.</p>
<p>Why the distinction should matter to you: it is one of the clearest, most concrete questions you can put to any clinic to sort out what you are actually being offered. "Are these my own cells, and are they being expanded or cultured outside my body before they go back in?" A clinic that cannot answer that clearly and specifically is worth being cautious about.</p>
<p>For the most common ways autologous cells are collected, see our pages on <a href="/treatments/adipose-derived-therapy">adipose-derived therapy</a>, taken from fat tissue, <a href="/treatments/svf">SVF</a>, the unprocessed fat-tissue fraction, and <a href="/treatments/bone-marrow-derived-therapy">bone marrow-derived therapy</a>. All three are autologous. They differ in how much processing happens before injection. Our <a href="/faq">frequently asked questions</a> cover what else to ask before booking.</p>
`,
      ),
    },
    {
      slug: "cord-blood-therapy",
      blocks: appended(
        "treatments/cord-blood-therapy",
        `
<h2>Why cord blood and cord tissue are legally different</h2>
<p>This one is worth being extra clear about, because it is the treatment type most likely to raise regulatory questions if a clinic is not handling it correctly.</p>
<p>Cord blood and umbilical cord tissue are allogeneic. They come from a donor, with consent from the donating family, not from the patient. In the United States, cord-tissue-derived products are regulated more like biological drugs, and the FDA has specifically and repeatedly warned about clinics marketing unapproved cord-tissue products with exaggerated claims. This is one of the more scrutinized corners of the regenerative medicine industry.</p>
<p>That does not mean every cord tissue product is a problem. Some are legitimately manufactured under proper FDA registration, often marketed for their growth-factor and scaffolding properties rather than as a live stem cell product, a distinction some marketing blurs.</p>
<p>It does mean this is the category where pointed questions matter most. Is the product FDA-registered? Does the clinic disclose the manufacturer? Is it being marketed as containing living, functional stem cells, a claim that is harder to substantiate for processed cord tissue than for freshly collected <a href="/treatments/autologous-therapy">autologous cells</a>? Our <a href="/methodology">methodology page</a> explains what we check before listing a clinic, and our <a href="/faq">frequently asked questions</a> cover what to ask on a consultation call.</p>
`,
      ),
    },
    {
      slug: "exosome-therapy",
      blocks: appended(
        "treatments/exosome-therapy",
        `
<h2>Exosomes are not stem cells, and that distinction is the whole point</h2>
<p>This is one of the more commonly misunderstood treatments in the field, partly because it is often marketed alongside stem cell therapy without a clear explanation of what it actually is.</p>
<p>Exosomes are tiny vesicles that cells, including stem cells, release as a form of cellular communication. They carry proteins, growth factors, and genetic signaling material. They are not living cells, and they cannot divide or become new tissue the way a stem cell can.</p>
<p>The practical appeal is that because exosomes are acellular, they can be manufactured, processed and stored in ways living cell products cannot, including being derived from donor sources and shipped. That is part of why you will see exosome therapy offered as an add-on or an IV treatment more readily than cell-based options such as <a href="/treatments/svf">SVF</a> or other <a href="/treatments/autologous-therapy">autologous</a> approaches, which have to be collected from you on the day.</p>
<p>The tradeoff is that the evidence base is even earlier-stage than mesenchymal stem cell therapy itself. Claims about exosomes turning back the clock on aging, or treating a wide range of unrelated conditions, should be read with real skepticism, because the research to date is mostly preclinical or very early human data. Our <a href="/faq">frequently asked questions</a> cover how to press a clinic on what is actually in the product it is quoting you for.</p>
`,
      ),
    },
  ],
};

const conditions = {
  segment: "conditions",
  terms: [
    {
      slug: "joint-pain",
      // Second position: after "Understanding joint pain", before the stem cell
      // section, because narrowing the cause comes before evaluating treatment.
      blocks: splicedAt(
        "conditions/joint-pain",
        1,
        `
<h2>Not all joint pain is the same problem</h2>
<p>If you landed here searching generally for stem cell therapy for joint pain, it is worth narrowing down what is actually going on before you get much further, because the right treatment approach genuinely depends on the cause.</p>
<p>Osteoarthritis, where cartilage wears down over time, responds differently than a tendon or ligament injury, which in turn responds differently from inflammatory arthritis conditions such as rheumatoid arthritis, where the underlying issue is an overactive immune system rather than mechanical wear.</p>
<p>If your pain sits in one specific joint, our condition pages for <a href="/conditions/hip-osteoarthritis">hip osteoarthritis</a> and <a href="/conditions/knee-osteoarthritis">knee osteoarthritis</a> go into staging and treatment fit for each. If it is more systemic, affecting several joints or worse in the morning, that pattern is more consistent with <a href="/conditions/rheumatoid-arthritis">rheumatoid arthritis</a>, which is approached differently in this field than mechanical osteoarthritis. Our <a href="/treatments">treatments overview</a> breaks down what each regenerative option actually involves.</p>
`,
      ),
    },
  ],
};

// /locations/usa currently has no editorial at all, so it renders the derived
// `DestinationContext` fallback. Editorial replaces that fallback outright (the
// same either/or every taxonomy route uses), so this is written as a complete
// section set rather than a single bolt-on paragraph: the brief's US regulatory
// explainer, plus a US-specific version of the pre-treatment checks the fallback
// was carrying, plus FAQs.
const locations = {
  segment: "locations",
  terms: [
    {
      slug: "usa",
      blocks: [
        {
          type: "richText",
          data: {
            html: h(`
<h2>What is actually different about getting treated in the United States</h2>
<p>If you are specifically looking for US-based options rather than treatment abroad, the main thing worth understanding upfront is the regulatory ceiling. The FDA currently restricts US clinics to minimally-manipulated, autologous, same-day procedures for orthopedic use. Our page on <a href="/treatments/autologous-therapy">autologous therapy</a> explains what that means in practice.</p>
<p>This is why you will not find expanded or cultured cell treatments, or donor-derived cord tissue products marketed as stem cell therapy, at a compliant US clinic. Those fall outside what is currently permitted without going through the FDA drug approval pathway.</p>
<p>It is not necessarily a limitation. Same-day autologous treatment has the most straightforward safety profile of any approach on this site, because there is no outside lab processing and no donor material involved.</p>
<p>It does mean that if you have read about higher-dose, lab-expanded treatments, which are more common in Mexico, Panama and parts of Asia, you are unlikely to find an equivalent US option. Any US clinic claiming to offer one is worth questioning closely. Browse specific providers in our <a href="/find-a-clinic">clinic directory</a>, or compare treatment approaches country by country on our <a href="/locations">destinations page</a>.</p>
`),
          },
        },
        {
          type: "checklist",
          data: {
            title: "What to check before treatment at a US clinic",
            intro:
              "A clinic operating legally in the United States has satisfied the FDA's rules on what may be done to cells before they go back in. That is all it tells you. It is not evidence the treatment works, so the checking a drug approval process would have done falls to you instead.",
            items: [
              "Are these my own cells, and are they collected, processed and reinjected in the same visit? A compliant US orthopedic protocol answers yes to both.",
              "Who performs the procedure, and what is their specialty? Regenerative injections are offered by physicians from a wide range of backgrounds.",
              "Is the injection done under ultrasound or fluoroscopic guidance? For deeper joints such as the hip, this changes how accurately the cells land.",
              "What does the quote include? Consultation, imaging, the procedure and follow-up visits are often priced separately.",
              "Is the clinic making claims the FDA has warned about, such as treating unrelated systemic conditions with an orthopedic product?",
              "What happens if a complication develops later, and who is responsible for treating it?",
            ],
            footnote:
              "Run the answers past a doctor who knows your history before you commit. Our methodology page explains how we rank and verify the clinics listed here.",
          },
        },
      ],
      faqs: [
        {
          question: "Is stem cell therapy legal in the United States?",
          answer:
            "Minimally-manipulated, autologous, same-day procedures are offered legally at US clinics for orthopedic use. Expanded or cultured cell products, and donor-derived cord tissue products marketed as stem cell therapy, fall outside what the FDA currently permits without going through the drug approval pathway.",
        },
        {
          question:
            "Why do US clinics not offer lab-expanded or cultured stem cells?",
          answer:
            "Culturing cells to multiply their numbers takes the product beyond the FDA's minimal manipulation standard, which puts it on the drug approval pathway. That is why expanded-cell protocols are more commonly found in countries such as Mexico, Panama and Thailand than at a compliant US clinic.",
        },
        {
          question: "How much does stem cell therapy cost in the United States?",
          answer:
            "US clinics performing minimally-manipulated, same-day autologous procedures generally quote in the region of $4,000 to $10,000 per joint, though what you are actually charged depends on the condition, the protocol, and how many sessions are recommended. Ask specifically whether imaging guidance and follow-up visits are included in the quoted price.",
        },
        {
          question: "Is stem cell therapy covered by insurance in the US?",
          answer:
            "Almost never, because it is not FDA-approved for orthopedic use. Most patients pay out of pocket, which is one of the reasons some research treatment abroad.",
        },
      ],
      reviewStatus: "approved",
    },
  ],
};

// ───────────────────────────── write ────────────────────────────────────────

const files = {
  "scripts/extra-sections-blog-2026-08-25.json": blog,
  "scripts/extra-sections-treatments-2026-08-25.json": treatments,
  "scripts/extra-sections-conditions-2026-08-25.json": conditions,
  "scripts/extra-sections-locations-2026-08-25.json": locations,
};

const DASHES = "—–―‒−";
for (const [path, data] of Object.entries(files)) {
  const json = JSON.stringify(data, null, 2);
  const bad = json.match(new RegExp(`.{0,60}[${DASHES}].{0,60}`, "g"));
  if (bad) {
    console.error(`x ${path}: dash policy violation`);
    bad.forEach((b) => console.error(`    ${b}`));
    process.exit(1);
  }
  fs.writeFileSync(path, json + "\n");
  console.log(`ok ${path}`);
}
