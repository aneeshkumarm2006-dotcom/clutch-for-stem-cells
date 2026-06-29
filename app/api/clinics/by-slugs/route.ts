/**
 * Resolve clinic cards by slug `/api/clinics/by-slugs` (Stage 5.11).
 *
 * Powers the client-side shortlist view, whose source of truth is the local/synced
 * set of slugs. Returns card view models in the order requested. Public + read-only.
 */
import { NextResponse } from "next/server";

import { getClinicsBySlugs } from "@/lib/public-data";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const raw = new URL(req.url).searchParams.get("slugs") ?? "";
  const slugs = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 60);
  if (!slugs.length) return NextResponse.json({ clinics: [] });
  const clinics = await getClinicsBySlugs(slugs);
  return NextResponse.json({ clinics });
}
