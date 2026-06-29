/**
 * Bulk review moderation (PRD §8.3) — approve / reject / spam many at once.
 * Editor+; recomputes ratings for every affected clinic.
 */
import { z } from "zod";

import { dbConnect } from "@/lib/db";
import { ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { recomputeClinicRatings } from "@/lib/ratings";
import { objectIdSchema } from "@/lib/validation/common";
import { Review } from "@/models";

export const dynamic = "force-dynamic";

const bulkSchema = z.object({
  ids: z.array(objectIdSchema).min(1, "Select at least one review."),
  action: z.enum(["approve", "reject", "spam"]),
  reason: z.string().max(2000).optional(),
});

const STATUS = { approve: "approved", reject: "rejected", spam: "spam" } as const;

export async function POST(req: Request): Promise<Response> {
  return withRole("editor", async (user) => {
    const parsed = await parseBody(req, bulkSchema);
    if ("error" in parsed) return parsed.error;
    const { ids, action, reason } = parsed.data;

    await dbConnect();
    const reviews = await Review.find({ _id: { $in: ids } }).select("clinicId");
    const clinicIds = [...new Set(reviews.map((r) => String(r.clinicId)))];

    await Review.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          status: STATUS[action],
          "moderation.reviewedBy": user.id,
          "moderation.reviewedAt": new Date(),
          ...(reason ? { "moderation.rejectionReason": reason } : {}),
        },
      },
    );

    await Promise.all(clinicIds.map((cid) => recomputeClinicRatings(cid)));
    await Promise.all(
      ids.map((rid) =>
        recordAuditFromRequest(req, {
          actorUserId: user.id,
          action: `review.${action}`,
          entityType: "Review",
          entityId: rid,
        }),
      ),
    );

    return ok({ ok: true, count: ids.length });
  });
}
