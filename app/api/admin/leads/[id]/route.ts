/**
 * Lead workflow `/api/admin/leads/[id]` (PRD §8.4 / Stage 6.6). Editor+.
 * Status transitions, assignment, and appending internal notes.
 */
import { z } from "zod";

import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { objectIdSchema } from "@/lib/validation/common";
import { LEAD_STATUSES } from "@/lib/enums";
import { Lead } from "@/models";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  assignedTo: objectIdSchema.nullish(),
  note: z.string().max(4000).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withRole("editor", async (user) => {
    const parsed = await parseBody(req, patchSchema);
    if ("error" in parsed) return parsed.error;
    const { status, assignedTo, note } = parsed.data;

    await dbConnect();
    const lead = await Lead.findById(params.id);
    if (!lead) return fail("Lead not found.", 404);

    if (status) lead.status = status;
    if (assignedTo !== undefined) {
      lead.assignedTo = (assignedTo || null) as never;
    }
    if (note?.trim()) {
      lead.internalNotes.push({
        note: note.trim(),
        byUserId: user.id as never,
        at: new Date(),
      });
    }

    await lead.save();

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: note?.trim() ? "lead.note" : "lead.update",
      entityType: "Lead",
      entityId: lead._id,
      after: { status: lead.status, assignedTo: lead.assignedTo },
    });

    return ok({ ok: true });
  });
}
