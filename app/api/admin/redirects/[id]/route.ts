/**
 * Single redirect — `/api/admin/redirects/[id]`. Admin+, audited.
 */
import { revalidateTag } from "next/cache";
import { isValidObjectId } from "mongoose";

import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { REDIRECTS_CACHE_TAG } from "@/lib/redirects";
import { redirectUpdateSchema } from "@/lib/validation/redirect";
import { Redirect } from "@/models";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withRole("admin", async (user) => {
    if (!isValidObjectId(params.id)) return fail("Redirect not found.", 404);

    const parsed = await parseBody(req, redirectUpdateSchema);
    if ("error" in parsed) return parsed.error;

    await dbConnect();
    const doc = await Redirect.findById(params.id);
    if (!doc) return fail("Redirect not found.", 404);

    const before = { to: doc.to, statusCode: doc.statusCode };
    doc.set(parsed.data);
    await doc.save();

    revalidateTag(REDIRECTS_CACHE_TAG);

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "redirect.update",
      entityType: "Redirect",
      entityId: doc._id,
      before,
      after: { to: doc.to, statusCode: doc.statusCode },
    });

    return ok({ id: String(doc._id) });
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withRole("admin", async (user) => {
    if (!isValidObjectId(params.id)) return fail("Redirect not found.", 404);

    await dbConnect();
    const doc = await Redirect.findByIdAndDelete(params.id);
    if (!doc) return fail("Redirect not found.", 404);

    revalidateTag(REDIRECTS_CACHE_TAG);

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "redirect.delete",
      entityType: "Redirect",
      entityId: doc._id,
      before: { from: doc.from, to: doc.to },
    });

    return ok({ ok: true });
  });
}
