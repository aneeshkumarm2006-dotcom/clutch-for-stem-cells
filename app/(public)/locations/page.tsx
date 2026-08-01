import Link from "next/link";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/page-metadata";
import { getCountries } from "@/lib/public-data";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { DestinationCard } from "@/components/taxonomy/taxonomy-card";

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({ path: "/locations" });

export default async function LocationsIndexPage() {
  const countries = await getCountries();

  return (
    <div className="container py-10 md:py-14">
      <Breadcrumbs
        className="mb-4"
        items={[
          { name: "Home", href: "/" },
          { name: "Destinations", href: "/locations" },
        ]}
      />
      <header className="max-w-3xl">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-text-primary md:text-[32px]">
          Browse by destination
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
          Many patients travel for regenerative care. Explore clinics by country
          and compare accredited providers in each destination.
        </p>
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {countries.map((c) => (
          <DestinationCard
            key={c.id}
            name={c.name}
            slug={c.slug}
            flag={c.flag}
            clinicCount={c.clinicCount}
          />
        ))}
      </div>

      <section className="prose-article mt-14 max-w-3xl border-t border-border pt-10">
        <h2>Why patients travel for this</h2>
        <p>
          Usually one of two reasons. The first is what a country permits. Rules
          on culturing and expanding cells differ enough that a protocol which
          is routine in one place cannot legally be offered in another, so
          anyone set on an expanded-cell treatment often has to leave home for
          it. The second is money. The same procedure can cost several times as
          much in one country as another, and when insurance covers none of it,
          that gap decides plenty of cases on its own.
        </p>
        <p>
          Neither reason tells you anything about quality. A permissive
          regulator is not a careless one. An expensive clinic is not
          automatically a good one. What actually changes when you travel is how
          much of the checking lands on you.
        </p>

        <h2>What to check before you book abroad</h2>
        <ul>
          <li>
            Who performs the procedure, what they are licensed to do in that
            country, and whether you will meet them before the day.
          </li>
          <li>
            Where the cells come from, how they are processed, and which lab
            does it. Ask for the lab&apos;s certifications, not only the
            clinic&apos;s.
          </li>
          <li>
            What the price covers. Ask outright whether consultation, imaging,
            the procedure, follow-up doses and accommodation are inside the
            number or outside it.
          </li>
          <li>
            What happens if something goes wrong once you are home, who you
            call, and whether any of it is covered.
          </li>
          <li>
            Whether your own doctor has seen the proposed protocol and thinks it
            is reasonable for your case.
          </li>
        </ul>

        <h2>Using these pages</h2>
        <p>
          Each destination page lists the clinics we have on file in that
          country, which cities they are in, what they charge and what they
          offer, plus any longer guides written for that country and treatment
          together. One caveat on the numbers: a clinic count reflects what we
          have published, not the size of a country&apos;s market. A low number
          means we list few clinics there, not that few exist.
        </p>
        <p>
          If the destination matters less to you than the procedure or the
          diagnosis, <Link href="/treatments">browse by treatment</Link> or{" "}
          <Link href="/conditions">by condition</Link> instead. Our{" "}
          <Link href="/methodology">methodology</Link> covers how clinics get
          ranked and verified. Everything here is research material, not medical
          advice.
        </p>
      </section>
    </div>
  );
}
