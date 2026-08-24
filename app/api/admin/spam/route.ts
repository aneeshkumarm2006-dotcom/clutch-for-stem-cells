/**
 * Blocked-submission bin `/api/admin/spam`. Admin+.
 *
 * DELETE purges the bin — either one record (`?id=`) or everything currently
 * matching a form filter (`?form=lead|review|report|all`).
 *
 * Purging is Admin-only rather than Editor: this is the ONLY copy of a rejected
 * payload, so emptying it destroys the evidence a false positive would be found
 * in. Records also expire on their own after 30 days via the TTL index, so
 * manual purging is a convenience, never a requirement.
 */
import { fail, ok, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { dbConnect } from "@/lib/db";
import { BLOCKED_FORMS, BlockedSubmission } from "@/models";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request): Promise<Response> {
  return withRole("admin", async (user) => {
    const url = new URL(req.url);
    const singleId = url.searchParams.get("id");
    const form = url.searchParams.get("form") ?? "all";

    await dbConnect();

    if (singleId) {
      const doc = await BlockedSubmission.findByIdAndDelete(singleId);
      if (!doc) return fail("Not found.", 404);
      await recordAuditFromRequest(req, {
        actorUserId: user.id,
        action: "spam.purge",
        entityType: "BlockedSubmission",
        entityId: doc._id,
      });
      return ok({ ok: true, deleted: 1 });
    }

    if (form !== "all" && !BLOCKED_FORMS.includes(form as never)) {
      return fail("Unknown form filter.", 422);
    }

    const filter = form === "all" ? {} : { form: form as never };
    const { deletedCount } = await BlockedSubmission.deleteMany(filter);

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "spam.purge",
      entityType: "BlockedSubmission",
      after: { form, deleted: deletedCount ?? 0 },
    });

    return ok({ ok: true, deleted: deletedCount ?? 0 });
  });
}
