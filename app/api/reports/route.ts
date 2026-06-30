/**
 * Report / flag submission `/api/reports` (PRD §14 / Stage 8.7).
 *
 * Public, unauthenticated. Lets a visitor flag a review or clinic for admin
 * review; the flag lands `open` in the `/admin/reports` queue. Rate-limited +
 * captcha-guarded like the other public forms. The flagged entity must exist
 * (and, for clinics, be published) so the queue never fills with dead refs.
 * Reporter email is stored privately and never echoed back.
 */
import { NextResponse } from "next/server";

import { dbConnect } from "@/lib/db";
import { guardPublicForm } from "@/lib/public-form";
import { reportCreateSchema } from "@/lib/validation/report";
import { Clinic, Report, Review } from "@/models";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const captchaToken =
    body && typeof body === "object"
      ? ((body as Record<string, unknown>).captchaToken as string | undefined)
      : undefined;

  const blocked = await guardPublicForm(req, {
    action: "report",
    captchaToken,
  });
  if (blocked) return blocked;

  const parsed = reportCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Check the form and try again.",
      },
      { status: 422 },
    );
  }
  const data = parsed.data;

  await dbConnect();

  // Resolve the flagged entity and its owning clinic (for queue grouping).
  let clinicId: string | null = null;
  if (data.entityType === "review") {
    const review = await Review.findOne({ _id: data.entityId, isDeleted: false })
      .select("clinicId")
      .lean();
    if (!review) {
      return NextResponse.json(
        { error: "We couldn't find that review." },
        { status: 404 },
      );
    }
    clinicId = String(review.clinicId);
  } else {
    const clinic = await Clinic.findOne({
      _id: data.entityId,
      isDeleted: false,
    })
      .select("_id")
      .lean();
    if (!clinic) {
      return NextResponse.json(
        { error: "We couldn't find that clinic." },
        { status: 404 },
      );
    }
    clinicId = String(clinic._id);
  }

  await Report.create({
    entityType: data.entityType,
    entityId: data.entityId,
    clinicId,
    reason: data.reason,
    details: data.details?.trim() || undefined,
    reporterEmail: data.reporterEmail?.trim() || undefined,
    status: "open",
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
