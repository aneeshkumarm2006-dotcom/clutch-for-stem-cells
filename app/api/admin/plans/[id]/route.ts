/**
 * Plan update/delete `/api/admin/plans/[id]` (PRD §8.9 / Stage 6.11). Admin+.
 */
import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { planUpdateSchema } from "@/lib/validation/plan";
import { Plan } from "@/models";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withRole("admin", async (user) => {
    const parsed = await parseBody(req, planUpdateSchema);
    if ("error" in parsed) return parsed.error;

    await dbConnect();
    const plan = await Plan.findByIdAndUpdate(params.id, parsed.data, {
      new: true,
    });
    if (!plan) return fail("Plan not found.", 404);

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "plan.update",
      entityType: "Plan",
      entityId: plan._id,
      after: parsed.data,
    });
    return ok({ ok: true });
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withRole("admin", async (user) => {
    await dbConnect();
    const plan = await Plan.findByIdAndDelete(params.id);
    if (!plan) return fail("Plan not found.", 404);

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "plan.delete",
      entityType: "Plan",
      entityId: params.id,
      before: { key: plan.key, name: plan.name },
    });
    return ok({ ok: true });
  });
}
