/**
 * Clinic update/delete `/api/admin/clinics/[id]` (PRD §8.2 / Stage 6.4). Editor+.
 */
import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { recomputeSortScore } from "@/lib/ranking";
import { clinicUpdateSchema } from "@/lib/validation/clinic";
import { Clinic } from "@/models";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withRole("editor", async (user) => {
    const parsed = await parseBody(req, clinicUpdateSchema);
    if ("error" in parsed) return parsed.error;
    const data = parsed.data;

    await dbConnect();
    const clinic = await Clinic.findById(params.id);
    if (!clinic) return fail("Clinic not found.", 404);

    if (data.slug && data.slug !== clinic.slug) {
      if (await Clinic.exists({ slug: data.slug, _id: { $ne: clinic._id } })) {
        return fail("That slug is already taken. Choose another.", 409);
      }
    }

    const before = {
      name: clinic.name,
      slug: clinic.slug,
      status: clinic.status,
      tier: clinic.tier,
    };

    clinic.set(data);
    await clinic.save();
    // Tier / verification / accreditations / completeness feed the score.
    await recomputeSortScore(clinic._id);

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "clinic.update",
      entityType: "Clinic",
      entityId: clinic._id,
      before,
      after: {
        name: clinic.name,
        slug: clinic.slug,
        status: clinic.status,
        tier: clinic.tier,
      },
      diffOnly: true,
    });

    return ok({ id: String(clinic._id), slug: clinic.slug });
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withRole("editor", async (user) => {
    await dbConnect();
    const clinic = await Clinic.findById(params.id);
    if (!clinic) return fail("Clinic not found.", 404);

    clinic.isDeleted = true;
    clinic.deletedAt = new Date();
    await clinic.save();

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "clinic.delete",
      entityType: "Clinic",
      entityId: clinic._id,
      before: { name: clinic.name, slug: clinic.slug },
    });

    return ok({ ok: true });
  });
}
