/**
 * Applies the SEO sheet: meta titles + descriptions for 16 pages, and creates
 * the pages that didn't exist yet.
 *
 * Idempotent — re-running updates in place rather than duplicating. Everything
 * it writes is editable afterwards in the admin panel:
 *   `/`, `/clinics`                → /admin/seo
 *   `/treatments/{slug}`           → /admin/taxonomy/treatments
 *   `/clinics/{slug}`              → /admin/content/clinic-landings
 *   `/treatments/prp-vs-…`         → /admin/content/pages
 *
 * Usage:
 *   npx tsx scripts/apply-page-metadata.ts [--dry]
 */
import dns from "node:dns";
// Node's c-ares resolver refuses SRV queries in this environment even though
// the OS resolves them fine — point it at public DNS so mongodb+srv works.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import { dbConnect } from "@/lib/db";
import {
  ClinicLanding,
  GLOBAL_SETTINGS_KEY,
  Page,
  SiteSetting,
  Treatment,
} from "@/models";

const DRY = process.argv.includes("--dry");

async function loadEnv(): Promise<void> {
  const mod = await import("@next/env");
  const ns = mod as unknown as {
    default?: { loadEnvConfig?: typeof mod.loadEnvConfig };
    loadEnvConfig?: typeof mod.loadEnvConfig;
  };
  const loadEnvConfig = ns.default?.loadEnvConfig ?? ns.loadEnvConfig;
  if (typeof loadEnvConfig === "function") loadEnvConfig(process.cwd());
}

// ── 1. Fixed routes (SiteSetting.pageSeo) ───────────────────────────────────

const PAGE_SEO = [
  {
    path: "/",
    metaTitle: "My Stem Cell Guide | Compare Clinics and Reviews (USA)",
    metaDescription:
      "My Stem Cell Guide is your usa stem cell guide for comparing vetted clinics, reading real testimonials, and understanding your treatment options.",
  },
  {
    path: "/clinics",
    metaTitle: "Stem Cell Clinic Near Me | My Stem Cell Guide",
    metaDescription:
      "Searching for a stem cell clinic near me? Compare board-certified providers by location, condition treated, and verified patient reviews.",
  },
];

// ── 2. Existing treatment terms ─────────────────────────────────────────────

const TREATMENT_SEO = [
  {
    slug: "svf",
    metaTitle: "What Is Stromal Vascular Fraction (SVF) | My Stem Cell Guide",
    metaDescription:
      "Learn what stromal vascular fraction is, how SVF therapy works, and what to expect, an expert-reviewed guide to this regenerative treatment.",
  },
  {
    slug: "adipose-derived-therapy",
    metaTitle: "Adipose Derived Stem Cell Therapy | My Stem Cell Guide",
    metaDescription:
      "A clear, expert-reviewed guide to adipose derived stem cell therapy. How it works, what conditions it treats, and how to find a qualified provider.",
  },
  {
    slug: "exosome-therapy",
    metaTitle: "Exosome Therapy Cost | My Stem Cell Guide",
    metaDescription:
      "What is exosome therapy, what does it cost, and how do you find exosome therapy near me? A vetted, expert-reviewed guide to this regenerative option.",
  },
];

// ── 3. New /clinics/{slug} landing pages ────────────────────────────────────

interface LandingSeed {
  slug: string;
  name: string;
  heading: string;
  intro: string;
  filters: { country?: string; region?: string; city?: string };
  metaTitle: string;
  metaDescription: string;
}

const US = "United States";

