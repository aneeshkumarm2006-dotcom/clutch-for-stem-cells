/**
 * Guide-capture triage `/api/admin/email-captures/[id]`. Editor+ to update,
 * Admin+ to delete.
 *
 * PATCH moves a record through its lifecycle (new / archived / unsubscribed /
 * spam) and stores an internal note. DELETE is the hard erasure path a privacy
 * request needs: these records are a person's email address, so "archived" is
 * not always a sufficient answer and there is nothing here worth soft-deleting.
 * Both record an audit entry.
 */
import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { emailCaptureUpdateSchema } from "@/lib/validation/email-capture";
import { EmailCapture } from "@/models";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withRole("editor", async (user) => {
    const parsed = await parseBody(req, emailCaptureUpdateSchema);
    if ("error" in parsed) return parsed.error;
    const { status, internalNote } = parsed.data;

    await dbConnect();
    const capture = await EmailCapture.findById(params.id);
    if (!capture) return fail("Capture not found.", 404);

    if (status !== undefined) capture.status = status;
    if (internalNote !== undefined) {
      capture.internalNote = internalNote || undefined;
    }
    await capture.save();

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: status ? `capture.${status}` : "capture.note",
      entityType: "EmailCapture",
      entityId: capture._id,
      after: { status: capture.status },
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
    const capture = await EmailCapture.findById(params.id);
    if (!capture) return fail("Capture not found.", 404);

    await capture.deleteOne();

    // The audit trail deliberately keeps the address: deletion of a contact
    // record is exactly the action that has to stay accountable.
    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "capture.delete",
      entityType: "EmailCapture",
      entityId: capture._id,
      before: { email: capture.email, trigger: capture.trigger },
    });

    return ok({ ok: true });
  });
}
