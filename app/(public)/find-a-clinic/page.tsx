import Link from "next/link";
import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { pageMetadata } from "@/lib/page-metadata";
import { getConditions, getTreatments, getCountries } from "@/lib/public-data";
import { FindClinicWizard } from "@/components/find/find-clinic-wizard";

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: "/find-a-clinic" });

export default async function FindAClinicPage() {
  const [conditions, treatments, countries] = await Promise.all([
    getConditions(),
    getTreatments(),
    getCountries(),
  ]);

  return (
    <div
      style={{
        background:
          "radial-gradient(120% 70% at 50% -10%, #E1F0FC, #F2F8FD 55%)",
      }}
    >
      <div className="container max-w-2xl py-10 md:py-14">
        <header className="mb-6 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-tint px-2.5 py-1 text-xs font-semibold text-azure-700">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Guided matching
          </span>
          <h1 className="mt-3 font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[32px]">
            Find a clinic that fits
          </h1>
          <p className="mx-auto mt-2 max-w-md text-[15px] text-text-secondary">
            Answer a few quick questions and we&apos;ll match you with
            accredited clinics by condition, treatment, location, and budget.
          </p>
        </header>

        <FindClinicWizard
          conditions={conditions.map((c) => ({
            id: c.id,
            slug: c.slug,
            name: c.name,
          }))}
          treatments={treatments.map((t) => ({
            id: t.id,
            slug: t.slug,
            name: t.name,
          }))}
          countries={countries.map((c) => ({ name: c.name, slug: c.slug }))}
        />

        <section className="prose-article mt-14 border-t border-border pt-10">
          <h2>How the match works</h2>
          <p>
            Four questions: what you are trying to treat, which treatment you
            have in mind if you already know, roughly what you can spend, and
            how far you will travel. From there it filters the directory to
            clinics that accept patients for your condition and orders what is
            left the same way <Link href="/clinics">the main directory</Link>{" "}
            does. Nothing you type is stored against your name, and using it
            does not contact anyone. You get a shortlist. What happens next is
            up to you.
          </p>
          <p>
            That ordering is not a ranking of medical quality. It weighs
            verification status, how complete a profile is, published patient
            reviews, and how closely the clinic matches what you asked for. Paid
            placement is labelled wherever it turns up. The{" "}
            <Link href="/methodology">methodology page</Link> has the full
            breakdown.
          </p>

          <h2>What to do with the shortlist</h2>
          <p>
            Contact more than one clinic. Quotes for the same procedure vary a
            lot, and the difference between two of them is often what each one
            includes rather than the treatment itself. Put the same questions to
            each: which cell source and preparation they would use for your
            condition, who performs the procedure and what they are licensed to
            do, what the total covers, what follow-up comes with it, and what
            evidence supports that protocol for your diagnosis in particular.
          </p>
          <p>
            Then take the answers to a doctor who knows your history. Most of
            these treatments are not approved for the conditions patients ask
            about, results differ from person to person, and we have not vetted
            any clinic here for clinical outcomes. Our job stops at listing and
            comparing. The decision is a medical one and it is not ours to make.
          </p>
          <p>
            Prefer to browse yourself? Start from{" "}
            <Link href="/conditions">a condition</Link>,{" "}
            <Link href="/treatments">a treatment</Link>, or{" "}
            <Link href="/locations">a destination</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