const LANDINGS: LandingSeed[] = [
  {
    slug: "mexico-tijuana",
    name: "Mexico & Tijuana",
    heading: "Stem cell clinics in Mexico",
    intro:
      "Mexico is one of the most-searched destinations for stem cell treatment, and Tijuana is the entry point most US patients use, a short drive from San Diego. Compare the clinics we have vetted, what they charge, and the questions worth asking before you cross the border.",
    // Filtered to the country rather than the city: Tijuana is the editorial
    // angle, but a patient searching this page wants every Mexican option.
    filters: { country: "Mexico" },
    metaTitle:
      "Best Stem Cell Clinic in Mexico | Tijuana Guide | My Stem Cell Guide",
    metaDescription:
      "Compare the best stem cell clinic options in Mexico, real stem cell therapy mexico cost data, and what to know before choosing a Tijuana provider.",
  },
  {
    slug: "denver",
    name: "Denver",
    heading: "Stem cell clinics in Denver, CO",
    intro:
      "Denver has a long-standing regenerative-orthopedics scene, much of it built around image-guided injections for knees, hips, and spines. Compare the providers we have vetted, what they treat, and what patients say.",
    filters: { country: US, city: "Denver" },
    metaTitle: "Denver Stem Cell Clinic Guide | My Stem Cell Guide",
    metaDescription:
      "Looking for a denver stem cell clinic? Compare vetted providers offering denver stem cell therapy, with reviews and pricing to help you choose.",
  },
  {
    slug: "florida",
    name: "Florida",
    heading: "Stem cell clinics in Florida",
    intro:
      "Florida has more regenerative-medicine clinics than almost any other state, which makes credentials the thing worth checking first. Compare vetted providers across Tampa, Orlando, Miami, and the rest of the state.",
    filters: { country: US, region: "Florida" },
    metaTitle: "Stem Cell Clinic Florida | My Stem Cell Guide",
    metaDescription:
      "Compare vetted stem cell clinic florida options, with provider credentials, patient reviews, and pricing to help you choose confidently.",
  },
  {
    slug: "chicago",
    name: "Chicago",
    heading: "Stem cell clinics in Chicago, IL",
    intro:
      "Chicago-area providers range from hospital-affiliated sports-medicine groups to standalone regenerative clinics. Compare who offers what, how they are accredited, and what treatment costs locally.",
    filters: { country: US, city: "Chicago" },
    metaTitle: "Stem Cell Therapy Chicago | My Stem Cell Guide",
    metaDescription:
      "Exploring stem cell therapy chicago options? Compare vetted local providers, patient reviews, and pricing before you book a consultation.",
  },
  {
    slug: "hawaii",
    name: "Hawaii",
    heading: "Stem cell clinics in Hawaii",
    intro:
      "Hawaii has a small number of regenerative-medicine providers, so most patients weigh a local consultation against travelling to the mainland. Compare what is available on the islands before you decide.",
    filters: { country: US, region: "Hawaii" },
    metaTitle: "Stem Cell Therapy Hawaii | My Stem Cell Guide",
    metaDescription:
      "Compare stem cell therapy hawaii providers, credentials, and patient reviews. An expert-reviewed guide to your regenerative medicine options.",
  },
  {
    slug: "virginia",
    name: "Virginia",
    heading: "Stem cell clinics in Virginia",
    intro:
      "From Northern Virginia through Richmond and Virginia Beach, regenerative treatment is offered by both orthopedic practices and dedicated clinics. Compare credentials, treatments, and pricing in one place.",
    filters: { country: US, region: "Virginia" },
    metaTitle: "Stem Cell Therapy in Virginia | My Stem Cell Guide",
    metaDescription:
      "Looking into stem cell therapy in virginia? Compare vetted providers, patient reviews, and pricing before you choose a clinic.",
  },
  {
    slug: "ohio",
    name: "Ohio",
    heading: "Stem cell clinics in Ohio",
    intro:
      "Ohio patients typically choose between Cleveland, Columbus, and Cincinnati providers. Compare what each clinic treats, how it is accredited, and what a course of treatment costs.",
    filters: { country: US, region: "Ohio" },
    metaTitle: "Stem Cell Therapy Ohio | My Stem Cell Guide",
    metaDescription:
      "Compare stem cell therapy ohio providers, credentials, and reviews. An expert-reviewed guide to help you choose a qualified clinic.",
  },
  {
    slug: "wisconsin",
    name: "Wisconsin",
    heading: "Stem cell clinics in Wisconsin",
    intro:
      "Wisconsin's regenerative-medicine providers cluster around Milwaukee and Madison. Compare credentials, treatments offered, and verified patient reviews before booking.",
    filters: { country: US, region: "Wisconsin" },
    metaTitle: "Stem Cell Therapy Wisconsin | My Stem Cell Guide",
    metaDescription:
      "Compare stem cell therapy wisconsin providers, credentials, and patient reviews before booking a consultation.",
  },
  {
    slug: "san-diego",
    name: "San Diego",
    heading: "Stem cell clinics in San Diego, CA",
    intro:
      "San Diego patients have both local providers and, 20 miles south, the Tijuana clinics that treat many Americans. Compare the local options here, and read our Mexico guide if you are weighing cross-border treatment.",
    filters: { country: US, city: "San Diego" },
    metaTitle: "Stem Cell Therapy San Diego CA | My Stem Cell Guide",
    metaDescription:
      "Exploring stem cell therapy san diego ca options? Compare vetted providers, reviews, and pricing to find the right fit.",
  },
  {
    slug: "orlando",
    name: "Orlando",
    heading: "Stem cell clinics in Orlando, FL",
    intro:
      "Orlando's regenerative clinics mostly focus on joint pain, sports injuries, and anti-aging protocols. Compare vetted local providers, their credentials, and what patients report.",
    filters: { country: US, city: "Orlando" },
    metaTitle: "Stem Cell Therapy in Orlando FL | My Stem Cell Guide",
    metaDescription:
      "Compare stem cell therapy in orlando fl providers, credentials, and patient reviews before choosing a clinic.",
  },
];

