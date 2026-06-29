/**
 * Taxonomy create `/api/admin/taxonomy/[kind]` (PRD §8.5 / Stage 6.7). Editor+.
 */
import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { getTaxonomyConfig } from "@/lib/admin/taxonomy-config";

export const dynamic = "force-dynamic";

const entityType = (kind: string) =>
  kind.charAt(0).toUpperCase() + kind.slice(1);

export async function POST(
  req: Request,
  { params }: { params: { kind: string } },
): Promise<Response> {
  return withRole("editor", async (user) => {
    const config = getTaxonomyConfig(params.kind);
    if (!config) return fail("Unknown taxonomy.", 404);

    const parsed = await parseBody(req, config.createSchema);
    if ("error" in parsed) return parsed.error;
    const data = parsed.data as Record<string, unknown>;

    await dbConnect();
    if (await config.model.exists({ slug: data.slug as string })) {
      return fail("That slug is already taken.", 409);
    }

    const order = await config.model.countDocuments();
    const doc = await config.model.create({ ...data, order });

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: `${config.kind}.create`,
      entityType: entityType(config.kind),
      entityId: doc._id,
      after: { name: doc.name, slug: doc.slug },
    });

    return ok({ id: String(doc._id) }, 201);
  });
}
