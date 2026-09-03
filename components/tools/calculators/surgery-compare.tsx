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
import {
  SURGERY_REFERENCES,
  compareWithSurgery,
  estimateTreatmentCost,
  surgeryReference,
} from "@/lib/tools/cost";
import type { ToolPriceData } from "@/lib/tools/price-band";

/**
 * Cost and recovery, side by side.
 *
 * What the panel refuses to do is score the two options against each other.
 * Cost and recovery time are comparable; likelihood of the thing working is not,
 * because joint replacement has decades of registry data behind it and most
 * regenerative protocols have observational series. Putting a verdict on top of
 * two numbers would imply the comparison covers more than it does.
 */
export function SurgeryCompareCalculator({ data }: { data: ToolPriceData }) {
  const [surgeryKey, setSurgeryKey] = React.useState<string>(
    SURGERY_REFERENCES[0]!.key,
  );
  const [treatmentSlug, setTreatmentSlug] = React.useState<string>(
    data.treatments[0]?.slug ?? "",
  );
  const [sessions, setSessions] = React.useState<number | undefined>(1);

  const surgery = surgeryReference(surgeryKey)!;
  const treatment = data.treatments.find((t) => t.slug === treatmentSlug);

  const regenerative = treatment
    ? estimateTreatmentCost({
        base: treatment.band,
        areas: 1,
        sessions: sessions ?? 1,
        countryFactor: 1,
      }).band
    : null;

  const comparison = regenerative
    ? compareWithSurgery(surgery, regenerative)
    : null;

  const money = (value: number) =>
    formatPrice(value, { currency: data.currency });

  return (
    <div className="space-y-4">
      <ToolPanel className="space-y-5">
        <ToolSection>
          <div className="space-y-1.5">
            <label
              htmlFor="tool-surgery"
              className="block text-[13px] font-medium text-text-secondary"
            >
              Surgery you are weighing it against
            </label>
            <Select value={surgeryKey} onValueChange={setSurgeryKey}>
              <SelectTrigger id="tool-surgery">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SURGERY_REFERENCES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </ToolSection>

        {data.treatments.length ? (
          <ToolGrid>
            <div className="space-y-1.5">
              <label
                htmlFor="tool-regen"
                className="block text-[13px] font-medium text-text-secondary"
              >
                Regenerative treatment
              </label>
              <Select value={treatmentSlug} onValueChange={setTreatmentSlug}>
                <SelectTrigger id="tool-regen">
                  <SelectValue />
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
            <NumberField
              label="Sessions in the course"
              suffix={sessions === 1 ? "visit" : "visits"}
              min={1}
              max={6}
              step={1}
              value={sessions}
              onChange={setSessions}
              hint="Add sessions to see how repeat treatment changes the comparison"
            />
          </ToolGrid>
        ) : null}
      </ToolPanel>

      {comparison && regenerative ? (
        <ResultPanel>
          <ResultHeadline
            label="Cost difference at typical prices"
            value={
              comparison.typicalDifference > 0
                ? `${money(comparison.typicalDifference)} less`
                : `${money(Math.abs(comparison.typicalDifference))} more`
            }
            sub={
              <>
                A course of {treatment!.name.toLowerCase()} at{" "}
                {money(regenerative.typical)} against a {surgery.label.toLowerCase()}{" "}
                midpoint of {money(comparison.surgeryMidpoint)}. That is{" "}
                {comparison.relativePercent}% of the surgery figure.
              </>
            }
          />

          <ResultStats cols={2}>
            <ResultStat
              label={`${surgery.label} cost`}
              value={`${money(surgery.costLow)} to ${money(surgery.costHigh)}`}
              hint="Indicative US self-pay range"
            />
            <ResultStat
              label="Regenerative course"
              value={`${money(regenerative.low)} to ${money(regenerative.high)}`}
              hint={`From ${regenerative.sampleSize} published clinic ${regenerative.sampleSize === 1 ? "price" : "prices"}`}
            />
            <ResultStat
              label={`${surgery.label} recovery`}
              value={`${surgery.recoveryWeeksLow} to ${surgery.recoveryWeeksHigh} weeks`}
              hint="To a normal day, not to full sport"
            />
            <ResultStat
              label="Injection recovery"
              value="Days to 2 weeks"
              hint="The one advantage here that is not disputed"
            />
          </ResultStats>

          {comparison.overlaps ? (
            <ToolNote tone="warning">
              At these settings the two price ranges overlap, so cost is not what
              separates the options for you. Weigh the evidence and the recovery
              time instead.
            </ToolNote>
          ) : null}

          <ToolNote>
            {surgery.note} Surgery figures are indicative United States self-pay
            ranges and vary several fold between facilities. What an insured
            patient pays has little relationship to a list price, so run the
            comparison on what each option would cost you personally.
          </ToolNote>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              <Link
                href={
                  surgery.conditionSlug
                    ? `/conditions/${surgery.conditionSlug}`
                    : "/conditions"
                }
              >
                Read about this condition
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/tools/stem-cell-cost-calculator">
                Refine the treatment estimate
              </Link>
            </Button>
          </div>
        </ResultPanel>
      ) : (
        <ResultPanel>
          <p className="text-[14px] leading-relaxed text-text-secondary">
            No clinic in the directory publishes pricing in {data.currency} yet,
            so there is no regenerative figure to set against{" "}
            {surgery.label.toLowerCase()}. Indicative US self-pay cost for the
            surgery is {money(surgery.costLow)} to {money(surgery.costHigh)},
            with a recovery of {surgery.recoveryWeeksLow} to{" "}
            {surgery.recoveryWeeksHigh} weeks.
          </p>
        </ResultPanel>
      )}
    </div>
  );
}
