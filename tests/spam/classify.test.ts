/**
 * Public-form spam classifier — behavioural tests.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * THE **GENUINE** BLOCK MATTERS MORE THAN THE SPAM BLOCK.
 *
 * A future rule that breaks a case in GENUINE is wrong, however much junk it
 * catches. Every entry there is either a real submission pulled from this
 * site's database or a shape this business demonstrably sells to. Losing one of
 * them costs a customer; letting one spam message through costs five seconds in
 * the admin.
 *
 * If you are here because you added a rule and a GENUINE test went red: the
 * rule is the thing that is wrong. Narrow it until the test passes again.
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * The corpus note: at the time this filter was written this site had received
 * three leads (all internal tests or a one-word hello), 102 reviews (all
 * imported), and zero spam — so the SPAM block below is ported from a sibling
 * site's 62-submission corpus rather than observed here, and the GENUINE block
 * carries every real submission this site actually has. When real spam does
 * arrive, add it here verbatim.
 *
 * Run: npx tsx --tsconfig tsconfig.test.json --test tests/spam/classify.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  QUARANTINE_THRESHOLD,
  classifySubmission,
  extractHosts,
  foreignLinks,
  hasConsonantRun,
} from "@/lib/spam/classify";
import type { SubmissionInput } from "@/lib/spam/types";

const OPTS = {
  ownHosts: ["mystemcellguide.com"],
  whitelistDomains: ["davnoot.com", "mystemcellguide.com"],
};

/** Classify a lead, defaulting the stamp to a plausible human fill time. */
function score(
  input: Partial<SubmissionInput> & { message?: string },
): ReturnType<typeof classifySubmission> {
  return classifySubmission(
    { form: "lead", elapsedMs: 45_000, ...input },
    OPTS,
  );
}

const reasonCodes = (a: ReturnType<typeof classifySubmission>): string[] =>
  a.reasons.map((r) => r.code);

// ═══════════════════════════════════════════════════════════════════════════
// SPAM — must be caught
// ═══════════════════════════════════════════════════════════════════════════

test("SPAM: SEO agency cold pitch", () => {
  const a = score({
    name: "Mark Wilson",
    email: "mark@seogrowthpro.biz",
    message:
      "Hi, I was browsing your website and noticed it is not ranking on the first page of Google. We can help you increase your website traffic with our proven SEO strategy. Reply YES and I will send a free audit of your site.",
  });
  assert.equal(a.verdict, "reject");
  assert.equal(a.category, "outbound-pitch");
});

test("SPAM: link farm with several unrelated domains", () => {
  const a = score({
    name: "Anna",
    email: "anna@mail.ru",
    message:
      "Check these out: https://cheap-pills-online.xyz and http://casino-bonus.top and www.crypto-invest.site — best deals.",
  });
  assert.equal(a.verdict, "reject");
  assert.equal(a.category, "link-spam");
});

test("SPAM: retail discount blast", () => {
  const a = score({
    name: "Deals Team",
    email: "offers@megadeals.shop",
    message:
      "MEGA SALE! Get 50% OFF all supplements today only. FREE shipping worldwide. Use promo code SAVE50 at checkout. Order now while supplies last!",
  });
  assert.equal(a.verdict, "reject");
  assert.equal(a.category, "retail-promo");
});

test("SPAM: bulk-mail footer", () => {
  const a = score({
    name: "Newsletter",
    email: "no-reply@bulkmailer.io",
    message:
      "New partnership opportunities available. You are receiving this email because you subscribed to our list. To stop receiving these emails, click unsubscribe below.",
  });
  assert.equal(a.verdict, "reject");
  assert.equal(a.category, "bulk-mail");
});

test("SPAM: pushes to WhatsApp", () => {
  const a = score({
    name: "Investment Advisor",
    email: "advisor@quickprofit.online",
    message:
      "We offer guaranteed returns on crypto investment. Contact me on WhatsApp: +1 555 010 9988 for details.",
  });
  assert.equal(a.verdict, "reject");
});

test("SPAM: our own domain templated into the body", () => {
  const a = score({
    name: "Alex",
    email: "alex@webdesignhub.net",
    message:
      "Dear mystemcellguide.com owner, your website could look much better. Our team can redesign it for you. Visit https://webdesignhub.net/portfolio to see our work.",
  });
  assert.equal(a.verdict, "reject");
});

