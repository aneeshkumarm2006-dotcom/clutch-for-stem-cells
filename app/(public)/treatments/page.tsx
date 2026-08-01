import Link from "next/link";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import { getTreatments, type TaxonomyTerm } from "@/lib/public-data";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { TaxonomyCard } from "@/components/taxonomy/taxonomy-card";

export const revalidate = 3600;

export const generateMetadata = async (): Promise<Metadata> => {
  const meta = await pageMetadata({ path: "/treatments" });
  return {
    ...meta,
    keywords: [
      "stem cell treatment",
      "systemic cell therapy",
      "stem cell therapy types",
    ],
  };
};

function groupByCategory(terms: TaxonomyTerm[]): [string, TaxonomyTerm[]][] {
  const groups = new Map<string, TaxonomyTerm[]>();
  for (const t of terms) {
    const key = t.category ?? "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  return [...groups.entries()];
}

export default async function TreatmentsIndexPage() {
  const treatments = await getTreatments();
  const groups = groupByCategory(treatments);

  return (
    <div className="container py-10 md:py-14">
      <Breadcrumbs
        className="mb-4"
        items={[
          { name: "Home", href: "/" },
          { name: "Treatments", href: "/treatments" },
        ]}
      />
      <header className="max-w-3xl">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[32px]">
          Browse by treatment type
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
          Explore the regenerative therapies clinics offer. Select a treatment
          to see clinics, pricing ranges, and verified patient reviews.
        </p>
      </header>

      <div className="mt-10 space-y-10">
        {groups.map(([category, terms]) => (
          <section key={category}>
            <h2 className="mb-4 font-display text-lg font-semibold text-text-primary">
              {category}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {terms.map((t) => (
                <TaxonomyCard key={t.id} term={t} basePath="/treatments" />
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="prose-article mt-14 max-w-3xl border-t border-border pt-10">
        <h2>How these treatments differ</h2>
        <p>
          Nearly everything clinics call stem cell therapy varies along three
          axes: where the cells came from, how much was done to them in between,
          and how they get into you. Cells taken from your own body are
          autologous, and bone marrow and fat are the usual sources. Donor cells
          are allogeneic, most often from perinatal tissue such as umbilical
          cord or placenta. Stromal vascular fraction is what a clinic separates
          out of fat on the day. Exosomes are not cells at all, but the
          signalling particles cells release. Platelet-rich plasma is a blood
          product rather than a cell therapy, though you will see it listed
          alongside the rest.
        </p>
        <p>
          Delivery matters as much as the source. An injection placed into one
          joint under ultrasound or fluoroscopy is a different proposition to an
          IV infusion meant to act on the whole body, and evidence for one does
          not carry over to the other. Orthopedic clinics mostly do the first.
          Longevity and autoimmune programmes mostly do the second.
        </p>

        <h2>What the regulatory picture looks like</h2>
        <p>
          In the United States, tissue that is only minimally manipulated and
          used for the same purpose it served in the donor sits outside the drug
          approval process. That is the space most American clinics work in.
          Culturing or expanding cells in a lab crosses the line into drug
          territory, so domestic clinics generally will not do it. Several
          countries do permit expanded-cell protocols, and that gap is a large
          part of why patients get on planes. What a clinic is allowed to offer
          tells you about the local rulebook, not about whether the treatment
          works.
        </p>
        <p>
          Very few of these therapies have been through randomised trials large
          enough to settle the question for any one condition. Where published
          evidence exists it tends to be small, early, and tied to one specific
          preparation and one indication. So ask a clinic what supports the
          exact protocol it is proposing for you. Evidence for the field in
          general is not the same thing.
        </p>

        <h2>Using this list</h2>
        <p>
          Each treatment page covers what the therapy is, which clinics here
          offer it, the prices those clinics publish, and what patients have
          said. Starting from a diagnosis instead of a procedure?{" "}
          <Link href="/conditions">Browse by condition</Link>. Already decided
          you are willing to travel?{" "}
          <Link href="/locations">Browse by destination</Link>. The{" "}
          <Link href="/find-a-clinic">guided match</Link> works backwards from
          your condition, your budget and how far you will go.
        </p>
        <p>
          None of this is medical advice, and a listing is not an endorsement.
          Read how we <Link href="/methodology">rank and verify clinics</Link>{" "}
          before you lean on the ordering, and take any treatment you are
          considering to a doctor who knows your history.
        </p>
      </section>
    </div>
  );
}
