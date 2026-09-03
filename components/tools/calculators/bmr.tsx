"use client";

import * as React from "react";

import {
  HeightField,
  UnitsToggle,
  WeightField,
  type Units,
} from "@/components/tools/body-fields";
import {
  ChoiceList,
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
import {
  ACTIVITY_FACTORS,
  calcTdee,
  type ActivityLevel,
  type Sex,
} from "@/lib/tools/calc";
import { formatCount } from "@/lib/format";

const ACTIVITY_ORDER: ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very-active",
];

export function BmrCalculator() {
  const [units, setUnits] = React.useState<Units>("metric");
  const [sex, setSex] = React.useState<Sex>("female");
  const [age, setAge] = React.useState<number | undefined>(45);
  const [heightCm, setHeightCm] = React.useState<number | undefined>(170);
  const [weightKg, setWeightKg] = React.useState<number | undefined>(75);
  const [activity, setActivity] = React.useState<ActivityLevel>("light");

  const ready = Boolean(heightCm && weightKg && age);
  const result = ready
    ? calcTdee(
        { weightKg: weightKg!, heightCm: heightCm!, age: age!, sex },
        activity,
      )
    : null;

  // How far apart the two equations land. Usually small; worth showing when it
  // is not, because a large gap is a signal the inputs sit at the edge of where
  // either equation was fitted.
  const spread = result
    ? Math.abs(result.bmr - result.bmrHarrisBenedict)
    : 0;

  return (
    <div className="space-y-4">
      <ToolPanel className="space-y-5">
        <div className="flex flex-wrap gap-3">
          <UnitsToggle units={units} onChange={setUnits} className="w-[200px]" />
          <Segmented<Sex>
            label="Sex"
            size="sm"
            className="w-[200px]"
            value={sex}
            onChange={setSex}
            options={[
              { value: "female", label: "Female" },
              { value: "male", label: "Male" },
            ]}
          />
        </div>

        <ToolGrid cols={3}>
          <HeightField units={units} valueCm={heightCm} onChange={setHeightCm} />
          <WeightField units={units} valueKg={weightKg} onChange={setWeightKg} />
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

        <ToolSection>
          <ChoiceList<ActivityLevel>
            label="Activity level"
            hint="Most people pick one level too high. Three gym sessions alongside a desk job is lightly active."
            value={activity}
            onChange={setActivity}
            options={ACTIVITY_ORDER.map((key) => ({
              value: key,
              label: `${ACTIVITY_FACTORS[key].label} (x${ACTIVITY_FACTORS[key].factor})`,
              hint: ACTIVITY_FACTORS[key].hint,
            }))}
          />
        </ToolSection>
      </ToolPanel>

      {result ? (
        <ResultPanel>
          <ResultHeadline
            label="Maintenance calories"
            value={formatCount(result.tdee)}
            unit="kcal a day"
            sub={
              <>
                Your resting rate is {formatCount(result.bmr)} kcal, multiplied
                by {ACTIVITY_FACTORS[activity].factor} for{" "}
                {ACTIVITY_FACTORS[activity].label.toLowerCase()} living.
              </>
            }
          />

          <ResultStats cols={4}>
            {result.targets.map((t) => (
              <ResultStat
                key={t.key}
                label={t.label}
                value={`${formatCount(t.kcal)} kcal`}
                hint={t.note}
                emphasis={t.key === "maintain"}
              />
            ))}
          </ResultStats>

          <ToolNote>
            Mifflin-St Jeor puts your resting rate at {formatCount(result.bmr)}{" "}
            kcal. Harris-Benedict, the older equation, gives{" "}
            {formatCount(result.bmrHarrisBenedict)} kcal, a difference of{" "}
            {formatCount(spread)}
            {spread > 120
              ? ". A gap that size usually means your inputs sit near the edge of where these equations were fitted, so lean on what the scale does over a month rather than on either figure."
              : ". Both are population estimates and individual rates scatter around them by roughly ten percent."}
          </ToolNote>
        </ResultPanel>
      ) : (
        <ResultPanel>
          <p className="text-[14px] text-text-secondary">
            Fill in height, weight and age to see your daily calorie burn.
          </p>
        </ResultPanel>
      )}
    </div>
  );
}
