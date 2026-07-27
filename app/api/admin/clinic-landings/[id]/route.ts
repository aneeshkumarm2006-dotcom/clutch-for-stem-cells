/**
 * Clinic landing-page update/delete `/api/admin/clinic-landings/[id]`. Editor+.
 *
 * Deleting removes a live URL, so the handler records the slug in the audit
 * entry — that's what a redirect would later be built from.
 */
import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { clinicLandingUpdateSchema } from "@/lib/validation/clinic-landing";
import { ClinicLanding } from "@/models";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withRole("editor", async (user) => {
    const parsed = await parseBody(req, clinicLandingUpdateSchema);
    if ("error" in parsed) return parsed.error;
    const data = parsed.data;

    await dbConnect();
    if (data.slug) {
      const clash = await ClinicLanding.exists({
        slug: data.slug,
        _id: { $ne: params.id },
      });
      if (clash) return fail("That slug is already taken.", 409);
    }

    const doc = await ClinicLanding.findByIdAndUpdate(params.id, data, {
      new: true,
    });
    if (!doc) return fail("Not found.", 404);

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "clinicLanding.update",
      entityType: "ClinicLanding",
      entityId: doc._id,
      after: data,
    });

    return ok({ ok: true });
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withRole("editor", async (user) => {
    await dbConnect();
    const doc = await ClinicLanding.findById(params.id);
    if (!doc) return fail("Not found.", 404);

    await doc.deleteOne();
    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "clinicLanding.delete",
      entityType: "ClinicLanding",
      entityId: params.id,
      before: { name: doc.name, slug: doc.slug },
    });

    return ok({ ok: true });
  });
}
