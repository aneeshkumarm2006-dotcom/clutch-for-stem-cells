/**
 * Typeahead suggestions `/api/search/suggest` (Stage 5.7 / PRD §6.6).
 *
 * Powers the header and hero search dropdowns: matching clinics, treatments,
 * conditions, and destinations. Read-only, capped, and rate limited — a
 * typeahead fires on nearly every keystroke, so this is the chattiest public
 * endpoint on the site.
 *
 * Query params:
 * - `q`      the (trimmed) search term; under 2 characters returns nothing
 * - `limit`  1..MAX_SUGGESTIONS, default 8
 * - `types`  comma-joined subset of clinic|treatment|condition|location, so a
 *            location-only field doesn't pay for clinic and taxonomy lookups
 */
import { NextResponse } from "next/server";

import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import {
  MAX_SUGGESTIONS,
  SUGGESTION_TYPES,
  suggestClinics,
  type SuggestionType,
} from "@/lib/search";

export const dynamic = "force-dynamic";

/** Generous: a fast typist on a debounced field lands well inside this. */
const RATE_LIMIT = { limit: 120, windowSeconds: 60 };

const DEFAULT_LIMIT = 8;

const EMPTY = { suggestions: [] };

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function GET(req: Request): Promise<NextResponse> {
  const params = new URL(req.url).searchParams;
  const q = params.get("q")?.trim() ?? "";
  // One character matches most of the database; it is noise, not a suggestion.
  if (q.length < 2) return NextResponse.json(EMPTY);

  const limited = await rateLimit(`suggest:${clientIp(req)}`, RATE_LIMIT);
  if (!limited.success) {
    return NextResponse.json(EMPTY, {
      status: 429,
      headers: rateLimitHeaders(limited),
    });
  }

  // `Number(null)` and `Number("")` are both 0, and 0 is finite — reading the
  // param straight through silently clamped a missing `limit` to one result.
  const limitRaw = params.get("limit")?.trim();
  const requested = limitRaw ? Number(limitRaw) : NaN;
  const limit =
    Number.isFinite(requested) && requested >= 1
      ? Math.min(Math.trunc(requested), MAX_SUGGESTIONS)
      : DEFAULT_LIMIT;

  const types = (params.get("types") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t): t is SuggestionType =>
      (SUGGESTION_TYPES as readonly string[]).includes(t),
    );

  const suggestions = await suggestClinics(q, { limit, types });

  return NextResponse.json(
    { suggestions },
    {
      headers: {
        // Suggestions are public and identical for every visitor, so let the
        // CDN absorb the popular prefixes ("stem", "msc", "mex") instead of
        // hitting Mongo for each one.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        ...rateLimitHeaders(limited),
      },
    },
  );
}
