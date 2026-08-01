import Link from "next/link";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import { getConditions, type TaxonomyTerm } from "@/lib/public-data";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { TaxonomyCard } from "@/components/taxonomy/taxonomy-card";

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: "/conditions" });

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

      <section className="prose-article mt-14 max-w-3xl border-t border-border pt-10">
        <h2>What a condition page tells you</h2>
        <p>
          A condition appears here because clinics in this directory accept
          patients for it. That is a much weaker claim than it might look. For
          most of the conditions below, cell therapy is not established
          treatment. Entries marked supportive are the clinic&apos;s own
          framing: they are offering something alongside standard care, not
          instead of it.
        </p>
        <p>
          Each page shows which clinics treat the condition, what they charge,
          which therapies they use, and what patients treated for it have
          written. Where enough clinics take the same approach, the page links
          to a longer guide on that treatment and condition together.
        </p>

        <h2>Where the evidence stands</h2>
        <p>
          Orthopedics has the strongest published evidence. Injections into a
          knee, hip or shoulder have been studied reasonably often, though
          results still swing on the preparation used and who is holding the
          needle. Autoimmune, neurological and metabolic conditions are a
          different story. There are trials, some of them promising, and almost
          none have produced a result strong enough to make a therapy standard
          of care. Clinics treating those conditions are working out ahead of
          the evidence. That is legal in plenty of countries. It is not the same
          as effective.
        </p>
        <p>
          Treat three things as warnings: a promised cure, a success rate quoted
          with no source, and one protocol that supposedly treats an unrelated
          list of conditions. Our{" "}
          <Link href="/methodology">methodology page</Link> sets out what we
          check and what we do not, and{" "}
          <Link href="/for-clinics">clinics can tell us</Link> when we have a
          listing wrong.
        </p>

        <h2>Starting somewhere else</h2>
        <p>
          Know which procedure you are researching?{" "}
          <Link href="/treatments">Browse by treatment</Link>. If cost or travel
          is what decides it,{" "}
          <Link href="/locations">browse by destination</Link>, or answer a few
          questions in the <Link href="/find-a-clinic">guided match</Link> and
          let it narrow things down. Whichever way in you take, get the
          shortlist in front of a doctor who knows your case before you commit
          to anything.
        </p>
      </section>
    </div>
  );
}
