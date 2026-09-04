"use client";

import * as React from "react";

import {
  HeightField,
  LengthField,
  UnitsToggle,
  WeightField,
  formatWeight,
  type Units,
} from "@/components/tools/body-fields";
import {
  NumberField,
  ResultHeadline,
  ResultPanel,
  ResultStat,
  ResultStats,
  ScaleBar,
  Segmented,
  ToolGrid,
  ToolNote,
  ToolPanel,
  ToolSection,
} from "@/components/tools/tool-ui";
import { BODY_FAT_BANDS, calcBodyFat, type Sex } from "@/lib/tools/calc";

/**
 * Body fat by the Navy tape method, falling back to a BMI estimate.
 *
 * The fallback is deliberately visible rather than silent. The two methods do
 * not deserve equal confidence, and a result that does not say which one
 * produced it invites a reader to trust a BMI-derived figure as though it came
 * off a tape measure.
 */
const AXIS_MAX = 45;

export function BodyFatCalculator() {
  const [units, setUnits] = React.useState<Units>("metric");
  const [sex, setSex] = React.useState<Sex>("male");
  const [age, setAge] = React.useState<number | undefined>(45);
  const [heightCm, setHeightCm] = React.useState<number | undefined>(178);
  const [weightKg, setWeightKg] = React.useState<number | undefined>(84);
  const [neckCm, setNeckCm] = React.useState<number | undefined>(38);
  const [waistCm, setWaistCm] = React.useState<number | undefined>(92);
  const [hipCm, setHipCm] = React.useState<number | undefined>(undefined);

  const ready = Boolean(heightCm && weightKg && age);
  const needsHip = sex === "female";

  const result = ready
    ? calcBodyFat({
        sex,
        age: age!,
        weightKg: weightKg!,
        heightCm: heightCm!,
        neckCm,
        waistCm,
        hipCm: needsHip ? hipCm : undefined,
      })
    : null;

  const bands = BODY_FAT_BANDS[sex];

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

        <ToolGrid cols={3}>
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
          <NumberField
            label="Age"
            suffix="yrs"
            min={15}
            max={100}
            value={age}
            onChange={setAge}
            placeholder="45"
          />
        </ToolGrid>

        <ToolSection
          title="Tape measurements"
          hint="Leave these blank and the calculator falls back to a less accurate BMI estimate."
        >
          <ToolGrid cols={needsHip ? 3 : 2}>
            <LengthField
              units={units}
              label="Neck"
              valueCm={neckCm}
              onChange={setNeckCm}
              placeholderCm={38}
              hint="Just below the larynx"
            />
            <LengthField
              units={units}
              label="Waist"
              valueCm={waistCm}
              onChange={setWaistCm}
              placeholderCm={sex === "male" ? 92 : 78}
              hint={sex === "male" ? "At the navel" : "At the narrowest point"}
            />
            {needsHip ? (
              <LengthField
                units={units}
                label="Hips"
                valueCm={hipCm}
                onChange={setHipCm}
                placeholderCm={100}
                hint="At the widest point"
              />
            ) : null}
          </ToolGrid>
        </ToolSection>
      </ToolPanel>

      {result ? (
        <ResultPanel>
          <ResultHeadline
            label="Estimated body fat"
            value={result.percent.toFixed(1)}
            unit="%"
            sub={
              <>
                That sits in the{" "}
                <strong className="font-semibold text-text-primary">
                  {result.band.label.toLowerCase()}
                </strong>{" "}
                range for {sex === "male" ? "men" : "women"}.
              </>
            }
          />

          <ScaleBar
            segments={bands.map((b) => ({
              label: b.label,
              min: b.min,
              max: Number.isFinite(b.max) ? b.max : AXIS_MAX,
            }))}
            value={result.percent}
            axisMin={0}
            axisMax={AXIS_MAX}
            activeLabel={result.band.label}
          />

          <ResultStats cols={3}>
            <ResultStat
              label="Fat mass"
              value={formatWeight(result.fatMassKg, units)}
            />
            <ResultStat
              label="Lean mass"
              value={formatWeight(result.leanMassKg, units)}
              hint="Muscle, bone, organs and water"
            />
            <ResultStat
              label="Method"
              value={result.method === "navy" ? "Navy tape" : "BMI estimate"}
              hint={
                result.method === "navy"
                  ? "Within 3 to 4 points of DEXA"
                  : "Add tape measurements to improve it"
              }
            />
          </ResultStats>

          {result.method === "bmi" ? (
            <ToolNote tone="warning">
              This figure came from the Deurenberg equation, which estimates
              body fat from BMI, age and sex. It inherits everything BMI cannot
              see, including calling muscular people fat. Add a neck and waist
              measurement for a result worth tracking.
            </ToolNote>
          ) : (
            <ToolNote>
              Measure at the same time of day each time, ideally before eating.
              A centimetre of error moves the result by roughly a percentage
              point, so consistency matters more than getting any single reading
              exactly right.
            </ToolNote>
          )}
        </ResultPanel>
      ) : (
        <ResultPanel>
          <p className="text-[14px] text-text-secondary">
            Fill in height, weight and age to get an estimate.
          </p>
        </ResultPanel>
      )}
    </div>
  );
}
