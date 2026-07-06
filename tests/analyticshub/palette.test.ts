import assert from "node:assert/strict";
import { test } from "node:test";

import { metricColor, validatePalette } from "@/components/analyticshub/palette";

test("the 5-source palette is colourblind-separable and readable", () => {
  const report = validatePalette();
  assert.equal(
    report.ok,
    true,
    `ΔE ${report.minDeltaE.toFixed(1)}, CVD ΔE ${report.minCvdDeltaE.toFixed(
      1,
    )}, contrast ${report.minContrast.toFixed(2)}:1 — ${report.problems.join(
      "; ",
    )}`,
  );
  // Distinct in normal vision, under deuteranopia + protanopia, and legible.
  assert.ok(report.minDeltaE >= 20);
  assert.ok(report.minCvdDeltaE >= 9);
  assert.ok(report.minContrast >= 2.2);
});

test("metric colours are deterministic hex", () => {
  const a = metricColor("ga4", "sessions");
  const b = metricColor("ga4", "sessions");
  assert.equal(a, b);
  assert.match(a, /^#[0-9a-f]{6}$/);
});
