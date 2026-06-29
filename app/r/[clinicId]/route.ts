/**
 * Tracked outbound redirect `/r/[clinicId]` (Stage 3.9 / PRD §7).
 *
 * "Visit website" links route through here: we log the click (analytics +
 * future sponsorship billing) then 302 to the clinic's own stored website. The
 * destination is admin-controlled (never user input), so there's no open-redirect
 * risk. Clinics with no website on file fall back to their profile page.
 */
import { Types } from "mongoose";
import { NextResponse } from "next/server";

import { trackOutboundClick } from "@/lib/analytics";
import { dbConnect } from "@/lib/db";
import { Clinic } from "@/models";

// A redirect must never be cached as a static page.
export const dynamic = "force-dynamic";

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

/** Ensure an absolute http(s) URL; returns null if unusable. */
function normalizeUrl(raw?: string): string | null {
  if (!raw?.trim()) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw.trim()}`;
  try {
    return new URL(candidate).toString();
  } catch {
    return null;
  }
}

export async function GET(
  req: Request,
  { params }: { params: { clinicId: string } },
): Promise<NextResponse> {
  const { clinicId } = params;
  if (!OBJECT_ID_RE.test(clinicId)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await dbConnect();
  const clinic = await Clinic.findOne({
    _id: new Types.ObjectId(clinicId),
    status: "published",
    isDeleted: false,
  })
    .select("slug website")
    .lean();

  if (!clinic) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const destination = normalizeUrl(clinic.website);
  await trackOutboundClick({
    clinicId,
    slug: clinic.slug,
    destinationHost: destination ? new URL(destination).host : undefined,
  });

  // No website on file → send them to the profile rather than a dead end.
  const target =
    destination ?? new URL(`/clinic/${clinic.slug}`, req.url).toString();
  return NextResponse.redirect(target, 302);
}
