/**
 * TEMP analysis script (not part of the app) — runs the content-flags scanner
 * over ALL string content in seed-data.ts and reports:
 *   1. every hit (record, field path, phrase, context) → judge true/false positives
 *   2. a false-negative probe: risky phrasings a moderator would want flagged
 * Run: npx tsx scripts/_scan-report.ts
 */
import { scanContentFlags } from "../lib/content-flags";
import * as seed from "./seed-data";

interface Hit {
  dataset: string;
  record: string;
  path: string;
  phrase: string;
  context: string;
}

const hits: Hit[] = [];
let stringsScanned = 0;
let charsScanned = 0;

function labelOf(obj: Record<string, unknown>): string {
  for (const k of ["slug", "name", "title", "authorName", "email", "key"]) {
    const v = obj[k];
    if (typeof v === "string") return v;
  }
  return "?";
}

function walk(dataset: string, record: string, path: string, v: unknown): void {
  if (typeof v === "string") {
    stringsScanned++;
    charsScanned += v.length;
    for (const f of scanContentFlags(v)) {
      hits.push({ dataset, record, path, phrase: f.phrase, context: f.context });
    }
  } else if (Array.isArray(v)) {
    v.forEach((item, i) => walk(dataset, record, `${path}[${i}]`, item));
  } else if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v)) {
      walk(dataset, record, path ? `${path}.${k}` : k, val);
    }
  }
}

for (const [name, value] of Object.entries(seed)) {
  if (typeof value === "function") continue;
  if (Array.isArray(value)) {
    for (const item of value) {
      const rec =
        item && typeof item === "object"
          ? labelOf(item as Record<string, unknown>)
          : String(item);
      walk(name, rec, "", item);
    }
  } else {
    walk(name, name, "", value);
  }
}

console.log(`Scanned ${stringsScanned} strings (${charsScanned} chars) across seed-data exports.\n`);
console.log(`=== HITS: ${hits.length} ===`);
for (const h of hits) {
  console.log(`\n[${h.dataset}] ${h.record}  @ ${h.path || "(root)"}`);
  console.log(`  phrase : ${h.phrase}`);
  console.log(`  context: ${h.context}`);
}

// ── False-negative probe ────────────────────────────────────────────────────
// Realistic risky phrasings (the kind PRD §14 targets) that a clinic might
// actually write. If the scanner returns nothing, it's a miss.
const PROBES: string[] = [
  "Our therapy heals your joints for good.",
  "Patients see permanent results after one session.",
  "98% success rate across all conditions.",
  "Clinically proven results, every time.",
  "You will walk again after our treatment.",
  "Say goodbye to diabetes forever.",
  "Complete remission in all treated patients.",
  "Our stem cells regenerate any damaged organ.",
  "Zero side effects, completely safe.",
  "Totally safe with no complications ever reported.",
  "This treatment eliminates arthritis.",
  "Reversal of aging at the cellular level.",
  "Guarantee: your money back if symptoms persist.", // should HIT (guarantee)
  "A definitive cure for MS.", // should HIT (cure)
  "curated selection of clinics", // should NOT hit (cure inside curated)
  "procure the best equipment", // should NOT hit
  "secure and reliable", // should NOT hit
  "The curettage procedure", // should NOT hit
  "Miracle Gardens Boulevard, Dubai", // address false-positive test
  "Treatment reverses cartilage degradation in some patients", // borderline: "reverses"
  "no risky procedures involved", // "no risk" boundary test
];

console.log(`\n\n=== FALSE-NEGATIVE / BOUNDARY PROBE (${PROBES.length}) ===`);
for (const p of PROBES) {
  const flags = scanContentFlags(p);
  const tag = flags.length ? `FLAGGED (${flags.map((f) => f.phrase).join(", ")})` : "missed";
  console.log(`${tag.padEnd(28)} | ${p}`);
}
