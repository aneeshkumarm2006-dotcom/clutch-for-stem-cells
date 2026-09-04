"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  NumberField,
  ResultHeadline,
  ResultPanel,
  ResultStat,
  ResultStats,
  ToolGrid,
  ToolNote,
  ToolPanel,
  ToolSection,
} from "@/components/tools/tool-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MatchResultList } from "@/components/tools/clinic-results";
import { formatPrice } from "@/lib/format";
import { estimateTreatmentCost } from "@/lib/tools/cost";
import {
  countryFactor,
  pickBaseBand,
  type ToolPriceData,
} from "@/lib/tools/price-band";
import {
  directoryHref,
  matchClinics,
  type ClinicMatchIndex,
  type MatchQuery,
} from "@/lib/tools/match";

const ANY = "__any";

/** Clinics shown under the estimate. Three is a shortlist; ten is a directory. */
const CLINICS_SHOWN = 3;

/**
 * The cost estimator.
 *
 * Every figure it shows traces to a published clinic price, and the panel says
 * how many clinics are behind the band it started from. That sample size is not
 * a footnote: a band from four clinics and a band from forty are different
 * claims, and a calculator that presented them identically would be laundering
 * a guess into a number.
 *
 * Condition sits alongside treatment because it is how people arrive ("what does
 * this cost for a knee"), but it is the weaker of the two inputs and the panel
 * says which one the estimate actually started from. See `pickBaseBand`.
 *
 * The clinics under the result are the whole argument for putting this
 * calculator on a directory rather than in a blog post: the estimate is not a
 * closing figure, it is a way into the records it was computed from, and the
 * visitor can click straight through to check it.
 *
 * When the directory has no published pricing at all, the tool says so instead
 * of falling back to a plausible-looking hardcoded range. A made-up figure in
 * the same styling as a sourced one is worse than no figure.
 */
