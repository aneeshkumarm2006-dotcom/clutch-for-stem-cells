/**
 * Profile-claim approval `/api/admin/providers/claims/[clinicId]` (PRD §8.8).
 * Admin+. Approve confirms the claim; decline unassigns the owner.
 * (Full self-serve onboarding is Phase 2. // PRD-ASSUMPTION)
 */
import { z } from "zod";

import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { Clinic } from "@/models";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["approve", "decline"]) });

export async function POST(
  req: Request,
  { params }: { params: { clinicId: string } },
): Promise<Response> {
  return withRole("admin", async (actor) => {
    const parsed = await parseBody(req, schema);
    if ("error" in parsed) return parsed.error;

    await dbConnect();
    const clinic = await Clinic.findById(params.clinicId);
    if (!clinic) return fail("Clinic not found.", 404);

    if (parsed.data.action === "approve") {
      clinic.isClaimed = true;
    } else {
      clinic.isClaimed = false;
      clinic.ownerUserId = null;
    }
    await clinic.save();

    await recordAuditFromRequest(req, {
      actorUserId: actor.id,
      action: `provider.${parsed.data.action}`,
      entityType: "Clinic",
      entityId: clinic._id,
      after: { isClaimed: clinic.isClaimed },
    });

    return ok({ ok: true });
  });
}
