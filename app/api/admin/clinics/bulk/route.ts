/**
 * Clinics bulk actions (PRD §8.2) — publish/unpublish, set tier, verify/unverify,
 * soft-delete/restore. Also serves single-row actions (ids of length 1).
 * Editor+; recomputes `sortScore` when a ranking input (tier/verification)
 * changes, and records one audit entry per affected clinic.
 */
import { z } from "zod";

import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { recomputeSortScore } from "@/lib/ranking";
import { objectIdSchema } from "@/lib/validation/common";
import { CLINIC_TIERS } from "@/lib/enums";
import { Clinic } from "@/models";

export const dynamic = "force-dynamic";

const bulkSchema = z.object({
  ids: z.array(objectIdSchema).min(1, "Select at least one clinic."),
  action: z.enum([
    "publish",
    "unpublish",
    "verify",
    "unverify",
    "setTier",
    "delete",
    "restore",
  ]),
  value: z.enum(CLINIC_TIERS).optional(),
});

export async function POST(req: Request): Promise<Response> {
  return withRole("editor", async (user) => {
    const parsed = await parseBody(req, bulkSchema);
    if ("error" in parsed) return parsed.error;
    const { ids, action, value } = parsed.data;

    if (action === "setTier" && !value) {
      return fail("Choose a tier to apply.", 422);
    }

    await dbConnect();

    let update: Record<string, unknown>;
    let affectsRanking = false;
    switch (action) {
      case "publish":
        update = { status: "published" };
        break;
      case "unpublish":
        update = { status: "draft" };
        break;
      case "verify":
        update = {
          "verification.isVerified": true,
          "verification.verifiedAt": new Date(),
        };
        affectsRanking = true;
        break;
      case "unverify":
        update = {
          "verification.isVerified": false,
          "verification.verifiedAt": null,
        };
        affectsRanking = true;
        break;
      case "setTier":
        update = { tier: value };
        affectsRanking = true;
        break;
      case "delete":
        update = { isDeleted: true, deletedAt: new Date() };
        break;
      case "restore":
        update = { isDeleted: false, deletedAt: null };
        break;
      default:
        return fail("Unknown action.", 400);
    }

    const result = await Clinic.updateMany({ _id: { $in: ids } }, { $set: update });

    if (affectsRanking) {
      await Promise.all(ids.map((cid) => recomputeSortScore(cid)));
    }

    await Promise.all(
      ids.map((cid) =>
        recordAuditFromRequest(req, {
          actorUserId: user.id,
          action: `clinic.${action}`,
          entityType: "Clinic",
          entityId: cid,
          after: update,
        }),
      ),
    );

    return ok({ ok: true, count: result.modifiedCount ?? ids.length });
  });
}
