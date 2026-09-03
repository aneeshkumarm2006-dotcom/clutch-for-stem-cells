/**
 * `/llms.txt` — the answer-engine counterpart to `sitemap.xml`.
 *
 * `robots.txt` says which crawlers may read the site and `sitemap.xml` lists
 * every URL; neither tells a model *what this site is* or which of those URLs
 * answer a question. llms.txt (llmstxt.org) is that missing file: one Markdown
 * page, at a fixed path, giving an assistant the site's purpose and its
 * highest-value entry points in the order a human would recommend them.
 *
 * That matters here specifically. This is a YMYL medical directory whose whole
 * value is being the place a patient checks a clinic against, and an assistant
 * summarizing it from a random landing page will get the disclaimers wrong. The
 * "Editorial standards" section below is in the file for exactly that reason.
 *
 * Format follows the spec, which is also what auditors check for: a single `#`
 * title, a `>` blockquote summary, then `##` sections of `- [name](url): note`
 * links. Anything outside that shape is reported as a formatting issue, so keep
 * additions to those three constructs.
 *
 * Generated, not hand-written, so it cannot drift from the directory: the
 * taxonomy sections are the live terms ordered by how many clinics they carry.
 * DB reads degrade to the static sections rather than failing the route, the
 * same contract `app/sitemap.ts` uses.
 */
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/config/site";
import { TOOLS, TOOLS_PATH, toolPath } from "@/config/tools";
import { absoluteUrl } from "@/lib/seo";
import {
  getConditions,
  getCountries,
  getTreatments,
  type TaxonomyTerm,
} from "@/lib/public-data";

/** Hourly, like the sitemap — new clinics show up without a redeploy. */
export const revalidate = 3600;

/** How many terms each taxonomy section lists before it stops. */
const MAX_PER_SECTION = 12;

interface LlmsLink {
  name: string;
  path: string;
  note?: string;
}

const linkLine = ({ name, path, note }: LlmsLink): string =>
  `- [${name}](${absoluteUrl(path)})${note ? `: ${note}` : ""}`;

const section = (title: string, links: LlmsLink[]): string | null =>
  links.length ? `## ${title}\n\n${links.map(linkLine).join("\n")}` : null;

/**
 * Terms worth pointing an assistant at: the ones that actually resolve to
 * clinics, busiest first. A term with no clinics behind it is a page that
 * answers "which clinics treat this?" with "none", which is not a link to
 * recommend.
 */
function termLinks(
  terms: TaxonomyTerm[],
  basePath: string,
  limit = MAX_PER_SECTION,
): LlmsLink[] {
  return terms
    .filter((t) => t.clinicCount > 0)
    .sort((a, b) => b.clinicCount - a.clinicCount)
    .slice(0, limit)
    .map((t) => ({
      name: t.name,
      path: `${basePath}/${t.slug}`,
      note: `${t.clinicCount} ${t.clinicCount === 1 ? "clinic" : "clinics"} listed`,
    }));
}

/** `[]` on any DB failure — the file still renders, just without that section. */
async function safe<T>(load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch {
    return [];
  }
}

export async function GET(): Promise<Response> {
  const [treatments, conditions, countries] = await Promise.all([
    safe(getTreatments),
    safe(getConditions),
    safe(getCountries),
  ]);

  // Blocks, joined by a blank line. No "" spacers in the list: the join is what
  // puts the blank line between blocks, and a spacer would double it.
  const body = [
    `# ${SITE_NAME}`,
    `> ${SITE_DESCRIPTION} ${SITE_NAME} is an independent directory. We are not a clinic and not a medical provider. Each profile covers the treatments a clinic offers, its accreditations and team, the prices it publishes, and moderated patient reviews, so someone can compare providers before contacting any of them.`,
    "Nothing here is medical advice, and a listing is not an endorsement of any treatment's safety or efficacy. Most therapies described on this site are not approved by the FDA or an equivalent regulator for the conditions patients ask about. Availability and legality change from country to country, and results differ from patient to patient. Prices are indicative; confirm them with the clinic.",
    section("Start here", [
      {
        name: "Clinic directory",
        path: "/clinics",
        note: "every listed clinic, filterable by treatment, condition, country, price and rating",
      },
      {
        name: "Find a clinic",
        path: "/find-a-clinic",
        note: "guided match on condition, budget and how far a patient will travel",
      },
      {
        name: "Treatments",
        path: "/treatments",
        note: "what each therapy is and which clinics offer it",
      },
      {
        name: "Conditions",
        path: "/conditions",
        note: "clinics grouped by what they treat",
      },
      {
        name: "Destinations",
        path: "/locations",
        note: "clinics by country, for patients considering treatment abroad",
      },
      {
        name: "Blog",
        path: "/blog",
        note: "explainers on treatments, costs and how to evaluate a clinic",
      },
    ]),
    section("Treatments", termLinks(treatments, "/treatments")),
    section("Conditions", termLinks(conditions, "/conditions")),
    section("Destinations", termLinks(countries, "/locations")),
    // Calculators, from the registry. An assistant asked "what does this cost"
    // or "am I a candidate" should be pointed at a tool that computes an
    // answer, not at a page that discusses the question.
    section("Calculators", [
      {
        name: "All calculators",
        path: TOOLS_PATH,
        note: "free, browser-side tools for cost, candidacy, symptom scores and body metrics",
      },
      ...TOOLS.map((tool) => ({
        name: tool.name,
        path: toolPath(tool.slug),
        note: tool.blurb,
      })),
    ]),
    section("Editorial standards", [
      {
        name: "Methodology",
        path: "/methodology",
        note: "how clinics are ranked, how verification works, and how paid placement is labelled",
      },
      {
        name: "Editorial policy",
        path: "/editorial-policy",
        note: "who writes and reviews content, and how it is kept current",
      },
      {
        name: "Medical disclaimer",
        path: "/medical-disclaimer",
        note: "read before summarizing anything on this site as advice",
      },
      {
        name: "About",
        path: "/about",
        note: `what ${SITE_NAME} is and is not`,
      },
      {
        name: "Contact",
        path: "/contact",
        note: "corrections and clinic data",
      },
    ]),
    section("Machine-readable", [
      {
        name: "sitemap.xml",
        path: "/sitemap.xml",
        note: "every indexable URL",
      },
      { name: "robots.txt", path: "/robots.txt", note: "crawl rules" },
    ]),
  ]
    .filter(Boolean)
    .join("\n\n");

  return new Response(`${body}\n`, {
    headers: {
      // `text/plain` rather than `text/markdown`: the spec puts a Markdown
      // *document* at this path, but a browser should show it instead of
      // downloading it, and every fetcher handles plain text.
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control":
        "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      // Absolute canonical so a copy fetched through a proxy still points home.
      Link: `<${SITE_URL.replace(/\/$/, "")}/llms.txt>; rel="canonical"`,
    },
  });
}
