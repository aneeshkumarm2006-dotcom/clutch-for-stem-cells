"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { Sparkline } from "@/components/analyticshub/sparkline";
import {
  computeDelta,
  deltaTone,
  formatDelta,
  formatValue,
} from "@/components/analyticshub/format";
import type { MetricFormat } from "@/components/analyticshub/metrics";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  previous,
  format,
  spark,
  color,
  invert = false,
}: {
  label: string;
  value: number;
  previous: number;
  format: MetricFormat;
  spark?: number[];
  color: string;
  invert?: boolean;
}) {
  const delta = computeDelta(value, previous);
  const tone = deltaTone(delta, invert);
  const toneClass =
    tone === "good"
      ? "text-success"
      : tone === "bad"
        ? "text-danger"
        : "text-text-muted";
  const Icon =
    delta.direction === "up"
      ? ArrowUp
      : delta.direction === "down"
        ? ArrowDown
        : Minus;

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
          {label}
        </span>
        {spark && spark.length > 1 ? (
          <Sparkline points={spark} color={color} />
        ) : null}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tabular-nums text-text-primary">
        {formatValue(value, format)}
      </div>
      <div
        className={cn(
          "mt-1 flex items-center gap-1 text-xs font-medium tabular-nums",
          toneClass,
        )}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
        <span>{formatDelta(delta)}</span>
        <span className="font-normal text-text-muted">vs prev.</span>
      </div>
    </div>
  );
}
