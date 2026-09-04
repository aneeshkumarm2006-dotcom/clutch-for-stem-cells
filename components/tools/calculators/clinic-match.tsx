"use client";

import * as React from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChoiceList,
  ResultHeadline,
  ResultPanel,
  ToolGrid,
  ToolNote,
  ToolPanel,
  ToolSection,
} from "@/components/tools/tool-ui";
import { MatchResultList } from "@/components/tools/clinic-results";
import { formatPrice } from "@/lib/format";
import {
  directoryHref,
  matchClinics,
  type ClinicMatchIndex,
  type MatchQuery,
} from "@/lib/tools/match";

const ANY = "__any";

/** Budget bands, in the index currency. `max` of 0 means "no ceiling". */
const BUDGETS: { value: string; label: string; min: number; max: number }[] = [
  { value: ANY, label: "Not sure yet", min: 0, max: 0 },
  { value: "under-5k", label: "Under 5,000", min: 0, max: 5000 },
  { value: "5-10k", label: "5,000 to 10,000", min: 5000, max: 10000 },
  { value: "10-20k", label: "10,000 to 20,000", min: 10000, max: 20000 },
  { value: "20k-plus", label: "Over 20,000", min: 20000, max: 100000 },
];

/** How many suggestions the result panel shows. */
const RESULT_LIMIT = 3;

/**
 * The clinic match quiz.
 *
 * Four questions and a ranked shortlist, run entirely in the browser against an
 * index prerendered into the page. Nothing is submitted, nothing is stored, and
 * there is no email gate: the result is the page, not the bait for a form.
 *
 * Two things it does that a lead form would not:
 *
 *  - It shows what each suggestion missed, not only what it matched. See
 *    `lib/tools/match.ts` for why the ranking ignores clinic tier entirely.
 *  - It says how many clinics matched everything before the list was cut to
 *    three, so a shortlist assembled from partial matches announces itself
 *    instead of looking like the top three of a strong field.
 */
