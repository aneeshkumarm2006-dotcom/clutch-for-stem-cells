import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import { getConditions, type TaxonomyTerm } from "@/lib/public-data";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { TaxonomyCard } from "@/components/taxonomy/taxonomy-card";

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({
    title: "Conditions treated",
    description:
      "Find regenerative-medicine clinics by the condition you're researching — from knee osteoarthritis to autoimmune and neurological conditions.",
    path: "/conditions",
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

export default async function ConditionsIndexPage() {
  const conditions = await getConditions();
  const groups = groupByCategory(conditions);

  return (
    <div className="container py-10 md:py-14">
      <Breadcrumbs
        className="mb-4"
        items={[
          { name: "Home", href: "/" },
          { name: "Conditions", href: "/conditions" },
        ]}
      />
      <header className="max-w-3xl">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[32px]">
          Browse by condition
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
          Select a condition to see clinics that treat it, the treatments they
          offer, and verified patient experiences.
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
                <TaxonomyCard key={t.id} term={t} basePath="/conditions" />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
