"use client";

/**
 * Hand-rolled SVG multi-line chart — no chart library.
 *
 * 2px lines, a recessive grid, ~6 x-labels, an always-on legend, and a
 * crosshair + tooltip showing the REAL values. There is never a dual y-axis:
 * when the selected series' maxima differ by more than 30×, the chart switches
 * to INDEXED mode (each line scaled to its own max, a visible "indexed" badge),
 * while the tooltip keeps showing real values.
 */
import { useMemo, useRef, useState } from "react";

import { formatCompact, formatValue } from "@/components/analyticshub/format";
import type { MetricFormat } from "@/components/analyticshub/metrics";
import { useElementWidth } from "@/components/analyticshub/use-element-width";

export interface ChartLine {
  id: string;
  label: string;
  color: string;
  format: MetricFormat;
  points: { date: string; value: number }[];
}

const INDEXED_THRESHOLD = 30;
const PAD = { top: 16, right: 16, bottom: 28, left: 46 };

function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function LineChart({
  lines,
  height = 260,
}: {
  lines: ChartLine[];
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(wrapRef, 640);
  const [hover, setHover] = useState<number | null>(null);

  const dates = lines[0]?.points.map((p) => p.date) ?? [];
  const n = dates.length;

  const model = useMemo(() => {
    const maxes = lines.map((l) =>
      l.points.reduce((mx, p) => Math.max(mx, p.value), 0),
    );
    const nonzero = maxes.filter((m) => m > 0);
    const ratio =
      nonzero.length > 1 ? Math.max(...nonzero) / Math.min(...nonzero) : 1;
    const indexed = ratio > INDEXED_THRESHOLD && lines.length > 1;
    const globalMax = Math.max(1, ...maxes);
    return { maxes, indexed, globalMax };
  }, [lines]);

  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = Math.max(1, height - PAD.top - PAD.bottom);
  const x = (i: number) =>
    n <= 1 ? PAD.left + plotW / 2 : PAD.left + (i / (n - 1)) * plotW;
  const y = (value: number, lineMax: number) => {
    const denom = model.indexed ? Math.max(1, lineMax) : model.globalMax;
    return PAD.top + plotH * (1 - value / denom);
  };

  const xTickIdx: number[] = [];
  if (n > 0) {
    const step = Math.max(1, Math.ceil(n / 6));
    for (let i = 0; i < n; i += step) xTickIdx.push(i);
    if (xTickIdx[xTickIdx.length - 1] !== n - 1) xTickIdx.push(n - 1);
  }

  const gridFracs = [0, 0.25, 0.5, 0.75, 1];

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * width;
    if (n <= 1) {
      setHover(0);
      return;
    }
    const idx = Math.round(((mx - PAD.left) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, idx)));
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {lines.map((l) => (
          <span
            key={l.id}
            className="inline-flex items-center gap-1.5 text-xs text-text-secondary"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: l.color }}
            />
            {l.label}
          </span>
        ))}
        {model.indexed && (
          <span className="ml-auto rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-medium text-warning-fg">
            indexed: each line scaled to its own max
          </span>
        )}
      </div>

      <svg
        width={width}
        height={height}
        className="touch-none select-none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`Line chart: ${lines.map((l) => l.label).join(", ")}`}
      >
        {gridFracs.map((f) => {
          const gy = PAD.top + plotH * (1 - f);
          const label = model.indexed
            ? `${Math.round(f * 100)}%`
            : formatCompact(f * model.globalMax);
          return (
            <g key={f}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={gy}
                y2={gy}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={gy + 3}
                textAnchor="end"
                className="fill-text-muted text-[10px] tabular-nums"
              >
                {label}
              </text>
            </g>
          );
        })}

        {xTickIdx.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={height - 8}
            textAnchor="middle"
            className="fill-text-muted text-[10px] tabular-nums"
          >
            {formatDateShort(dates[i]!)}
          </text>
        ))}

        {lines.map((l, li) => {
          const path = l.points
            .map(
              (p, i) =>
                `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(
                  p.value,
                  model.maxes[li]!,
                ).toFixed(1)}`,
            )
            .join(" ");
          return (
            <path
              key={l.id}
              d={path}
              fill="none"
              stroke={l.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}

        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.top}
            y2={PAD.top + plotH}
            stroke="var(--border-strong)"
            strokeWidth={1}
          />
        )}
        {hover !== null &&
          lines.map((l, li) => (
            <circle
              key={l.id}
              cx={x(hover)}
              cy={y(l.points[hover]?.value ?? 0, model.maxes[li]!)}
              r={3.5}
              fill="var(--surface)"
              stroke={l.color}
              strokeWidth={2}
            />
          ))}
      </svg>

      {hover !== null && dates[hover] && (
        <Tooltip
          left={x(hover)}
          width={width}
          date={dates[hover]!}
          lines={lines}
          index={hover}
        />
      )}
    </div>
  );
}

function Tooltip({
  left,
  width,
  date,
  lines,
  index,
}: {
  left: number;
  width: number;
  date: string;
  lines: ChartLine[];
  index: number;
}) {
  const flip = left > width * 0.6;
  return (
    <div
      className="pointer-events-none absolute top-8 z-10 min-w-[9rem] rounded-lg border border-border bg-surface p-2.5 shadow-card"
      style={
        flip
          ? { right: width - left + 8 }
          : { left: Math.min(left + 8, width - 160) }
      }
    >
      <div className="mb-1 text-[11px] font-medium text-text-muted">
        {formatDateShort(date)}
      </div>
      <div className="space-y-1">
        {lines.map((l) => (
          <div
            key={l.id}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span className="inline-flex items-center gap-1.5 text-text-secondary">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: l.color }}
              />
              {l.label}
            </span>
            <span className="font-medium tabular-nums text-text-primary">
              {formatValue(l.points[index]?.value ?? 0, l.format)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
