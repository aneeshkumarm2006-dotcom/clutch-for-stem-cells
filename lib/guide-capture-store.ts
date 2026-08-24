/**
 * Browser-side state behind the guide-capture modal.
 *
 * Everything the trigger rules need lives in `localStorage`, for the same
 * reason the shortlist does (`lib/hooks/use-shortlist.tsx`): no cookie is read
 * on the server, so every public page stays statically renderable. Nothing here
 * touches the network and nothing throws, so a browser with storage disabled
 * degrades to "the modal never fires" rather than to a broken page.
 *
 * Two records:
 *
 *   viewed  — the distinct clinic slugs this browser has opened, so the second
 *             *clinic* (not the second page view of one clinic) arms the modal.
 *   gate    — when the modal was last shown, which is what enforces the
 *             once-per-30-days rule. Stamped the moment it opens, not on
 *             dismiss, so closing the tab still counts as a showing.
 */
import {
  CAPTURE_COOLDOWN_DAYS,
  CAPTURE_PROFILE_THRESHOLD,
} from "@/config/guide-capture";

const VIEWED_KEY = "mystemcellguide:clinics-viewed";
const GATE_KEY = "mystemcellguide:guide-capture";

/** Cap the viewed list; we only ever compare its length against a small number. */
const MAX_VIEWED = 50;

const DAY_MS = 86_400_000;

/** Fired by the shortlist provider when a clinic is *added* (never on remove). */
export const SHORTLIST_ADD_EVENT = "sc:shortlist-add";

export interface CaptureGate {
  /** Epoch ms the modal was last opened. */
  shownAt?: number;
  /** Epoch ms an address was last submitted from this browser. */
  capturedAt?: number;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or disabled — the modal simply won't fire */
  }
}

// ── Viewed clinics ──────────────────────────────────────────────────────────

export function readViewedClinics(): string[] {
  const parsed = readJson<unknown>(VIEWED_KEY, []);
  return Array.isArray(parsed)
    ? parsed.filter((s): s is string => typeof s === "string")
    : [];
}

/**
 * Record a clinic profile view and return the new distinct count. Re-opening a
 * clinic already in the list is a no-op, which is what makes the threshold mean
 * "two different clinics".
 */
export function recordClinicView(slug: string): number {
  const seen = readViewedClinics();
  if (seen.includes(slug)) return seen.length;
  const next = [...seen, slug].slice(-MAX_VIEWED);
  writeJson(VIEWED_KEY, next);
  return next.length;
}

/** True once this browser has opened enough distinct clinic profiles. */
export function hasReachedProfileThreshold(count: number): boolean {
  return count >= CAPTURE_PROFILE_THRESHOLD;
}

// ── Cooldown gate ───────────────────────────────────────────────────────────

export function readGate(): CaptureGate {
  const parsed = readJson<CaptureGate>(GATE_KEY, {});
  return parsed && typeof parsed === "object" ? parsed : {};
}

/**
 * True while the browser is inside the cooldown window. A browser that cannot
 * persist the gate reports `true` for the rest of the session (see
 * {@link markShown}) rather than being asked on every navigation.
 */
export function isCoolingDown(now = Date.now()): boolean {
  const { shownAt } = readGate();
  if (!shownAt) return false;
  return now - shownAt < CAPTURE_COOLDOWN_DAYS * DAY_MS;
}

export function markShown(now = Date.now()): void {
  writeJson(GATE_KEY, { ...readGate(), shownAt: now });
}

export function markCaptured(now = Date.now()): void {
  writeJson(GATE_KEY, { ...readGate(), shownAt: now, capturedAt: now });
}

// ── Attribution ─────────────────────────────────────────────────────────────

export interface CaptureUtm {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

/** UTM params off the current URL, blanks omitted. */
export function readUtm(): CaptureUtm | undefined {
  if (typeof window === "undefined") return undefined;
  const params = new URLSearchParams(window.location.search);
  const pick = (key: string): string | undefined =>
    params.get(key)?.trim().slice(0, 200) || undefined;
  const utm: CaptureUtm = {
    source: pick("utm_source"),
    medium: pick("utm_medium"),
    campaign: pick("utm_campaign"),
    term: pick("utm_term"),
    content: pick("utm_content"),
  };
  return Object.values(utm).some(Boolean) ? utm : undefined;
}

/** Referrer, but only when it came from off-site (an internal hop is noise). */
export function readExternalReferrer(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const ref = document.referrer;
  if (!ref) return undefined;
  try {
    if (new URL(ref).host === window.location.host) return undefined;
  } catch {
    return undefined;
  }
  return ref.slice(0, 500);
}
