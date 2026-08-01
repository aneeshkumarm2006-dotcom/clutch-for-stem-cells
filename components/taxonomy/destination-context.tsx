/**
 * The editorial half of `/locations/[country]`, for countries that have no
 * approved editorial content yet.
 *
 * A destination page with three clinics on it is a heading, three cards and a
 * footer, and that is not a page: it answers "who is there" and leaves every
 * question a patient considering a flight actually has. This fills the gap until
 * an editor writes something better, and steps aside the moment they do (see the
 * `editorial` branch in the route).
 *
 * **Derived, not templated.** The copy is built from this country's own facets:
 * how many clinics are listed, which cities they are in, which therapies and
 * conditions they actually cover, what they charge, how many are verified, and
 * which languages their staff speak. A directory that repeated the same
 * paragraph under every flag would be manufacturing duplicate content across
 * exactly the pages it most wants indexed separately.
 *
 * The travel-safety guidance is shared, deliberately. It is the same advice
 * wherever you fly, it is a minority of the words on the page, and watering it
 * down per country to look different would be the wrong trade.
 */
import Link from "next/link";

import { formatCount } from "@/lib/format";
import type {
  CountryTerm,
  DirectoryData,
  TaxonomyTerm,
} from "@/lib/public-data";

/**
 * "a, b and c", or "a, b, c and 4 more" once the list runs past `max`. The
 * overflow count replaces the final "and" rather than following it, which is
 * what stops the sentence reading as "x, y and z and 4 others".
 */
function sentenceList(items: string[], max = 4): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length > max)
    return `${items.slice(0, max).join(", ")} and ${items.length - max} more`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The cheapest published starting price among the listed clinics, formatted.
 *
 * Deliberately the *floor* rather than an average: clinics publish a "from"
 * figure, so averaging them would produce a number that describes no real quote.
 * A floor at least says what the least expensive listed option starts at.
 */
function priceFloor(data: DirectoryData): string | null {
  const priced = data.cards.filter(
    (c): c is typeof c & { priceMin: number } =>
      typeof c.priceMin === "number" && c.priceMin > 0,
  );
  if (!priced.length) return null;
  const cheapest = priced.reduce((a, b) => (b.priceMin < a.priceMin ? b : a));
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cheapest.currency || "USD",
      maximumFractionDigits: 0,
    }).format(cheapest.priceMin);
  } catch {
    return `${cheapest.priceMin} ${cheapest.currency || "USD"}`;
  }
}

/**
 * The version for a country we list no clinics in yet.
 *
 * These pages exist by design: the site's indexation policy
 * (`lib/seo-indexation.ts`) keeps an empty destination indexable because the URL
 * is the query it wants to own, and treats emptiness as temporary. That policy
 * only works if the empty page is honest about being empty and useful anyway.
 * The alternative it replaces is a heading, a "no clinics match" box and a
 * footer, which is a page that answers nothing and reads as a soft 404.
 *
 * It deliberately makes **no claim about regulation, cost or practice in this
 * particular country**. We have no clinics on file there, so we have nothing to
 * base one on, and inventing a paragraph of plausible-sounding medical-travel
 * detail per country is exactly what the editorial policy forbids.
 */
function EmptyDestination({
  country,
  elsewhere,
}: {
  country: CountryTerm;
  elsewhere: { name: string; slug: string; clinicCount: number }[];
}) {
  return (
    <section className="prose-article mt-12 max-w-3xl border-t border-border pt-10">
      <h2>We do not list any clinics in {country.name} yet</h2>
      <p>
        {country.name} comes up often enough when people research treatment
        abroad that the page is worth having. We just have nobody to show you
        there yet. Our directory is curated rather than crawled, so a clinic
        only appears once our team has built its profile and checked what it
        publishes, and that work has not reached {country.name}. Read this as a
        gap on our side rather than a verdict on the clinics operating there.
      </p>
      {elsewhere.length ? (
        <p>
          Where we do have clinics:{" "}
          {elsewhere
            .slice(0, 6)
            .map((c) => `${c.name} (${c.clinicCount})`)
            .join(", ")}
          . Starting from <Link href="/treatments">the treatment</Link> or{" "}
          <Link href="/conditions">the condition</Link> usually gets you further
          anyway, at least while the destination is still open.
        </p>
      ) : null}
      <h2>If you are researching {country.name} elsewhere</h2>
      <p>
        The questions are the same wherever you land. Which regulator oversees
        the clinic, and what does that oversight actually cover? Where do the
        cells come from, are they expanded in a lab, and which lab does the
        processing? Who performs the procedure, and what are they licensed to do
        locally? What does the quoted price include, given that consultation,
        imaging, follow-up doses and accommodation are often billed separately?
        And if a complication develops once you are home, whose problem is it?
      </p>
      <p>
        Run the answers past a doctor who knows your history before you commit
        to anything. Found a clinic in {country.name} you think belongs here?{" "}
        <Link href="/contact">Tell us</Link> and we will look at it, or point
        them at the <Link href="/for-clinics">for clinics</Link> page. None of
        this is medical advice.
      </p>
    </section>
  );
}

