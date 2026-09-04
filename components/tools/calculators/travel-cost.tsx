"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Breakdown,
  NumberField,
  ResultHeadline,
  ResultPanel,
  ResultStat,
  ResultStats,
  Segmented,
  ToolGrid,
  ToolNote,
  ToolPanel,
  ToolSection,
} from "@/components/tools/tool-ui";
import { formatPrice } from "@/lib/format";
import { estimateTravelCost } from "@/lib/tools/cost";

type Contingency = "0" | "0.1" | "0.2";

const CONTINGENCY_OPTIONS: { value: Contingency; label: string }[] = [
  { value: "0", label: "None" },
  { value: "0.1", label: "10%" },
  { value: "0.2", label: "20%" },
];

/**
 * Total trip cost, itemised.
 *
 * The headline is the total, but the figure the page is actually for is the
 * overhead share underneath it. That is the number that decides whether a
 * cheaper quote further away survives the itinerary, and it is invisible until
 * somebody adds the flights to the invoice.
 */
export function TravelCostCalculator({
  currency,
  defaultTreatmentCost,
}: {
  currency: string;
  /** Prefilled from the directory's median clinic price, or 0 when unknown. */
  defaultTreatmentCost: number;
}) {
  const [treatmentCost, setTreatmentCost] = React.useState<number | undefined>(
    defaultTreatmentCost || 12000,
  );
  const [travellers, setTravellers] = React.useState<number | undefined>(2);
  const [flightPerPerson, setFlightPerPerson] = React.useState<
    number | undefined
  >(900);
  const [nights, setNights] = React.useState<number | undefined>(10);
  const [nightlyRate, setNightlyRate] = React.useState<number | undefined>(140);
  const [dailySpend, setDailySpend] = React.useState<number | undefined>(70);
  const [upfrontExtras, setUpfrontExtras] = React.useState<number | undefined>(
    400,
  );
  const [followUpTrips, setFollowUpTrips] = React.useState<number | undefined>(
    0,
  );
  const [contingency, setContingency] = React.useState<Contingency>("0.1");

  const result = estimateTravelCost({
    treatmentCost: treatmentCost ?? 0,
    travellers: travellers ?? 1,
    flightPerPerson: flightPerPerson ?? 0,
    nights: nights ?? 0,
    nightlyRate: nightlyRate ?? 0,
    dailySpendPerPerson: dailySpend ?? 0,
    upfrontExtras: upfrontExtras ?? 0,
    followUpTrips: followUpTrips ?? 0,
    contingencyRate: Number(contingency),
  });

  const money = (value: number) => formatPrice(value, { currency });

  return (
    <div className="space-y-4">
      <ToolPanel className="space-y-5">
        <ToolSection title="The treatment">
          <NumberField
            label="Quoted treatment cost"
            suffix={currency}
            min={0}
            value={treatmentCost}
            onChange={setTreatmentCost}
            hint="Use the clinic's written quote, or an estimate from the cost calculator."
          />
        </ToolSection>

        <ToolSection title="Getting there and staying">
          <ToolGrid cols={3}>
            <NumberField
              label="Travellers"
              suffix={travellers === 1 ? "person" : "people"}
              min={1}
              max={6}
              step={1}
              value={travellers}
              onChange={setTravellers}
            />
            <NumberField
              label="Return flight each"
              suffix={currency}
              min={0}
              value={flightPerPerson}
              onChange={setFlightPerPerson}
            />
            <NumberField
              label="Nights"
              suffix="nights"
              min={0}
              max={180}
              step={1}
              value={nights}
              onChange={setNights}
            />
          </ToolGrid>
          <ToolGrid>
            <NumberField
              label="Accommodation a night"
              suffix={currency}
              min={0}
              value={nightlyRate}
              onChange={setNightlyRate}
              hint="For the whole party, sharing"
            />
            <NumberField
              label="Food and transport"
              suffix={currency}
              min={0}
              value={dailySpend}
              onChange={setDailySpend}
              hint="Per person, per day"
            />
          </ToolGrid>
        </ToolSection>

        <ToolSection title="The rest of it">
          <ToolGrid cols={3}>
            <NumberField
              label="Visas, insurance, pre-tests"
              suffix={currency}
              min={0}
              value={upfrontExtras}
              onChange={setUpfrontExtras}
            />
            <NumberField
              label="Follow-up trips"
              suffix="trips"
              min={0}
              max={6}
              step={1}
              value={followUpTrips}
              onChange={setFollowUpTrips}
              hint="Flights plus a third of the stay each"
            />
            <Segmented<Contingency>
              label="Contingency"
              size="sm"
              value={contingency}
              onChange={setContingency}
              options={CONTINGENCY_OPTIONS}
            />
          </ToolGrid>
        </ToolSection>
      </ToolPanel>

      <ResultPanel>
        <ResultHeadline
          label="Total trip cost"
          value={money(result.total)}
          sub={
            <>
              {money(result.nonTreatmentTotal)} of that is not the treatment,
              which is{" "}
              <strong className="font-semibold text-text-primary">
                {result.overheadPercent}% of the total
              </strong>
              . That share is the figure to carry into any comparison between
              clinics in different countries.
            </>
          }
        />

        <ResultStats cols={3}>
          <ResultStat label="Treatment" value={money(treatmentCost ?? 0)} />
          <ResultStat
            label="Everything else"
            value={money(result.nonTreatmentTotal)}
            emphasis
          />
          <ResultStat
            label="Contingency held back"
            value={money(result.contingency)}
            hint={`${Math.round(Number(contingency) * 100)}% of the subtotal`}
          />
        </ResultStats>

        <Breakdown
          rows={result.lines.map((line) => ({
            key: line.key,
            label: line.label,
            detail: line.detail,
            value: money(line.amount),
          }))}
          total={{ label: "Total", value: money(result.total) }}
        />

        <ToolNote>
          Settle three things in writing before booking. Who is responsible if a
          complication develops once you are home, what follow-up the quoted
          price includes, and whether your own insurer or doctor will pick up
          the aftermath of a procedure they did not authorise.
        </ToolNote>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/clinics">Compare clinics by location</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/tools/stem-cell-cost-calculator">
              Estimate the treatment cost
            </Link>
          </Button>
        </div>
      </ResultPanel>
    </div>
  );
}