// ── 4. The PRP vs stem cell comparison page ─────────────────────────────────

const PRP_PAGE = {
  slug: "treatments/prp-vs-stem-cell-therapy",
  title: "PRP therapy vs stem cell therapy",
  intro:
    "PRP concentrates the growth factors already in your blood; stem cell therapy introduces cells harvested from fat, bone marrow, or donor tissue. PRP costs less and is more widely available, stem cell therapy is typically used for more advanced degeneration, and evidence quality varies for both.",
  metaTitle: "PRP Therapy vs Stem Cell Therapy | My Stem Cell Guide",
  metaDescription:
    "PRP therapy vs stem cell therapy. An expert-reviewed comparison of how each works, costs, recovery, and which option may fit your condition.",
  blocks: [
    {
      type: "richText" as const,
      data: {
        html: [
          "<h2>How each one works</h2>",
          "<p><strong>Platelet-rich plasma (PRP)</strong> starts with your own blood. A sample is spun in a centrifuge to separate out a platelet-dense fraction, which is then injected into the treatment site. The intent is to concentrate the growth factors platelets already carry.</p>",
          "<p><strong>Stem cell therapy</strong> uses cells rather than plasma. Depending on the protocol, those cells come from your own adipose tissue or bone marrow (autologous), or from donated umbilical-cord or placental tissue (allogeneic). Some clinics also offer exosomes, which are cell-derived signalling vesicles rather than cells.</p>",
          "<p>Both are usually delivered as an outpatient injection, often under ultrasound or fluoroscopic guidance so the material reaches the intended structure.</p>",
        ].join(""),
      },
    },
    {
      type: "comparisonTable" as const,
      data: {
        title: "PRP vs stem cell therapy at a glance",
        columns: ["PRP", "Stem cell therapy"],
        rows: [
          {
            label: "What is injected",
            cells: [
              "Concentrated platelets from your own blood",
              "Cells from your fat or bone marrow, or from donor tissue",
            ],
          },
          {
            label: "Typical US cost per session",
            cells: ["$500–$2,000", "$4,000–$12,000+"],
          },
          {
            label: "Collection procedure",
            cells: [
              "Blood draw, same visit",
              "Liposuction or bone-marrow aspiration (autologous), or none (donor tissue)",
            ],
          },
          {
            label: "Chair time",
            cells: ["Under an hour", "Half a day for autologous harvesting"],
          },
          {
            label: "Downtime",
            cells: [
              "Usually days; soreness at the site is common",
              "Days to weeks, mostly from the harvest site",
            ],
          },
          {
            label: "Commonly offered for",
            cells: [
              "Tendinopathy, mild-to-moderate osteoarthritis, sports injuries",
              "More advanced joint degeneration, and systemic protocols",
            ],
          },
          {
            label: "Regulatory position (US)",
            cells: [
              "Minimally manipulated autologous blood product",
              "Varies by cell source and processing; many protocols are not FDA-approved",
            ],
          },
        ],
      },
    },
    {
      type: "richText" as const,
      data: {
        html: [
          "<h2>Which one patients tend to be offered</h2>",
          "<p>Clinics generally suggest PRP first for tendon problems and earlier-stage joint wear, because it is cheaper, the collection is trivial, and a course can be repeated. Stem cell protocols are more often proposed where cartilage loss is more advanced, or where a patient has already tried PRP without the result they wanted.</p>",
          "<p>That is a pattern in how treatment is offered, not a statement that either works for a given condition. Evidence quality differs sharply between indications, and neither is a substitute for the diagnosis and advice of a licensed physician who has examined you.</p>",
          "<h2>Questions worth asking either way</h2>",
          "<p>Ask what exactly is being injected and where it came from. Ask how many times the clinic has treated your specific condition and what outcome it tracks. Ask whether imaging guidance is used. Ask what the total cost covers, including follow-up injections. And ask what the published evidence for your indication actually shows. A clinic that answers that one carefully is telling you something useful.</p>",
        ].join(""),
      },
    },
    {
      type: "faq" as const,
      data: {
        title: "PRP vs stem cell therapy: common questions",
        items: [
          {
            question: "Is stem cell therapy better than PRP?",
            answer:
              "Neither is universally better. They are different products used at different price points and, in practice, at different stages of joint degeneration. Which is appropriate, if either is, depends on your diagnosis, and that is a decision for a physician who has examined you and reviewed your imaging.",
          },
          {
            question: "Why does stem cell therapy cost so much more?",
            answer:
              "Cost tracks the work involved. PRP needs a blood draw and a centrifuge. An autologous stem cell procedure adds a harvesting step (liposuction or a bone-marrow aspiration) plus cell processing, more staff time, and a longer appointment. Donor-tissue products carry the cost of the tissue itself.",
          },
          {
            question: "Can you have PRP and stem cell therapy together?",
            answer:
              "Some clinics combine them, most often by adding PRP to a cell preparation in the same session. Whether that adds anything is not well established; ask the clinic what it charges for the combination and what evidence it is relying on.",
          },
          {
            question: "Is either treatment covered by insurance?",
            answer:
              "In the United States, both are usually paid out of pocket. Most insurers classify PRP and stem cell injections for orthopedic use as investigational. Ask the clinic for the itemised cost in writing before you commit.",
          },
        ],
      },
    },
    {
      type: "cta" as const,
      data: {
        title: "Compare clinics offering both",
        body: "Filter the directory by treatment, location, and verified patient reviews.",
        buttonLabel: "Browse clinics",
        buttonHref: "/clinics",
      },
    },
  ],
};

