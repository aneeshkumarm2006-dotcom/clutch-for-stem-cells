import type { Metadata } from "next";

import { buildMetadata } from "@/lib/seo";
import { getTreatments, type TaxonomyTerm } from "@/lib/public-data";
import { TaxonomyCard } from "@/components/taxonomy/taxonomy-card";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "Treatment types",
  description:
    "Explore stem cell and regenerative-medicine treatment types, from MSC therapy to exosomes and PRP, and find clinics that offer each.",
  path: "/treatments",
});

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
    </div>
  );
}
