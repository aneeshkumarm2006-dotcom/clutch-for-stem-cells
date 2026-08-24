/**
 * Guide-capture trigger rules — behavioural tests.
 *
 * Four rules decide whether a visitor ever sees the capture modal, and each one
 * is a pure function so it can be exercised without a browser:
 *
 *   1. never on the trust pages (/methodology, /medical-disclaimer, /privacy)
 *   2. only clinic profile URLs count as a clinic view
 *   3. the *second distinct* clinic arms the trigger, not the second page view
 *   4. the modal is offered at most once per 30 days
 *
 * Rules 3 and 4 live in `lib/guide-capture-store.ts`, which reads
 * `localStorage`; the stub below is enough for the branch under test, since the
 * store never touches anything else on `window`.
 *
 * Run: npx tsx --tsconfig tsconfig.test.json --test tests/guide-capture/rules.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CAPTURE_COOLDOWN_DAYS,
  CAPTURE_PROFILE_THRESHOLD,
  clinicSlugFromPath,
  isCaptureSuppressed,
} from "@/config/guide-capture";

import {
  hasReachedProfileThreshold,
  isCoolingDown,
  markShown,
  readViewedClinics,
  recordClinicView,
} from "@/lib/guide-capture-store";

/**
 * Minimal `window.localStorage`. The store checks `typeof window` inside each
 * accessor rather than at import time, so installing the stub at module scope
 * (before any `test()` body runs) is enough.
 */
const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
};

const DAY_MS = 86_400_000;

// ── Rule 1: the trust pages are off limits ──────────────────────────────────

test("rule 1: the three trust pages are suppressed", () => {
  for (const path of ["/methodology", "/medical-disclaimer", "/privacy"]) {
    assert.equal(isCaptureSuppressed(path), true, path);
    // A trailing slash is the same page.
    assert.equal(isCaptureSuppressed(`${path}/`), true, `${path}/`);
    // So is anything nested under it.
    assert.equal(isCaptureSuppressed(`${path}/section`), true);
  }
});

test("rule 1: ordinary pages are not suppressed", () => {
  for (const path of [
    "/",
    "/clinics",
    "/clinic/example-clinic",
    "/shortlist",
    // A prefix collision must not suppress an unrelated route.
    "/privacy-and-you",
    "/methodology-notes",
  ]) {
    assert.equal(isCaptureSuppressed(path), false, path);
  }
});

// ── Rule 2: what counts as viewing a clinic profile ─────────────────────────

test("rule 2: the profile and both sub-pages resolve to the same clinic", () => {
  assert.equal(clinicSlugFromPath("/clinic/acme-clinic"), "acme-clinic");
  assert.equal(clinicSlugFromPath("/clinic/acme-clinic/reviews"), "acme-clinic");
  assert.equal(clinicSlugFromPath("/clinic/acme-clinic/cost"), "acme-clinic");
  assert.equal(clinicSlugFromPath("/clinic/acme-clinic/"), "acme-clinic");
});

test("rule 2: nothing else is a clinic view", () => {
  for (const path of [
    "/clinics",
    "/",
    "/clinic",
    // An unknown sub-route is not a profile page.
    "/clinic/acme-clinic/gallery",
    "/treatments/prp",
  ]) {
    assert.equal(clinicSlugFromPath(path), null, path);
  }
});

// ── Rule 3: the second *distinct* clinic ────────────────────────────────────

test("rule 3: re-reading one clinic never reaches the threshold", () => {
  store.clear();
  assert.equal(recordClinicView("acme-clinic"), 1);
  // The same clinic again, e.g. via its reviews and cost sub-pages.
  assert.equal(recordClinicView("acme-clinic"), 1);
  assert.equal(recordClinicView("acme-clinic"), 1);
  assert.equal(hasReachedProfileThreshold(1), false);
});

test("rule 3: a second clinic arms the trigger", () => {
  store.clear();
  recordClinicView("acme-clinic");
  const count = recordClinicView("beta-clinic");
  assert.equal(count, CAPTURE_PROFILE_THRESHOLD);
  assert.equal(hasReachedProfileThreshold(count), true);
  assert.deepEqual(readViewedClinics(), ["acme-clinic", "beta-clinic"]);
});

// ── Rule 4: once per 30 days ────────────────────────────────────────────────

test("rule 4: a fresh browser is not cooling down", () => {
  store.clear();
  assert.equal(isCoolingDown(), false);
});

test("rule 4: showing the modal starts the cooldown", () => {
  store.clear();
  const now = Date.UTC(2026, 0, 1);
  markShown(now);
  assert.equal(isCoolingDown(now), true);
  // One day short of the window is still inside it.
  assert.equal(
    isCoolingDown(now + (CAPTURE_COOLDOWN_DAYS - 1) * DAY_MS),
    true,
  );
});

test("rule 4: the cooldown expires exactly at the window edge", () => {
  store.clear();
  const now = Date.UTC(2026, 0, 1);
  markShown(now);
  assert.equal(isCoolingDown(now + CAPTURE_COOLDOWN_DAYS * DAY_MS), false);
  assert.equal(
    isCoolingDown(now + (CAPTURE_COOLDOWN_DAYS + 1) * DAY_MS),
    false,
  );
});
