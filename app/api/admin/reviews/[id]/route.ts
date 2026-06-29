/**
 * Review moderation `/api/admin/reviews/[id]` (PRD §8.3 / Stage 6.5). Editor+.
 *
 * Action-based PATCH (approve/reject/verify/spam/edit/provider-response) + soft
 * DELETE. Any change that affects which reviews count toward a clinic's rating
 * recomputes `ratingAvg`/`ratingBreakdown`/`reviewCount`/`topMentions`.
 */
import { z } from "zod";

import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { recomputeClinicRatings } from "@/lib/ratings";
import { reviewUpdateSchema } from "@/lib/validation/review";
import { Review } from "@/models";

export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum([
    "approve",
    "reject",
    "verify",
    "unverify",
    "spam",
    "restore",
    "edit",
    "providerResponse",
    "removeResponse",
  ]),
  reason: z.string().max(2000).optional(),
  responseBody: z.string().max(4000).optional(),
  data: reviewUpdateSchema.optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withRole("editor", async (user) => {
    const parsed = await parseBody(req, actionSchema);
    if ("error" in parsed) return parsed.error;
    const { action, reason, responseBody, data } = parsed.data;

    await dbConnect();
    const review = await Review.findById(params.id);
    if (!review) return fail("Review not found.", 404);

    let recompute = false;
    const now = new Date();

    switch (action) {
      case "approve":
        review.status = "approved";
        review.moderation = {
          ...review.moderation,
          reviewedBy: user.id as never,
          reviewedAt: now,
        };
        recompute = true;
        break;
      case "reject":
        review.status = "rejected";
        review.moderation = {
          ...review.moderation,
          reviewedBy: user.id as never,
          reviewedAt: now,
          rejectionReason: reason,
        };
        recompute = true;
        break;
      case "spam":
        review.status = "spam";
        recompute = true;
        break;
      case "restore":
        review.status = "pending";
        recompute = true;
        break;
      case "verify":
        review.isVerified = true;
        if (!review.verificationMethod) review.verificationMethod = "document";
        break;
      case "unverify":
        review.isVerified = false;
        break;
      case "edit":
        if (data) review.set(data);
        recompute = review.status === "approved";
        break;
      case "providerResponse":
        if (!responseBody?.trim()) return fail("Response text is required.", 422);
        review.providerResponse = {
          body: responseBody.trim(),
          respondedAt: now,
          byUserId: user.id as never,
        };
        break;
      case "removeResponse":
        review.providerResponse = undefined;
        break;
      default:
        return fail("Unknown action.", 400);
    }

    await review.save();
    if (recompute) await recomputeClinicRatings(review.clinicId);

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: `review.${action}`,
      entityType: "Review",
      entityId: review._id,
      after: { status: review.status, isVerified: review.isVerified, reason },
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
    const review = await Review.findById(params.id);
    if (!review) return fail("Review not found.", 404);

    const wasApproved = review.status === "approved";
    review.isDeleted = true;
    review.deletedAt = new Date();
    await review.save();
    if (wasApproved) await recomputeClinicRatings(review.clinicId);

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "review.delete",
      entityType: "Review",
      entityId: review._id,
    });

    return ok({ ok: true });
  });
}
