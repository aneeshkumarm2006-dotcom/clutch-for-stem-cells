/**
 * Clinic create `/api/admin/clinics` (PRD §8.2 / Stage 6.4). Editor+.
 * Validates with `clinicCreateSchema`, enforces slug uniqueness, audits, and
 * computes the initial `sortScore`.
 */
import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { recomputeSortScore } from "@/lib/ranking";
import { clinicCreateSchema } from "@/lib/validation/clinic";
import { Clinic } from "@/models";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return withRole("editor", async (user) => {
    const parsed = await parseBody(req, clinicCreateSchema);
    if ("error" in parsed) return parsed.error;
    const data = parsed.data;

    await dbConnect();
    if (await Clinic.exists({ slug: data.slug })) {
      return fail("That slug is already taken. Choose another.", 409);
    }

    const clinic = await Clinic.create(data);
    await recomputeSortScore(clinic._id);
    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "clinic.create",
      entityType: "Clinic",
      entityId: clinic._id,
      after: { name: clinic.name, slug: clinic.slug, status: clinic.status },
    });

    return ok({ id: String(clinic._id), slug: clinic.slug }, 201);
  });
}
