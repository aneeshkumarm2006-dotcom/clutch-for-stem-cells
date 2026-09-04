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
import { formatPrice } from "@/lib/format";
import { estimateTreatmentCost } from "@/lib/tools/cost";
import { countryFactor, type ToolPriceData } from "@/lib/tools/price-band";

const ANY_COUNTRY = "__any";

/**
 * The cost estimator.
 *
 * Every figure it shows traces to a published clinic price, and the panel says
 * how many clinics are behind the band it started from. That sample size is not
 * a footnote: a band from four clinics and a band from forty are different
 * claims, and a calculator that presented them identically would be laundering
 * a guess into a number.
 *
 * When the directory has no published pricing at all, the tool says so instead
 * of falling back to a plausible-looking hardcoded range. A made-up figure in
 * the same styling as a sourced one is worse than no figure.
 */
export function TreatmentCostCalculator({ data }: { data: ToolPriceData }) {
  const [treatmentSlug, setTreatmentSlug] = React.useState<string>(
    data.treatments[0]?.slug ?? "",
  );
  const [countrySlug, setCountrySlug] = React.useState<string>(ANY_COUNTRY);
  const [areas, setAreas] = React.useState<number | undefined>(1);
  const [sessions, setSessions] = React.useState<number | undefined>(1);

  const treatment = data.treatments.find((t) => t.slug === treatmentSlug);
  const country =
    countrySlug === ANY_COUNTRY
      ? undefined
      : data.countries.find((c) => c.slug === countrySlug);

  const hasData = data.clinicCount > 0 && Boolean(treatment);

  const estimate = hasData
    ? estimateTreatmentCost({
        base: treatment!.band,
        areas: areas ?? 1,
        sessions: sessions ?? 1,
        countryFactor: countryFactor(country?.band, data.overall),
      })
    : null;

  const money = (value: number) =>
    formatPrice(value, { currency: data.currency });

  /** Directory link carrying the visitor's choices as filters. */
  const directoryHref = React.useMemo(() => {
    const sp = new URLSearchParams();
    if (treatment) sp.set("treatment", treatment.slug);
    if (country) sp.set("country", country.name);
    if (estimate?.band.high) sp.set("priceMax", String(estimate.band.high));
    const qs = sp.toString();
    return qs ? `/clinics?${qs}` : "/clinics";
  }, [treatment, country, estimate]);

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
        <ToolSection>
          <div className="space-y-1.5">
            <label
              htmlFor="tool-treatment"
              className="block text-[13px] font-medium text-text-secondary"
            >
              Treatment
            </label>
            <Select value={treatmentSlug} onValueChange={setTreatmentSlug}>
              <SelectTrigger id="tool-treatment">
                <SelectValue placeholder="Choose a treatment" />
              </SelectTrigger>
              <SelectContent>
                {data.treatments.map((t) => (
                  <SelectItem key={t.slug} value={t.slug}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </ToolSection>

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
                <SelectItem value={ANY_COUNTRY}>Anywhere</SelectItem>
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

      {estimate ? (
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
              Worked out from the base band for {treatment!.name.toLowerCase()},
              then adjusted:{" "}
              {estimate.steps
                .map((s) => `${s.label} (x${s.factor})`)
                .join(", ")}
              .
            </p>
          ) : null}

          <ToolNote>
            {treatment!.ownData
              ? `Base band built from ${treatment!.band.sampleSize} published ${treatment!.band.sampleSize === 1 ? "clinic price" : "clinic prices"} for this treatment.`
              : `Too few clinics publish a price for ${treatment!.name.toLowerCase()} to build its own band, so this starts from the all-clinics band across ${data.clinicCount} priced clinics.`}{" "}
            Quotes cover the procedure. Imaging, bloodwork, physiotherapy and
            follow-up are often billed separately.
          </ToolNote>

          <div className="mt-5">
            <Button asChild>
              <Link href={directoryHref}>See clinics in this range</Link>
            </Button>
          </div>
        </ResultPanel>
      ) : null}
    </div>
  );
}
