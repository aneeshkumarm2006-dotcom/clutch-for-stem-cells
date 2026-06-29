import type { Metadata } from "next";

import { buildMetadata } from "@/lib/seo";
import { getCountries } from "@/lib/public-data";
import { DestinationCard } from "@/components/taxonomy/taxonomy-card";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "Destinations",
  description:
    "Browse regenerative-medicine clinics by country. Compare popular medical-travel destinations for stem cell treatment.",
  path: "/locations",
});

export default async function LocationsIndexPage() {
  const countries = await getCountries();

  return (
    <div className="container py-10 md:py-14">
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
    </div>
  );
}
