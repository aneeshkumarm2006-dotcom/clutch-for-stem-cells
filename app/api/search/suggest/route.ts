/**
 * Typeahead suggestions `/api/search/suggest` (Stage 5.7 / PRD §6.6).
 *
 * Powers the header search dropdown: matching clinics, treatments, and
 * conditions. Read-only and lightweight (capped result count).
 */
import { NextResponse } from "next/server";

import { suggestClinics } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ suggestions: [] });
  const suggestions = await suggestClinics(q, 6);
  return NextResponse.json({ suggestions });
}
