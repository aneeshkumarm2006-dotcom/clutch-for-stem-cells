/**
 * Taxonomy update/delete `/api/admin/taxonomy/[kind]/[id]` (PRD §8.5). Editor+.
 * Delete is guarded against terms still referenced by clinics.
 */
import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { getTaxonomyConfig } from "@/lib/admin/taxonomy-config";
import { Clinic } from "@/models";

export const dynamic = "force-dynamic";

const entityType = (kind: string) =>
  kind.charAt(0).toUpperCase() + kind.slice(1);

export async function PATCH(
  req: Request,
  { params }: { params: { kind: string; id: string } },
): Promise<Response> {
  return withRole("editor", async (user) => {
    const config = getTaxonomyConfig(params.kind);
    if (!config) return fail("Unknown taxonomy.", 404);

    const parsed = await parseBody(req, config.updateSchema);
    if ("error" in parsed) return parsed.error;
    const data = parsed.data as Record<string, unknown>;

    await dbConnect();
    if (data.slug) {
      const clash = await config.model.exists({
        slug: data.slug as string,
        _id: { $ne: params.id },
      });
      if (clash) return fail("That slug is already taken.", 409);
    }

    const doc = await config.model.findByIdAndUpdate(params.id, data, {
      new: true,
    });
    if (!doc) return fail("Not found.", 404);

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: `${config.kind}.update`,
      entityType: entityType(config.kind),
      entityId: doc._id,
      after: data,
    });

    return ok({ ok: true });
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: { kind: string; id: string } },
): Promise<Response> {
  return withRole("editor", async (user) => {
    const config = getTaxonomyConfig(params.kind);
    if (!config) return fail("Unknown taxonomy.", 404);

    await dbConnect();
    const doc = await config.model.findById(params.id);
    if (!doc) return fail("Not found.", 404);

    // Guard: refuse to delete a term still referenced by clinics.
    let inUse = 0;
    if (config.clinicField) {
      inUse = await Clinic.countDocuments({
        [config.clinicField]: doc._id,
        isDeleted: false,
      });
    } else if (config.isLocation) {
      inUse = await Clinic.countDocuments({
        "locations.country": doc.name,
        isDeleted: false,
      });
    }
    if (inUse > 0) {
      return fail(
        `Can't delete "${doc.name}" — it's used by ${inUse} clinic${
          inUse === 1 ? "" : "s"
        }. Reassign them first.`,
        409,
      );
    }

    await doc.deleteOne();
    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: `${config.kind}.delete`,
      entityType: entityType(config.kind),
      entityId: params.id,
      before: { name: doc.name, slug: doc.slug },
    });

    return ok({ ok: true });
  });
}
