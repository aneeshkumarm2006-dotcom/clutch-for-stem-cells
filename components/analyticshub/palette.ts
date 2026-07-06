/**
 * Chart palette — one hue per source, lightness steps per metric within a
 * source. The five base hues are the Okabe–Ito colourblind-safe set; each is
 * darkened slightly for legibility on a white card, and metric steps only ever
 * DARKEN from the base (so contrast never drops below the base).
 *
 * `validatePalette()` (exercised by a unit test) is the "validate, don't
 * eyeball" guard. It checks THREE things and fails the build if any regress:
 *   1. base hues stay perceptually distinct (Lab ΔE);
 *   2. they stay distinct under simulated deuteranopia AND protanopia
 *      (the actual colourblind-separation test — Machado 2009 matrices);
 *   3. every rendered metric colour keeps adequate contrast on the card.
 *
 * The contrast floor is 2.2:1 rather than the 3:1 for essential graphics: each
 * line is redundantly identified by an always-on legend + a labelled tooltip,
 * so colour is never the sole channel (WCAG 1.4.11 redundancy).
 */
import type { SourceId } from "@/lib/analyticshub/types";
import { metricIndex, metricsFor } from "@/components/analyticshub/metrics";

/** Okabe–Ito basis, one per source. */
export const SOURCE_COLOR: Record<SourceId, string> = {
  ga4: "#0072b2", // blue
  gsc: "#009e73", // bluish green
  meta: "#cc79a7", // reddish purple
  gads: "#d55e00", // vermillion
  users: "#56b4e9", // sky blue
};

/** Card surface the lines sit on (--surface). */
const SURFACE = "#ffffff";

const MIN_DELTA_E = 20;
const MIN_CVD_DELTA_E = 9;
const MIN_CONTRAST = 2.2;

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mix toward white (amount>0) or black (amount<0), amount in [-1,1]. */
function shade(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  return rgbToHex({
    r: r + (target - r) * t,
    g: g + (target - g) * t,
    b: b + (target - b) * t,
  });
}

/**
 * Deterministic colour for one metric. A source's metrics fan out in DARKENING
 * steps from a slightly-darkened base, so every step stays at least as legible
 * as the base while remaining the same hue.
 */
export function metricColor(source: SourceId, key: string): string {
  const n = Math.max(1, metricsFor(source).length);
  const i = Math.max(0, metricIndex(source, key));
  const step = n === 1 ? 0 : (i / (n - 1)) * 0.42;
  return shade(SOURCE_COLOR[source], -(0.12 + step));
}

/** The representative (lightest, base) colour for a source. */
export function sourceColor(source: SourceId): string {
  const first = metricsFor(source)[0];
  return first ? metricColor(source, first.key) : SOURCE_COLOR[source];
}

/* ── Contrast (WCAG) ──────────────────────────────────────────────────────── */

function srgbToLinChannel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (
    0.2126 * srgbToLinChannel(r) +
    0.7152 * srgbToLinChannel(g) +
    0.0722 * srgbToLinChannel(b)
  );
}

export function contrastRatio(a: string, b: string): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/* ── Lab ΔE (perceptual distance) ─────────────────────────────────────────── */

function toLab(hex: string): [number, number, number] {
  const { r, g, b } = hexToRgb(hex);
  const R = srgbToLinChannel(r);
  const G = srgbToLinChannel(g);
  const B = srgbToLinChannel(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}

/* ── Colourblind simulation (Machado 2009, severity 1.0, linear RGB) ──────── */

const PROTANOPIA = [
  0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882,
  -0.048116, 1.051998,
];
const DEUTERANOPIA = [
  0.367322, 0.860646, -0.227968, 0.28009, 0.672501, 0.047409, -0.01182, 0.04294,
  0.968881,
];

function linToSrgbChannel(l: number): number {
  const c = l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, c)) * 255);
}

function simulate(hex: string, m: number[]): string {
  const { r, g, b } = hexToRgb(hex);
  const R = srgbToLinChannel(r);
  const G = srgbToLinChannel(g);
  const B = srgbToLinChannel(b);
  return rgbToHex({
    r: linToSrgbChannel(m[0]! * R + m[1]! * G + m[2]! * B),
    g: linToSrgbChannel(m[3]! * R + m[4]! * G + m[5]! * B),
    b: linToSrgbChannel(m[6]! * R + m[7]! * G + m[8]! * B),
  });
}

export interface PaletteReport {
  ok: boolean;
  minDeltaE: number;
  minCvdDeltaE: number;
  minContrast: number;
  problems: string[];
}

export function validatePalette(): PaletteReport {
  const problems: string[] = [];
  const sources = Object.keys(SOURCE_COLOR) as SourceId[];
  const reps = sources.map((s) => sourceColor(s));

  let minDeltaE = Infinity;
  let minCvdDeltaE = Infinity;
  for (let i = 0; i < reps.length; i++) {
    for (let j = i + 1; j < reps.length; j++) {
      const d = deltaE(reps[i]!, reps[j]!);
      minDeltaE = Math.min(minDeltaE, d);
      if (d < MIN_DELTA_E) {
        problems.push(`${sources[i]}/${sources[j]} ΔE ${d.toFixed(1)}`);
      }
      for (const m of [PROTANOPIA, DEUTERANOPIA]) {
        const dc = deltaE(simulate(reps[i]!, m), simulate(reps[j]!, m));
        minCvdDeltaE = Math.min(minCvdDeltaE, dc);
        if (dc < MIN_CVD_DELTA_E) {
          problems.push(
            `${sources[i]}/${sources[j]} CVD ΔE ${dc.toFixed(1)}`,
          );
        }
      }
    }
  }

  let minContrast = Infinity;
  for (const s of sources) {
    for (const m of metricsFor(s)) {
      const c = contrastRatio(metricColor(s, m.key), SURFACE);
      minContrast = Math.min(minContrast, c);
      if (c < MIN_CONTRAST) {
        problems.push(`${s}.${m.key} contrast ${c.toFixed(2)}:1`);
      }
    }
  }

  return {
    ok: problems.length === 0,
    minDeltaE,
    minCvdDeltaE,
    minContrast,
    problems,
  };
}
