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
  Breakdown,
  ResultHeadline,
  ResultPanel,
  ResultStat,
  ResultStats,
  Segmented,
  ToolGrid,
  ToolNote,
  ToolPanel,
} from "@/components/tools/tool-ui";
import { calcIdealWeight, round, type Sex } from "@/lib/tools/calc";

/**
 * Ideal weight by four formulas, with the healthy BMI range given the emphasis.
 *
 * Current weight is optional and exists only to produce the "five to ten percent
 * off where you are" line, which is the target that actually has evidence behind
 * it for joint pain. Left blank, the tool stays a formula comparison.
 */
export function IdealWeightCalculator() {
  const [units, setUnits] = React.useState<Units>("metric");
  const [sex, setSex] = React.useState<Sex>("male");
  const [heightCm, setHeightCm] = React.useState<number | undefined>(178);
  const [currentKg, setCurrentKg] = React.useState<number | undefined>(
    undefined,
  );

  const result = heightCm ? calcIdealWeight(heightCm, sex) : null;

  const lossTarget =
    currentKg && result
      ? {
          five: round(currentKg * 0.95, 1),
          ten: round(currentKg * 0.9, 1),
          insideRange:
            currentKg >= result.healthyBmiRangeKg.min &&
            currentKg <= result.healthyBmiRangeKg.max,
        }
      : null;

  return (
    <div className="space-y-4">
      <ToolPanel className="space-y-5">
        <div className="flex flex-wrap gap-3">
          <UnitsToggle
            units={units}
            onChange={setUnits}
            className="w-[200px]"
          />
          <Segmented<Sex>
            label="Sex"
            size="sm"
            className="w-[200px]"
            value={sex}
            onChange={setSex}
            options={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
            ]}
          />
        </div>

        <ToolGrid>
          <HeightField
            units={units}
            valueCm={heightCm}
            onChange={setHeightCm}
          />
          <WeightField
            units={units}
            valueKg={currentKg}
            onChange={setCurrentKg}
            label="Current weight (optional)"
          />
        </ToolGrid>
      </ToolPanel>

      {result ? (
        <ResultPanel>
          <ResultHeadline
            label="Healthy weight range for your height"
            value={`${formatWeight(result.healthyBmiRangeKg.min, units)} to ${formatWeight(result.healthyBmiRangeKg.max, units)}`}
            sub="This is the range clinicians work with. Everywhere inside it is fine, and where you sit within it depends on build."
          />

          <Breakdown
            rows={result.formulas.map((f) => ({
              key: f.key,
              label: f.label,
              value: formatWeight(f.kg, units),
            }))}
            total={{
              label: "Average of the four formulas",
              value: formatWeight(result.averageKg, units),
            }}
          />

          {lossTarget ? (
            <ResultStats cols={2}>
              <ResultStat
                label="5% below your current weight"
                value={formatWeight(lossTarget.five, units)}
                hint="The lower end of the evidence-backed target"
              />
              <ResultStat
                label="10% below your current weight"
                value={formatWeight(lossTarget.ten, units)}
                hint="Where the improvement in joint pain is clearest"
              />
            </ResultStats>
          ) : null}

          <ToolNote>
            {lossTarget && !lossTarget.insideRange
              ? "For knee osteoarthritis pain, the target with evidence behind it is a percentage change from where you are now, not a formula's number. Losing five to ten percent and keeping it off is associated with meaningful improvement from any starting point."
              : "All four formulas are height-only equations built for drug dosing rather than for describing a body. Use the range above them, not any single figure."}
          </ToolNote>
        </ResultPanel>
      ) : (
        <ResultPanel>
          <p className="text-[14px] text-text-secondary">
            Enter a height to compare the formulas.
          </p>
        </ResultPanel>
      )}
    </div>
  );
}
