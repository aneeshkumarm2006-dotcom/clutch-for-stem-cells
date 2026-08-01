/**
 * The editorial half of `/clinic/[slug]/reviews`.
 *
 * The rest of that page is a rating widget and a list. Both are useful and
 * neither is *readable*: a clinic with four reviews renders a page whose entire
 * prose content is one intro sentence, which reads as thin to a search engine
 * and tells a patient nothing they could not get from the star average. This
 * fills that gap with the context a reader actually needs to interpret what they
 * are looking at, and it is why the reviews URL deserves to exist separately
 * from the profile.
 *
 * **Everything here is derived from the clinic**, never boilerplate wearing a
 * name badge. The sections quote this clinic's category scores, its own
 * treatments and conditions, its price range, its accreditations, how many of
 * its reviews are treatment-verified, and when the last one landed. Two clinics
 * produce visibly different pages, which is the point: a templated paragraph
 * repeated across every profile in the directory is duplicate content, and the
 * page is worse off with it than without.
 *
 * An editor who writes their own `reviewsPage.bodyMarkdown` gets that instead;
 * this is the fallback, not a wrapper around it.
 */
import Link from "next/link";

import { SUB_RATING_LABELS } from "@/components/ui/rating-stars";
import { SUB_RATING_KEYS, type SubRatingKey } from "@/lib/enums";
import { formatCount } from "@/lib/format";
import type { ClinicProfile, ClinicReviewStats } from "@/lib/public-data";

/**
 * "a, b and c", or "a, b, c and 4 more" once the list runs past `max`.
 *
 * The overflow count has to replace the final "and" rather than follow it —
 * "PRP, MSC therapy and exosome therapy and 4 other therapies" is what you get
 * otherwise, and it reads like two sentences collided.
 */
function sentenceList(items: string[], max = 4): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length > max)
    return `${items.slice(0, max).join(", ")} and ${items.length - max} more`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** "Broomfield, Colorado" for the HQ, or `null` when nothing is on file. */
