/**
 * Plan create `/api/admin/plans` (PRD §8.9 / Stage 6.11). Admin+.
 */
import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { planCreateSchema } from "@/lib/validation/plan";
import { Plan } from "@/models";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return withRole("admin", async (user) => {
    const parsed = await parseBody(req, planCreateSchema);
    if ("error" in parsed) return parsed.error;

    await dbConnect();
    if (await Plan.exists({ key: parsed.data.key })) {
      return fail("A plan with that key already exists.", 409);
    }

    const plan = await Plan.create(parsed.data);
    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "plan.create",
      entityType: "Plan",
      entityId: plan._id,
      after: { key: plan.key, name: plan.name },
    });
    return ok({ id: String(plan._id) }, 201);
  });
}
