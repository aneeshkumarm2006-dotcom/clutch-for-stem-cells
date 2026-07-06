/** Number/label formatting + period-over-period delta math. */
import type { MetricFormat } from "@/components/analyticshub/metrics";

const NF = new Intl.NumberFormat("en-US");

export function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export function formatValue(value: number, format: MetricFormat): string {
  switch (format) {
    case "int":
      return NF.format(Math.round(value));
    case "float1":
      return value.toFixed(1);
    case "float2":
      return value.toFixed(2);
    case "pct":
      return `${round(value, 2)}%`;
    case "currency":
      return formatCurrency(value);
    case "seconds":
      return formatSeconds(value);
    case "position":
      return value.toFixed(1);
  }
}

function formatCurrency(v: number): string {
  const dp = Math.abs(v) >= 100 ? 0 : 2;
  return `$${v.toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })}`;
}

function formatSeconds(s: number): string {
  const sec = Math.round(s);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  return `${m}m ${sec % 60}s`;
}

/** Compact axis/label form: 1.2k, 3.4M. */
export function formatCompact(v: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);
}

export type DeltaDirection = "up" | "down" | "flat";

export interface Delta {
  /** Percent change, or null when there is no comparable prior value. */
  pct: number | null;
  direction: DeltaDirection;
}

export function computeDelta(current: number, previous: number): Delta {
  if (previous === 0) {
    return { pct: current > 0 ? null : 0, direction: current > 0 ? "up" : "flat" };
  }
  const pct = ((current - previous) / previous) * 100;
  const direction: DeltaDirection =
    pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat";
  return { pct, direction };
}

export function formatDelta(d: Delta): string {
  if (d.pct === null) return "new";
  const sign = d.pct > 0 ? "+" : "";
  return `${sign}${round(d.pct, 1)}%`;
}

/**
 * Is a delta good? Normally up = good; for cost/position metrics down = good.
 * Returns "good" | "bad" | "neutral" for colouring.
 */
export function deltaTone(
  d: Delta,
  invert: boolean,
): "good" | "bad" | "neutral" {
  if (d.direction === "flat" || d.pct === null) return "neutral";
  const up = d.direction === "up";
  const good = invert ? !up : up;
  return good ? "good" : "bad";
}