export function TreatmentCostCalculator({
  data,
  index,
}: {
  data: ToolPriceData;
  index: ClinicMatchIndex;
}) {
  const [conditionSlug, setConditionSlug] = React.useState<string>(ANY);
  const [treatmentSlug, setTreatmentSlug] = React.useState<string>(
    data.treatments[0]?.slug ?? ANY,
  );
  const [countrySlug, setCountrySlug] = React.useState<string>(ANY);
  const [areas, setAreas] = React.useState<number | undefined>(1);
  const [sessions, setSessions] = React.useState<number | undefined>(1);

  const treatment =
    treatmentSlug === ANY
      ? undefined
      : data.treatments.find((t) => t.slug === treatmentSlug);
  const condition =
    conditionSlug === ANY
      ? undefined
      : data.conditions.find((c) => c.slug === conditionSlug);
  const country =
    countrySlug === ANY
      ? undefined
      : data.countries.find((c) => c.slug === countrySlug);

  const base = pickBaseBand({ treatment, condition, overall: data.overall });

  const estimate =
    data.clinicCount > 0 && base
      ? estimateTreatmentCost({
          base: base.band,
          areas: areas ?? 1,
          sessions: sessions ?? 1,
          countryFactor: countryFactor(country?.band, data.overall),
        })
      : null;

  const money = (value: number) =>
    formatPrice(value, { currency: data.currency });

  /** The visitor's choices, as a query both the clinic list and the link use. */
  const query: MatchQuery = React.useMemo(
    () => ({
      condition: condition?.slug,
      treatment: treatment?.slug,
      country: country?.slug,
      budgetMax: estimate?.band.high || undefined,
    }),
    [condition, treatment, country, estimate],
  );

  const matches = React.useMemo(
    () => matchClinics(index, query, CLINICS_SHOWN),
    [index, query],
  );

  if (!data.clinicCount) {
    return (
      <ToolPanel>
        <p className="text-[14px] leading-relaxed text-text-secondary">
          No clinic in the directory publishes pricing in {data.currency} yet,
          so there is nothing here to build an estimate from, and this
          calculator will not invent one. In the meantime, clinic profiles list
          prices where the clinic has given one.
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
        <ToolGrid>
          <div className="space-y-1.5">
            <label
              htmlFor="tool-condition"
              className="block text-[13px] font-medium text-text-secondary"
            >
              Condition
            </label>
            <Select value={conditionSlug} onValueChange={setConditionSlug}>
              <SelectTrigger id="tool-condition">
                <SelectValue placeholder="Any condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any condition</SelectItem>
                {data.conditions.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="tool-treatment"
              className="block text-[13px] font-medium text-text-secondary"
            >
              Treatment
            </label>
            <Select value={treatmentSlug} onValueChange={setTreatmentSlug}>
              <SelectTrigger id="tool-treatment">
                <SelectValue placeholder="Any treatment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any treatment</SelectItem>
                {data.treatments.map((t) => (
                  <SelectItem key={t.slug} value={t.slug}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </ToolGrid>

        <ToolSection>
          <div className="space-y-1.5">
            <label
              htmlFor="tool-country"
              className="block text-[13px] font-medium text-text-secondary"
            >
              Destination
            </label>
            <Select value={countrySlug} onValueChange={setCountrySlug}>
              <SelectTrigger id="tool-country">
                <SelectValue placeholder="Anywhere" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Anywhere</SelectItem>
                {data.countries.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[12.5px] text-text-muted">
              Scales the estimate by how that country&apos;s median compares
              with the directory median. A price signal, not a quality signal.
            </p>
          </div>
        </ToolSection>

        <ToolGrid>
          <NumberField
            label="Areas treated"
            suffix={areas === 1 ? "joint" : "joints"}
            min={1}
            max={6}
            step={1}
            value={areas}
            onChange={setAreas}
            hint="Each extra area is costed at two thirds of the first"
          />
          <NumberField
            label="Sessions in the course"
            suffix={sessions === 1 ? "visit" : "visits"}
            min={1}
            max={6}
            step={1}
            value={sessions}
            onChange={setSessions}
            hint="Repeat sessions at four fifths of the first"
          />
        </ToolGrid>
      </ToolPanel>

      {estimate && base ? (
        <ResultPanel>
          <ResultHeadline
            label="Typical cost"
            value={money(estimate.band.typical)}
            sub={
              <>
                Most quotes should land between {money(estimate.band.low)} and{" "}
                {money(estimate.band.high)}. Anything far outside that is worth
                asking about, in either direction.
              </>
            }
          />

          <ResultStats cols={3}>
            <ResultStat label="Lower end" value={money(estimate.band.low)} />
            <ResultStat
              label="Typical"
              value={money(estimate.band.typical)}
              emphasis
            />
            <ResultStat label="Upper end" value={money(estimate.band.high)} />
          </ResultStats>

          {estimate.steps.length ? (
            <p className="mt-4 text-[12.5px] leading-relaxed text-text-secondary">
              Worked out from the base band for {base.label.toLowerCase()}, then
              adjusted:{" "}
              {estimate.steps
                .map((s) => `${s.label} (x${s.factor})`)
                .join(", ")}
              .
            </p>
          ) : null}

          <ToolNote>
            {base.ownData
              ? `Base band built from ${base.band.sampleSize} published ${base.band.sampleSize === 1 ? "clinic price" : "clinic prices"} for ${base.source === "overall" ? "all listed clinics" : base.label.toLowerCase()}.`
              : `Too few clinics publish a price for ${base.label.toLowerCase()} to build its own band, so this starts from the all-clinics band across ${data.clinicCount} priced clinics.`}{" "}
            {base.source === "condition"
              ? "Clinics price a procedure rather than a diagnosis, so a band cut by condition is the general pricing of clinics that treat it. Choosing a treatment gives a tighter figure. "
              : ""}
            Quotes cover the procedure. Imaging, bloodwork, physiotherapy and
            follow-up are often billed separately.
          </ToolNote>

          {matches.results.length ? (
            <section className="mt-6 border-t border-border pt-5">
              <h3 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-text-primary">
                Clinics in and around this range
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
                The listings this estimate was built from, closest fit first.
                Prices shown are what each clinic publishes, not a quote, and
                placement here is not sold.
              </p>
              <MatchResultList
                className="mt-4"
                matches={matches.results}
                currency={data.currency}
                numbered={false}
              />
              <Button asChild className="mt-4">
                <Link href={directoryHref(query, index)}>
                  See more clinics in this range
                </Link>
              </Button>
            </section>
          ) : (
            <div className="mt-5">
              <Button asChild>
                <Link href={directoryHref(query, index)}>
                  See clinics in this range
                </Link>
              </Button>
            </div>
          )}
        </ResultPanel>
      ) : null}
    </div>
  );
}