// ── Runner ──────────────────────────────────────────────────────────────────

async function main() {
  await loadEnv();
  await dbConnect();
  const log = (msg: string) => console.log(`${DRY ? "[dry] " : ""}${msg}`);

  // 1 — fixed routes
  if (!DRY) {
    const settings = await SiteSetting.getGlobal();
    const existing = (settings.pageSeo ?? []).filter(
      (e) => !PAGE_SEO.some((p) => p.path === e.path),
    );
    await SiteSetting.updateOne(
      { key: GLOBAL_SETTINGS_KEY },
      { $set: { pageSeo: [...existing, ...PAGE_SEO] } },
      { upsert: true },
    );
  }
  for (const p of PAGE_SEO) log(`pageSeo   ${p.path} → "${p.metaTitle}"`);

  // 2 — treatment terms
  for (const t of TREATMENT_SEO) {
    const term = await Treatment.findOne({ slug: t.slug });
    if (!term) {
      log(`MISSING   treatment "${t.slug}" — skipped`);
      continue;
    }
    if (!DRY) {
      term.set("seo", {
        ...(term.seo ?? {}),
        metaTitle: t.metaTitle,
        metaDescription: t.metaDescription,
      });
      await term.save();
    }
    log(`treatment /treatments/${t.slug} → "${t.metaTitle}"`);
  }

  // 3 — clinic landing pages
  let order = 0;
  for (const l of LANDINGS) {
    const doc = {
      slug: l.slug,
      name: l.name,
      heading: l.heading,
      intro: l.intro,
      filters: l.filters,
      seo: { metaTitle: l.metaTitle, metaDescription: l.metaDescription },
      order: order++,
      isActive: true,
    };
    const existed = await ClinicLanding.exists({ slug: l.slug });
    if (!DRY) {
      await ClinicLanding.updateOne(
        { slug: l.slug },
        { $set: doc },
        { upsert: true },
      );
    }
    log(
      `landing   /clinics/${l.slug} ${existed ? "(updated)" : "(created)"} → "${l.metaTitle}"`,
    );
  }

  // 4 — the composed comparison page
  const existedPage = await Page.exists({ slug: PRP_PAGE.slug });
  if (!DRY) {
    await Page.updateOne(
      { slug: PRP_PAGE.slug },
      {
        $set: {
          slug: PRP_PAGE.slug,
          title: PRP_PAGE.title,
          intro: PRP_PAGE.intro,
          blocks: PRP_PAGE.blocks,
          seo: {
            metaTitle: PRP_PAGE.metaTitle,
            metaDescription: PRP_PAGE.metaDescription,
          },
          // Live at its URL. It stays `noindex, follow` until a credentialed
          // reviewer is attached in the CMS — that gate is `isContentComplete`,
          // and this script deliberately does not bypass it.
          reviewStatus: "approved",
        },
        $setOnInsert: { publishedAt: new Date() },
      },
      { upsert: true },
    );
  }
  log(
    `page      /${PRP_PAGE.slug} ${existedPage ? "(updated)" : "(created)"} → "${PRP_PAGE.metaTitle}"`,
  );

  console.log(
    DRY
      ? "\nDry run — nothing written. Re-run without --dry to apply."
      : "\nDone.",
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
