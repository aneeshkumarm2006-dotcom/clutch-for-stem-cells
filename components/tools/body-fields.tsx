"use client";

/**
 * Height, weight and tape-measure inputs, in whichever units the visitor thinks
 * in.
 *
 * Five of the calculators need the same three or four measurements, and getting
 * unit handling subtly different on each of them would be five chances to
 * introduce a conversion bug in code that is meant to be arithmetic you can
 * trust. So state is always metric, these components convert at the edge, and no
 * calculator above them ever sees an inch.
 *
 * Height in imperial is two fields rather than one decimal field, because nobody
 * knows their height as 5.83 feet. The pair is converted to a single centimetre
 * value on every keystroke, and split back into feet and inches for display,
 * which is why editing the inches field never disturbs the feet field: both are
 * derived from the same number.
 */
import * as React from "react";

import { NumberField, Segmented } from "@/components/tools/tool-ui";
import {
  cmToIn,
  feetInchesToCm,
  inToCm,
  kgToLb,
  lbToKg,
  round,
} from "@/lib/tools/calc";

export type Units = "metric" | "imperial";

export function UnitsToggle({
  units,
  onChange,
  className,
}: {
  units: Units;
  onChange: (units: Units) => void;
  className?: string;
}) {
  return (
    <Segmented<Units>
      label="Units"
      size="sm"
      className={className}
      value={units}
      onChange={onChange}
      options={[
        { value: "metric", label: "Metric" },
        { value: "imperial", label: "Imperial" },
      ]}
    />
  );
}

/** Height, stored in centimetres, entered in cm or in feet and inches. */
export function HeightField({
  units,
  valueCm,
  onChange,
  label = "Height",
}: {
  units: Units;
  valueCm: number | undefined;
  onChange: (cm: number | undefined) => void;
  label?: string;
}) {
  if (units === "metric") {
    return (
      <NumberField
        label={label}
        suffix="cm"
        min={100}
        max={250}
        value={valueCm}
        onChange={onChange}
        placeholder="175"
      />
    );
  }

  const totalIn = valueCm === undefined ? undefined : cmToIn(valueCm);
  const feet = totalIn === undefined ? undefined : Math.floor(totalIn / 12);
  const inches =
    totalIn === undefined || feet === undefined
      ? undefined
      : round(totalIn - feet * 12, 1);

  return (
    <div className="grid grid-cols-2 gap-3">
      <NumberField
        label={label}
        suffix="ft"
        min={3}
        max={8}
        value={feet}
        placeholder="5"
        onChange={(ft) => {
          if (ft === undefined && inches === undefined)
            return onChange(undefined);
          onChange(round(feetInchesToCm(ft ?? 0, inches ?? 0), 1));
        }}
      />
      <NumberField
        label="&nbsp;"
        suffix="in"
        min={0}
        max={11.9}
        value={inches}
        placeholder="10"
        onChange={(inch) => {
          if (inch === undefined && feet === undefined)
            return onChange(undefined);
          onChange(round(feetInchesToCm(feet ?? 0, inch ?? 0), 1));
        }}
      />
    </div>
  );
}

/** Weight, stored in kilograms, entered in kg or lb. */
export function WeightField({
  units,
  valueKg,
  onChange,
  label = "Weight",
}: {
  units: Units;
  valueKg: number | undefined;
  onChange: (kg: number | undefined) => void;
  label?: string;
}) {
  if (units === "metric") {
    return (
      <NumberField
        label={label}
        suffix="kg"
        min={20}
        max={400}
        value={valueKg}
        onChange={onChange}
        placeholder="75"
      />
    );
  }

  return (
    <NumberField
      label={label}
      suffix="lb"
      min={45}
      max={880}
      value={valueKg === undefined ? undefined : round(kgToLb(valueKg), 1)}
      placeholder="165"
      onChange={(lb) =>
        onChange(lb === undefined ? undefined : round(lbToKg(lb), 1))
      }
    />
  );
}

/** A tape measurement (neck, waist, hip), stored in centimetres. */
export function LengthField({
  units,
  label,
  valueCm,
  onChange,
  hint,
  placeholderCm,
}: {
  units: Units;
  label: string;
  valueCm: number | undefined;
  onChange: (cm: number | undefined) => void;
  hint?: string;
  placeholderCm: number;
}) {
  if (units === "metric") {
    return (
      <NumberField
        label={label}
        suffix="cm"
        hint={hint}
        min={15}
        max={250}
        value={valueCm}
        onChange={onChange}
        placeholder={String(placeholderCm)}
      />
    );
  }

  return (
    <NumberField
      label={label}
      suffix="in"
      hint={hint}
      min={6}
      max={100}
      value={valueCm === undefined ? undefined : round(cmToIn(valueCm), 1)}
      placeholder={String(round(cmToIn(placeholderCm), 0))}
      onChange={(inch) =>
        onChange(inch === undefined ? undefined : round(inToCm(inch), 1))
      }
    />
  );
}

/** Weight for display, in the visitor's units. */
export function formatWeight(kg: number, units: Units): string {
  return units === "metric"
    ? `${round(kg, 1)} kg`
    : `${round(kgToLb(kg), 1)} lb`;
}

/** Height for display, in the visitor's units. */
export function formatHeight(cm: number, units: Units): string {
  if (units === "metric") return `${round(cm, 0)} cm`;
  const totalIn = cmToIn(cm);
  const feet = Math.floor(totalIn / 12);
  return `${feet} ft ${round(totalIn - feet * 12, 0)} in`;
}