export function DestinationContext({
  country,
  data,
  cities,
  elsewhere = [],
}: {
  country: CountryTerm;
  data: DirectoryData;
  cities: TaxonomyTerm[];
  /** Other countries that do have clinics, for the empty-state signposts. */
  elsewhere?: { name: string; slug: string; clinicCount: number }[];
}) {
  const total = data.total;
  const treatments = data.facets.treatments.map((f) => f.label);
  const conditions = data.facets.conditions.map((f) => f.label);
  const languages = data.facets.languages.map((f) => f.label);
  const cityNames = cities.filter((c) => c.clinicCount > 0).map((c) => c.name);
  const verified = data.facets.verified;
  const floor = priceFloor(data);
  const reviewed = data.cards.filter((c) => c.reviewCount > 0).length;

  if (total === 0)
    return <EmptyDestination country={country} elsewhere={elsewhere} />;

  return (
    <section className="prose-article mt-12 max-w-3xl border-t border-border pt-10">
      <h2>Stem cell clinics in {country.name} at a glance</h2>
      <p>
        We currently list {formatCount(total)}{" "}
        {total === 1 ? "clinic" : "clinics"} in {country.name}
        {cityNames.length ? `, across ${sentenceList(cityNames, 5)}` : ""}.{" "}
        {verified > 0
          ? `${formatCount(verified)} of them ${verified === 1 ? "has" : "have"} been through our verification checks. Those confirm the credentials and accreditations a clinic gives us. They say nothing about whether its treatments are safe or work.`
          : "None have been through our verification checks yet, so treat everything on their profiles as clinic-supplied for now."}
        {reviewed > 0
          ? ` ${formatCount(reviewed)} ${reviewed === 1 ? "carries" : "carry"} published patient reviews.`
          : " No patient reviews have been published for any of them yet."}
      </p>
      {treatments.length ? (
        <p>
          Between them they list {sentenceList(treatments, 5)}.{" "}
          {conditions.length
            ? `Patients most often approach them about ${sentenceList(conditions, 4)}.`
            : ""}
          {floor
            ? ` The cheapest published starting price in ${country.name} is ${floor}. What you are actually quoted depends on the condition, the protocol, and how many sessions it takes.`
            : ` None of them publish a price, so expect a figure only after a consultation.`}
        </p>
      ) : null}
      {languages.length > 1 ? (
        <p>
          Staff across these clinics are listed as speaking{" "}
          {sentenceList(languages, 5)}. Worth checking before you fly that
          someone who speaks your language will be in the room for the
          consultation and the consent conversation, and not just on reception.
        </p>
      ) : null}

      <h2>What to check before treatment in {country.name}</h2>
      <p>
        Countries differ on how much may be done to cells before they go back
        in, which is why a protocol you can get in one place is unavailable in
        another. A clinic operating legally where it is has satisfied that
        country&apos;s regulator. That is all it tells you. None of it is
        evidence the treatment works, so the checking a domestic approval
        process would have done falls to you instead.
      </p>
      <ul>
        <li>
          Which regulator oversees the clinic in {country.name}, and what does
          that oversight cover?
        </li>
        <li>
          Where do the cells come from, are they expanded in a lab, and which
          lab handles them? Ask for the lab&apos;s certifications, not only the
          clinic&apos;s.
        </li>
        <li>
          Who performs the procedure, what are they licensed to do in{" "}
          {country.name}, and will you speak to them before the day?
        </li>
        <li>
          What does the quote cover? Consultation, imaging, the procedure,
          follow-up doses and accommodation are often priced separately.
        </li>
        <li>
          If a complication develops after you fly home, who is responsible and
          what recourse do you have?
        </li>
      </ul>
      <p>
        Run the answers past a doctor who knows your history before you commit.
        You can also read how we{" "}
        <Link href="/methodology">rank and verify clinics</Link>, compare with{" "}
        <Link href="/locations">other destinations</Link>, or narrow by{" "}
        <Link href="/treatments">treatment</Link> or{" "}
        <Link href="/conditions">condition</Link>. None of this is medical
        advice, and a listing is not an endorsement.
      </p>
    </section>
  );
}