function placeOf(clinic: ClinicProfile): string | null {
  const hq = clinic.locations.find((l) => l.isHQ) ?? clinic.locations[0];
  if (!hq) return null;
  const parts = [hq.city, hq.region ?? hq.country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/**
 * The categories this clinic actually scores in, strongest first.
 *
 * Naming the top and bottom category is the single most useful thing this page
 * can say about a clinic that a star average cannot: "reviewers rate
 * communication highest and value lowest" is a real finding, and it comes
 * straight out of the same numbers rendered above it.
 */
function scoredCategories(
  clinic: ClinicProfile,
): { key: SubRatingKey; label: string; value: number }[] {
  return SUB_RATING_KEYS.map((key) => ({
    key,
    label: SUB_RATING_LABELS[key],
    value: clinic.ratingBreakdown?.[key] ?? 0,
  }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
}

function priceSentence(clinic: ClinicProfile): string | null {
  const { priceMin: min, priceMax: max } = clinic;
  if (min == null && max == null) return null;
  const currency = clinic.currency || "USD";
  const money = (n: number) => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return `${n} ${currency}`;
    }
  };
  if (min != null && max != null && max > min)
    return `${money(min)} to ${money(max)}`;
  if (min != null) return `from ${money(min)}`;
  return `up to ${money(max as number)}`;
}

export function ReviewsContext({
  clinic,
  stats,
}: {
  clinic: ClinicProfile;
  stats: ClinicReviewStats;
}) {
  const place = placeOf(clinic);
  const at = place ? `${clinic.name} in ${place}` : clinic.name;
  const categories = scoredCategories(clinic);
  const best = categories[0];
  const worst =
    categories.length > 1 ? categories[categories.length - 1] : null;
  const treatments = clinic.treatments.map((t) => t.name);
  const conditions = clinic.conditions.map((c) => c.name);
  const accreditations = clinic.accreditations.map((a) => a.name);
  const price = priceSentence(clinic);
  const unverified = Math.max(0, stats.total - stats.verifiedCount);
  const lastReviewed = stats.lastReviewedAt
    ? new Date(stats.lastReviewedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      })
    : null;

  return (
    <section className="prose-article mt-12 border-t border-border pt-10">
      <h2>How to read these reviews</h2>
      <p>
        Every review here comes from someone who says they were treated at {at}.
        Our moderation team reads each one before it goes up. We check that it
        describes a real visit and stays inside our content rules. We do not
        check whether the treatment worked. {clinic.name} gets no say either
        way: the clinic cannot approve a review, edit one, or have one taken
        down.
        {stats.total > 0 ? (
          <>
            {" "}
            {stats.verifiedCount > 0
              ? `${formatCount(stats.verifiedCount)} of the ${formatCount(stats.total)} published ${stats.total === 1 ? "review" : "reviews"} ${stats.verifiedCount === 1 ? "is" : "are"} treatment-verified, which means the reviewer sent us documentation of their appointment`
              : `None of the reviews here are treatment-verified yet, so read them as first-hand accounts rather than confirmed records`}
            {unverified > 0 && stats.verifiedCount > 0
              ? `. The other ${formatCount(unverified)} ${unverified === 1 ? "is an account we have" : "are accounts we have"} not been able to confirm`
              : ""}
            .
          </>
        ) : (
          <>
            {" "}
            Nothing has been published for this clinic yet. That is not a
            warning sign, and it is not a clean bill of health either. Usually
            it means the clinic is new to the directory, or that it treats a
            small number of patients a year.
          </>
        )}
      </p>

      {stats.total > 0 && best ? (
        <>
          <h2>What reviewers rate {clinic.name} on</h2>
          <p>
            Reviewers score five things separately instead of leaving one
            overall star rating:{" "}
            {sentenceList(
              SUB_RATING_KEYS.map((k) => SUB_RATING_LABELS[k].toLowerCase()),
              5,
            )}
            . A clinic can run a calm, well-equipped facility and still take a
            week to answer an email. One combined number would bury that.
          </p>
          <p>
            Across the {formatCount(stats.total)}{" "}
            {stats.total === 1 ? "review" : "reviews"} published for{" "}
            {clinic.name}, {best.label.toLowerCase()} scores highest at{" "}
            {best.value.toFixed(1)} out of 5
            {worst
              ? `, and ${worst.label.toLowerCase()} lowest at ${worst.value.toFixed(1)}`
              : ""}
            .{" "}
            {stats.recommendRate != null
              ? `${stats.recommendRate}% of reviewers said they would recommend the clinic to someone with the same condition. `
              : ""}
            {lastReviewed
              ? `The most recent review went up in ${lastReviewed}. `
              : ""}
            {stats.total < 10
              ? "This is a small sample. One delighted or one furious patient moves an average like that a long way."
              : "Averages still hide outliers, so read a few of the individual accounts rather than stopping at the numbers."}
          </p>
        </>
      ) : null}

      <h2>What patients are reviewing</h2>
      <p>
        {clinic.name} is a {clinic.isVerified ? "verified " : ""}
        regenerative-medicine provider
        {place ? ` based in ${place}` : ""}
        {clinic.foundedYear ? `, operating since ${clinic.foundedYear}` : ""}.
        {treatments.length
          ? ` The clinic offers ${sentenceList(treatments)}.`
          : ""}
        {conditions.length
          ? // Sliced before the list, not capped inside it: "most often" already
            // says this is the top of a longer list, so appending "and 12 more"
            // argues with the phrase in front of it.
            ` Patients most often come to it for ${sentenceList(conditions.slice(0, 3))}.`
          : ""}
        {price
          ? ` Published treatment costs run ${price}, though the figure a patient is quoted depends on what they are treated for and how many sessions they need.`
          : ""}
        {accreditations.length
          ? ` Its listed accreditations are ${sentenceList(accreditations, 3)}.`
          : ""}
        {clinic.languages.length > 1
          ? ` Staff are listed as speaking ${sentenceList(clinic.languages, 4)}, worth knowing if you are flying in.`
          : ""}
      </p>
      <p>
        Keep that spread in mind while you read. A review of a
        {conditions.length ? ` ${conditions[0].toLowerCase()}` : ""} case tells
        you little about how the clinic handles the rest of what it offers, and
        a patient who lives nearby has a very different week from one who flew
        in for a single visit.
      </p>

      <h2>Before you book</h2>
      <p>
        Reviews are one input. Ask {clinic.name} for the rest directly: which
        cell source and preparation they would use for your condition, who
        performs the procedure, what the quoted price covers, what follow-up you
        get, and what evidence they are relying on. Vague answers to any of
        those are worth noticing.
      </p>
      <p>
        The full{" "}
        <Link href={`/clinic/${clinic.slug}`}>{clinic.name} profile</Link> has
        the team, accreditations and treatment list. There is a separate page on{" "}
        <Link href={`/clinic/${clinic.slug}/cost`}>
          what {clinic.name} costs
        </Link>
        , and you can read how we{" "}
        <Link href="/methodology">rank and verify clinics</Link> and how we{" "}
        <Link href="/editorial-policy">moderate reviews</Link>. For anything
        clinical, ask a doctor who knows your history.
      </p>
    </section>
  );
}