export function ClinicMatchQuiz({ index }: { index: ClinicMatchIndex }) {
  const [condition, setCondition] = React.useState<string>(ANY);
  const [treatment, setTreatment] = React.useState<string>(ANY);
  const [country, setCountry] = React.useState<string>(ANY);
  const [budget, setBudget] = React.useState<string>(ANY);

  const budgetBand = BUDGETS.find((b) => b.value === budget) ?? BUDGETS[0]!;

  const query: MatchQuery = React.useMemo(
    () => ({
      condition: condition === ANY ? undefined : condition,
      treatment: treatment === ANY ? undefined : treatment,
      country: country === ANY ? undefined : country,
      budgetMin: budgetBand.min || undefined,
      budgetMax: budgetBand.max || undefined,
    }),
    [condition, treatment, country, budgetBand],
  );

  const outcome = React.useMemo(
    () => matchClinics(index, query, RESULT_LIMIT),
    [index, query],
  );

  const answered = outcome.asked.length;
  const money = (v: number) => formatPrice(v, { currency: index.currency });

  const reset = () => {
    setCondition(ANY);
    setTreatment(ANY);
    setCountry(ANY);
    setBudget(ANY);
  };

  if (!index.clinicCount) {
    return (
      <ToolPanel>
        <p className="text-[14px] leading-relaxed text-text-secondary">
          The directory has no published clinics to match against yet, so this
          quiz has nothing to work with and will not invent suggestions.
        </p>
        <Button asChild className="mt-4">
          <Link href="/clinics">Browse clinics</Link>
        </Button>
      </ToolPanel>
    );
  }

  return (
    <div className="space-y-4">
      <ToolPanel className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-text-secondary">
            Answer what you know. Anything left blank is simply not used.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={reset}
            disabled={answered === 0}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Start over
          </Button>
        </div>

        <ToolSection>
          <div className="space-y-1.5">
            <label
              htmlFor="match-condition"
              className="block text-[13px] font-medium text-text-secondary"
            >
              What are you looking to treat?
            </label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger id="match-condition">
                <SelectValue placeholder="Any condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>No preference</SelectItem>
                {index.conditions.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name} ({c.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[12.5px] text-text-muted">
              The number is how many listed clinics say they treat it.
            </p>
          </div>
        </ToolSection>

        <ToolGrid>
          <div className="space-y-1.5">
            <label
              htmlFor="match-treatment"
              className="block text-[13px] font-medium text-text-secondary"
            >
              Treatment you are interested in
            </label>
            <Select value={treatment} onValueChange={setTreatment}>
              <SelectTrigger id="match-treatment">
                <SelectValue placeholder="Any treatment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>No preference</SelectItem>
                {index.treatments.map((t) => (
                  <SelectItem key={t.slug} value={t.slug}>
                    {t.name} ({t.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="match-country"
              className="block text-[13px] font-medium text-text-secondary"
            >
              Where would you go?
            </label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger id="match-country">
                <SelectValue placeholder="Anywhere" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Anywhere</SelectItem>
                {index.countries.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name} ({c.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </ToolGrid>

        <ToolSection>
          <ChoiceList
            label={`Budget for treatment, in ${index.currency}`}
            hint="Treatment only. Flights and accommodation are a separate calculation."
            options={BUDGETS.map((b) => ({ value: b.value, label: b.label }))}
            value={budget}
            onChange={setBudget}
          />
        </ToolSection>
      </ToolPanel>

      {answered === 0 ? (
        <ResultPanel>
          <p className="text-[14px] leading-relaxed text-text-secondary">
            Answer at least one question above and the shortlist appears here.
            With nothing filled in there is nothing to match on, and three
            clinics picked at random would not be a recommendation.
          </p>
          <Button asChild variant="secondary" className="mt-4">
            <Link href="/clinics">Browse all {index.clinicCount} clinics</Link>
          </Button>
        </ResultPanel>
      ) : outcome.results.length === 0 ? (
        <ResultPanel>
          <ResultHeadline
            label="Matches"
            value="0"
            sub={
              <>
                No listed clinic matches any part of that. Widening one answer,
                usually the country, is normally enough.
              </>
            }
          />
          <Button asChild variant="secondary" className="mt-4">
            <Link href={directoryHref(query, index)}>
              Search the directory instead
            </Link>
          </Button>
        </ResultPanel>
      ) : (
        <ResultPanel>
          <ResultHeadline
            label={outcome.exactCount > 0 ? "Your shortlist" : "Closest matches"}
            value={String(outcome.results.length)}
            unit={
              outcome.exactCount > outcome.results.length
                ? `of ${outcome.exactCount} full matches`
                : outcome.results.length === 1
                  ? "clinic"
                  : "clinics"
            }
            sub={
              outcome.exactCount >= outcome.results.length ? (
                <>
                  Every clinic below meets all {answered}{" "}
                  {answered === 1 ? "criterion" : "criteria"} you gave. Ordered
                  by fit, then by rating.
                </>
              ) : outcome.exactCount > 0 ? (
                <>
                  {outcome.exactCount} of these meet everything you asked for.
                  The rest are the nearest misses, with what they miss on shown
                  against each one.
                </>
              ) : (
                <>
                  Nothing in the directory meets all {answered} of your
                  criteria, so these are the closest partial matches. What each
                  one misses is listed against it.
                </>
              )
            }
          />

          <div className="mt-5">
            <MatchResultList
              matches={outcome.results}
              currency={index.currency}
            />
          </div>

          {budgetBand.max > 0 ? (
            <ToolNote>
              Budget was checked against the range each clinic publishes, which
              is an opening figure rather than a quote. Clinics publishing no
              price are still matched on everything else and marked as
              unchecked, not pushed down the list.{" "}
              {budgetBand.min > 0
                ? `Your band: ${money(budgetBand.min)} to ${money(budgetBand.max)}.`
                : `Your ceiling: ${money(budgetBand.max)}.`}
            </ToolNote>
          ) : null}

          <ToolNote>
            Ordered by how well each clinic fits what you described. Placement in
            this list is not sold and a clinic&apos;s listing plan has no effect
            on it. A match is a starting point for questions, not a
            recommendation of a clinic or a treatment.
          </ToolNote>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              {/* No count on this link. The directory applies your answers as
                  filters that all have to hold at once, where the shortlist
                  scores partial fits, so the two numbers legitimately differ
                  and printing ours next to their page would look like a bug. */}
              <Link href={directoryHref(query, index)}>
                Search the directory with these filters
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/tools/stem-cell-cost-calculator">
                Estimate what this would cost
              </Link>
            </Button>
            {/* The guided match at /find-a-clinic asks the same questions and
                ends in a contact form. Offering it here, after the answer, is
                a choice the visitor makes with the shortlist already in front
                of them. Putting it before the results would be the gate this
                section exists not to have. */}
            <Button asChild variant="secondary">
              <Link href="/find-a-clinic">Have clinics contact you</Link>
            </Button>
          </div>
        </ResultPanel>
      )}
    </div>
  );
}
