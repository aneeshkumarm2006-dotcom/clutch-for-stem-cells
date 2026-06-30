/**
 * Report triage `/api/admin/reports/[id]` (PRD §14 / Stage 8.7). Editor+.
 *
 * Updates a flag's moderation status (open → reviewing → resolved/dismissed)
 * with an optional internal note. Records an audit entry. The underlying review
 * or clinic is actioned through its own module (reviews moderation / clinic
 * edit); this route only tracks the flag itself.
 */
import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { reportUpdateSchema } from "@/lib/validation/report";
import { Report } from "@/models";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withRole("editor", async (user) => {
    const parsed = await parseBody(req, reportUpdateSchema);
    if ("error" in parsed) return parsed.error;
    const { status, resolutionNote } = parsed.data;

    await dbConnect();
    const report = await Report.findById(params.id);
    if (!report) return fail("Report not found.", 404);

    report.status = status;
    if (resolutionNote !== undefined) report.resolutionNote = resolutionNote;

    const isClosing = status === "resolved" || status === "dismissed";
    if (isClosing) {
      report.resolvedBy = user.id as never;
      report.resolvedAt = new Date();
    } else {
      report.resolvedBy = null;
      report.resolvedAt = null;
    }

    await report.save();

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: `report.${status}`,
      entityType: "Report",
      entityId: report._id,
      after: { status, entityType: report.entityType },
    });

    return ok({ ok: true });
  });
}
