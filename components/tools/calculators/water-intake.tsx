"use client";

import * as React from "react";

import {
  UnitsToggle,
  WeightField,
  type Units,
} from "@/components/tools/body-fields";
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
} from "@/components/tools/tool-ui";
import { CLIMATE_FACTORS, calcWaterIntake, round, type Climate } from "@/lib/tools/calc";

const CLIMATES: Climate[] = ["temperate", "warm", "hot"];

/** Millilitres in the visitor's units. Imperial gets US fluid ounces. */
function volume(ml: number, units: Units): string {
  return units === "metric"
    ? `${round(ml / 1000, 2)} L`
    : `${round(ml / 29.5735, 0)} fl oz`;
}

export function WaterIntakeCalculator() {
  const [units, setUnits] = React.useState<Units>("metric");
  const [weightKg, setWeightKg] = React.useState<number | undefined>(75);
  const [activityMinutes, setActivityMinutes] = React.useState<
    number | undefined
  >(30);
  const [climate, setClimate] = React.useState<Climate>("temperate");

  const result = weightKg
    ? calcWaterIntake({
        weightKg,
        activityMinutes: activityMinutes ?? 0,
        climate,
      })
    : null;

  return (
    <div className="space-y-4">
      <ToolPanel className="space-y-5">
        <UnitsToggle units={units} onChange={setUnits} className="max-w-[220px]" />

        <ToolGrid>
          <WeightField units={units} valueKg={weightKg} onChange={setWeightKg} />
          <NumberField
            label="Exercise a day"
            suffix="min"
            min={0}
            max={480}
            value={activityMinutes}
            onChange={setActivityMinutes}
            placeholder="30"
            hint="Anything that leaves you sweating"
          />
        </ToolGrid>

        <Segmented<Climate>
          label="Climate"
          value={climate}
          onChange={setClimate}
          options={CLIMATES.map((key) => ({
            value: key,
            label: CLIMATE_FACTORS[key].label,
          }))}
        />
      </ToolPanel>

      {result ? (
        <ResultPanel>
          <ResultHeadline
            label="Water to drink a day"
            value={volume(result.drinkMl, units)}
            sub={
              <>
                About {result.glasses} glasses at 250 ml. Total daily water is{" "}
                {volume(result.totalMl, units)}, and roughly a fifth of that
                arrives in food rather than in a cup.
              </>
            }
          />

          <ResultStats cols={3}>
            <ResultStat
              label="From drinks"
              value={volume(result.drinkMl, units)}
              emphasis
            />
            <ResultStat label="From food" value={volume(result.fromFoodMl, units)} />
            <ResultStat
              label="Climate adjustment"
              value={`x${CLIMATE_FACTORS[climate].factor}`}
              hint={CLIMATE_FACTORS[climate].hint}
            />
          </ResultStats>

          <Breakdown
            rows={result.breakdown.map((row) => ({
              key: row.label,
              label: row.label,
              value: volume(row.ml, units),
            }))}
            total={{
              label: "Total daily water",
              value: volume(result.totalMl, units),
            }}
          />

          <ToolNote>
            Urine colour is a better day-to-day check than any calculation. Pale
            straw means you are fine. If you have kidney disease, heart failure or
            a fluid target from a clinician, that target overrides everything
            here.
          </ToolNote>
        </ResultPanel>
      ) : (
        <ResultPanel>
          <p className="text-[14px] text-text-secondary">
            Enter your weight to get a daily figure.
          </p>
        </ResultPanel>
      )}
    </div>
  );
}
