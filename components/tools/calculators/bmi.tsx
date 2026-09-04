"use client";

import * as React from "react";

import {
  HeightField,
  UnitsToggle,
  WeightField,
  formatWeight,
  type Units,
} from "@/components/tools/body-fields";
import {
  ResultHeadline,
  ResultPanel,
  ResultStat,
  ResultStats,
  ScaleBar,
  ToolGrid,
  ToolNote,
  ToolPanel,
} from "@/components/tools/tool-ui";
import {
  BMI_BANDS,
  calcBmi,
  kneeLoadFromExcessKg,
  round,
} from "@/lib/tools/calc";

/**
 * BMI, with the part that makes it relevant here: what the excess weight is
 * doing at the knee.
 *
 * The scale bar is drawn from 15 to 45 rather than 0 to 100. A 0-based axis
 * would compress every band a reader cares about into the middle fifth of the
 * bar, and BMI below 15 or above 45 is not a scale problem, it is a clinical
 * one.
 */
const AXIS_MIN = 15;
const AXIS_MAX = 45;

export function BmiCalculator() {
  const [units, setUnits] = React.useState<Units>("metric");
  const [heightCm, setHeightCm] = React.useState<number | undefined>(175);
  const [weightKg, setWeightKg] = React.useState<number | undefined>(80);

  const ready = Boolean(heightCm && weightKg);
  const result = ready ? calcBmi(weightKg!, heightCm!) : null;
  const kneeLoad = result ? kneeLoadFromExcessKg(result.kgToHealthy) : null;

  return (
    <div className="space-y-4">
      <ToolPanel className="space-y-4">
        <UnitsToggle
          units={units}
          onChange={setUnits}
          className="max-w-[220px]"
        />
        <ToolGrid>
          <HeightField
            units={units}
            valueCm={heightCm}
            onChange={setHeightCm}
          />
          <WeightField
            units={units}
            valueKg={weightKg}
            onChange={setWeightKg}
          />
        </ToolGrid>
      </ToolPanel>

      {result ? (
        <ResultPanel>
          <ResultHeadline
            label="Your BMI"
            value={result.bmi.toFixed(1)}
            sub={
              <>
                That falls in the{" "}
                <strong className="font-semibold text-text-primary">
                  {result.band.label.toLowerCase()}
                </strong>{" "}
                band on the World Health Organization scale for adults.
              </>
            }
          />

          <ScaleBar
            segments={BMI_BANDS.map((b) => ({
              label: b.label,
              min: b.min,
              max: Number.isFinite(b.max) ? b.max : AXIS_MAX,
            }))}
            value={result.bmi}
            axisMin={AXIS_MIN}
            axisMax={AXIS_MAX}
            activeLabel={result.band.label}
          />

          <ResultStats cols={3}>
            <ResultStat
              label="Healthy range for your height"
              value={`${formatWeight(result.healthyRangeKg.min, units)} to ${formatWeight(result.healthyRangeKg.max, units)}`}
            />
            <ResultStat
              label={
                result.kgToHealthy === 0
                  ? "Inside the healthy range"
                  : weightKg! > result.healthyRangeKg.max
                    ? "Above the healthy range by"
                    : "Below the healthy range by"
              }
              value={
                result.kgToHealthy === 0
                  ? "No change needed"
                  : formatWeight(result.kgToHealthy, units)
              }
            />
            <ResultStat
              label="Extra load at the knee"
              value={
                kneeLoad && kneeLoad.max > 0
                  ? `+${round(kneeLoad.min, 0)} to ${round(kneeLoad.max, 0)} kg`
                  : "Nothing extra"
              }
              hint="Peak load while walking"
            />
          </ResultStats>

          {kneeLoad && kneeLoad.max > 0 ? (
            <ToolNote>
              Walking puts roughly three to four times body weight through the
              knee. The {formatWeight(result.kgToHealthy, units)} above the
              healthy range for your height is therefore something like{" "}
              {round(kneeLoad.min, 0)} to {round(kneeLoad.max, 0)} kg of extra
              peak load at the joint on every step.
            </ToolNote>
          ) : (
            <ToolNote>
              BMI cannot tell muscle from fat, so a well-trained person can read
              as overweight while carrying very little of it. If that might be
              you, the body fat calculator is the better measure.
            </ToolNote>
          )}
        </ResultPanel>
      ) : (
        <ResultPanel>
          <p className="text-[14px] text-text-secondary">
            Enter a height and a weight to see your BMI.
          </p>
        </ResultPanel>
      )}
    </div>
  );
}
