"use client";

/** A tiny axis-free trend line for KPI tiles. */
export function Sparkline({
  points,
  color,
  width = 104,
  height = 30,
}: {
  points: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const n = points.length;
  if (n < 2) return null;
  const max = Math.max(1, ...points);
  const path = points
    .map((v, i) => {
      const px = (i / (n - 1)) * width;
      const py = height - 2 - (v / max) * (height - 4);
      return `${i === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
