/**
 * Redirects collection — `/api/admin/redirects`. Admin+ (a redirect is a
 * site-wide routing change, not per-record content), audited like every other
 * admin mutation.
 */
import { revalidateTag } from "next/cache";

import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { REDIRECTS_CACHE_TAG } from "@/lib/redirects";
import { redirectCreateSchema } from "@/lib/validation/redirect";
import { Redirect } from "@/models";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return withRole("admin", async (user) => {
    const parsed = await parseBody(req, redirectCreateSchema);
    if ("error" in parsed) return parsed.error;
    const data = parsed.data;

    await dbConnect();
    if (await Redirect.exists({ from: data.from })) {
      return fail("A redirect for that path already exists.", 409);
    }

    const doc = await Redirect.create({ ...data, createdBy: user.id });

    // The redirect map is cached — drop it so the new rule fires immediately.
    revalidateTag(REDIRECTS_CACHE_TAG);

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "redirect.create",
      entityType: "Redirect",
      entityId: doc._id,
      after: { from: doc.from, to: doc.to, statusCode: doc.statusCode },
    });

    return ok({ id: String(doc._id) }, 201);
  });
}