test("SPAM: honeypot filled is enough on its own", () => {
  const a = score({
    name: "Bot",
    email: "bot@example.org",
    message: "Hello, I would like information about treatment for my knee.",
    honeypot: "http://spam.example",
  });
  assert.equal(a.verdict, "reject");
  assert.equal(a.category, "bot-signature");
});

test("SPAM: keyboard mash", () => {
  const a = score({
    name: "asdfgh",
    email: "qwer@tyuio.com",
    message: "kjhgfdsa mnbvcxz qwrtplkjhgfd zxcvbnmqwrt",
  });
  assert.ok(a.verdict !== "allow");
  assert.ok(reasonCodes(a).includes("gibberish"));
});

test("SPAM: instant submit with a direct POST and no stamp", () => {
  const a = score({
    name: "x",
    email: "x@x.com",
    message: "We provide bulk email lists. Interested?",
    elapsedMs: 400,
  });
  assert.equal(a.verdict, "reject");
});

test("SPAM: a budget value the form cannot emit", () => {
  const a = classifySubmission(
    {
      form: "lead",
      name: "Test",
      email: "t@example.com",
      message: "Interested in treatment.",
      elapsedMs: 30_000,
      constrained: [
        {
          field: "budgetRange",
          value: "'; DROP TABLE leads;--",
          allowed: ["Under $5,000", "$20,000+"],
        },
      ],
    },
    OPTS,
  );
  assert.ok(a.verdict !== "allow");
  assert.equal(a.category, "field-tampering");
});

// ═══════════════════════════════════════════════════════════════════════════
// GENUINE — must survive. See the banner at the top of this file.
// ═══════════════════════════════════════════════════════════════════════════

test("GENUINE (real): the contact-form hello", () => {
  // Verbatim from the database, 2026-08-16.
  const a = score({
    name: "Gunin Ruthwik",
    email: "chinnujavvadi@gmail.com",
    phone: "19347419354",
    message: "hello",
    extra: ["Canada"],
  });
  assert.equal(a.verdict, "allow");
});

test("GENUINE (real): matching-wizard lead with a budget and no message", () => {
  // Verbatim from the database, 2026-07-01.
  const a = score({
    name: "a",
    email: "aneeshkumarm2006@gmail.com",
    extra: ["Mexico", "Under $5,000"],
  });
  assert.equal(a.verdict, "allow");
});

test("GENUINE (real): the negative review that mentions a 35% discount", () => {
  // Verbatim from the database. A plain /\d+%\s*(off|discount)/ rule
  // quarantined this — a patient complaining about pricing is exactly the
  // review this site exists to collect. See RETAIL_PROMO in classify.ts.
  const a = classifySubmission(
    {
      form: "review",
      elapsedMs: 120_000,
      message:
        "I would not recommend this clinic. They already make thousands of dollars and then they also choose to make extra commission off of the supplements they prescribe on the fullscript Website. Other practitioners offer 35% discount and they choose to make money over giving patients a discount. The wait is also long.",
    },
    OPTS,
  );
  assert.equal(a.verdict, "allow");
});

test("GENUINE (trap 1): a real budget in dollars is never scored", () => {
  const a = score({
    name: "Susan Delaney",
    email: "susan.delaney@gmail.com",
    message:
      "My husband has been quoted $18,000 for knee treatment in Panama and we have a budget of about $25,000 including travel. Is that realistic, and can you suggest clinics in that range?",
    extra: ["United States", "$20,000+"],
  });
  assert.equal(a.verdict, "allow");
  assert.equal(a.score, 0);
});

test("GENUINE (trap 2): a prospect linking their own website", () => {
  const a = score({
    name: "Dr Amelia Hartley",
    email: "amelia@hartleyregenerative.com",
    message:
      "I run a small regenerative clinic — you can see us at https://hartleyregenerative.com — and I would like to discuss being listed in your directory.",
  });
  assert.equal(a.verdict, "allow");
  assert.ok(!reasonCodes(a).includes("foreign-link"));
});

test("GENUINE (trap 2b): the link matches their company name, not their email", () => {
  const a = score({
    name: "Boulder Biologics",
    email: "contact@gmail.com",
    message: "Our website is www.boulderbiologics.com if you want to check us out.",
  });
  assert.equal(a.verdict, "allow");
});

