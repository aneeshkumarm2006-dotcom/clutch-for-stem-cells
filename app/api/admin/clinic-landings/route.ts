/**
 * Clinic landing-page create `/api/admin/clinic-landings`. Editor+.
 *
 * The slug becomes a public URL segment under `/clinics/`, so it is checked for
 * collisions against existing landing pages before the record is written.
 */
import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { clinicLandingCreateSchema } from "@/lib/validation/clinic-landing";
import { ClinicLanding } from "@/models";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return withRole("editor", async (user) => {
    const parsed = await parseBody(req, clinicLandingCreateSchema);
    if ("error" in parsed) return parsed.error;
    const data = parsed.data;

    await dbConnect();
    if (await ClinicLanding.exists({ slug: data.slug })) {
      return fail("That slug is already taken.", 409);
    }

    const order = data.order ?? (await ClinicLanding.countDocuments());
    const doc = await ClinicLanding.create({ ...data, order });

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "clinicLanding.create",
      entityType: "ClinicLanding",
      entityId: doc._id,
      after: { name: doc.name, slug: doc.slug },
    });

    return ok({ id: String(doc._id) }, 201);
  });
}
