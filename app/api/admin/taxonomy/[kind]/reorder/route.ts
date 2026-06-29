/**
 * Taxonomy reorder `/api/admin/taxonomy/[kind]/reorder` (PRD §8.5 drag-sort).
 * Persists `order` = position for the supplied ordered id list. Editor+.
 */
import { z } from "zod";

import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { objectIdSchema } from "@/lib/validation/common";
import { getTaxonomyConfig } from "@/lib/admin/taxonomy-config";

export const dynamic = "force-dynamic";

const reorderSchema = z.object({ ids: z.array(objectIdSchema).min(1) });

export async function POST(
  req: Request,
  { params }: { params: { kind: string } },
): Promise<Response> {
  return withRole("editor", async (user) => {
    const config = getTaxonomyConfig(params.kind);
    if (!config) return fail("Unknown taxonomy.", 404);

    const parsed = await parseBody(req, reorderSchema);
    if ("error" in parsed) return parsed.error;

    await dbConnect();
    await config.model.bulkWrite(
      parsed.data.ids.map((id, index) => ({
        updateOne: { filter: { _id: id }, update: { $set: { order: index } } },
      })),
    );

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: `${config.kind}.reorder`,
      entityType: config.kind.charAt(0).toUpperCase() + config.kind.slice(1),
    });

    return ok({ ok: true });
  });
}