test("GENUINE (trap 3): ordinary consonant-heavy English is not gibberish", () => {
  for (const word of [
    "partnership",
    "projects",
    "strengths",
    "rhythms",
    "twelfths",
    "sculpts",
    "lymphocytes",
  ]) {
    assert.equal(hasConsonantRun(word), false, `${word} flagged as mash`);
  }
});

test("GENUINE: a buyer using the same vocabulary as the spammers", () => {
  // "ranking on Google", "traffic", "SEO" — the direction is what differs.
  const a = score({
    name: "Priya Raman",
    email: "priya@gmail.com",
    message:
      "I found you when I was searching Google for stem cell clinics — your site was ranking above the others. I need help choosing between two clinics for my mother's arthritis. Can someone call me?",
  });
  assert.equal(a.verdict, "allow");
});

test("GENUINE: a single foreign link stays below the quarantine line", () => {
  const a = score({
    name: "Tom Wheeler",
    email: "tom.wheeler@outlook.com",
    message:
      "I read this study at https://pubmed.ncbi.nlm.nih.gov/12345678/ and wanted to ask whether any of your listed clinics use that protocol.",
  });
  assert.equal(a.verdict, "allow");
  assert.ok(a.score < QUARANTINE_THRESHOLD);
});

test("GENUINE: a missing render stamp alone never holds a submission", () => {
  // A browser on a stale cached bundle right after a deploy sends no stamp.
  const a = score({
    name: "Marcus Bell",
    email: "marcus.bell@yahoo.com",
    message:
      "Please send me information about treatment options for my spinal injury.",
    elapsedMs: null,
  });
  assert.equal(a.verdict, "allow");
  assert.ok(reasonCodes(a).includes("no-render-stamp"));
  assert.ok(a.score < QUARANTINE_THRESHOLD);
});

test("GENUINE: a fast but plausible submit on a short form", () => {
  const a = score({
    name: "Ken",
    email: "ken@gmail.com",
    message: "Do you have clinics in Japan?",
    elapsedMs: 8_000,
  });
  assert.equal(a.verdict, "allow");
});

test("GENUINE: our own domain is always whitelisted", () => {
  // An internal test submission must never be held, whatever it says.
  const a = score({
    name: "Internal test",
    email: "automations@davnoot.com",
    message:
      "TEST 50% OFF free shipping unsubscribe whatsapp: +1555 https://spam.example today only",
    honeypot: "filled",
    elapsedMs: 10,
  });
  assert.equal(a.verdict, "allow");
  assert.equal(a.score, 0);
});

test("GENUINE: a long detailed medical enquiry", () => {
  const a = score({
    name: "Rebecca Osei",
    email: "r.osei@protonmail.com",
    message:
      "I am 54 and was diagnosed with osteoarthritis in both knees four years ago. I have had cortisone injections twice with limited relief and my orthopaedic surgeon has suggested a partial replacement, which I would rather avoid. I am researching mesenchymal stem cell therapy and would like to understand the realistic outcomes, the total cost including follow-ups, and whether treatment abroad is safe. I am able to travel and my budget is around $15,000.",
    extra: ["Ghana", "$10,000 – $20,000"],
  });
  assert.equal(a.verdict, "allow");
  assert.equal(a.score, 0);
});

// ═══════════════════════════════════════════════════════════════════════════
// Helper units
// ═══════════════════════════════════════════════════════════════════════════

test("hasConsonantRun catches real mash and nothing else", () => {
  assert.equal(hasConsonantRun("kjhgfdsa"), true);
  assert.equal(hasConsonantRun("zxcvbnm"), true);
  assert.equal(hasConsonantRun("hello there friend"), false);
});

test("extractHosts finds bare and full URLs", () => {
  const hosts = extractHosts(
    "see https://example.com/x and www.other.org plus third.net here",
  );
  assert.deepEqual(hosts.sort(), ["example.com", "other.org", "third.net"]);
});

test("foreignLinks separates theirs, ours, and foreign", () => {
  const r = foreignLinks(
    "mine: acmeclinic.com, yours: mystemcellguide.com, random: casino.xyz",
    {
      ownHosts: ["mystemcellguide.com"],
      senderEmail: "jo@acmeclinic.com",
      senderName: "Acme Clinic",
    },
  );
  assert.deepEqual(r.own, ["acmeclinic.com"]);
  assert.deepEqual(r.selfReferences, ["mystemcellguide.com"]);
  assert.deepEqual(r.foreign, ["casino.xyz"]);
});
