/**
 * Taxonomy update/delete `/api/admin/taxonomy/[kind]/[id]` (PRD §8.5). Editor+.
 * Delete is guarded against terms still referenced by clinics.
 */
import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { getTaxonomyConfig } from "@/lib/admin/taxonomy-config";
import { sanitizeBlocks } from "@/lib/blocks/server";
import { reviewEditorialWrite } from "@/lib/content-review";
import { blocksSchema } from "@/lib/validation/block";
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

    // Sanitize section blocks only when they were part of this patch; a PATCH
    // that omits `blocks` (e.g. the list's Active toggle) leaves them untouched.
    if (data.blocks !== undefined) {
      data.blocks = sanitizeBlocks(blocksSchema.parse(data.blocks));
    }

    await dbConnect();
    if (data.slug) {
      const clash = await config.model.exists({
        slug: data.slug as string,
        _id: { $ne: params.id },
      });
      if (clash) return fail("That slug is already taken.", 409);
    }

    // YMYL review gate: scan the merged (existing + patch) state, block
    // unreviewed/unacknowledged approvals, and persist recomputed flags.
    const existing = await config.model.findById(params.id).lean();
    if (!existing) return fail("Not found.", 404);
    const existingRecord = existing as unknown as Record<string, unknown>;
    const gate = reviewEditorialWrite(existingRecord, data);
    if (gate.error) return fail(gate.error, 422);

    // Refresh the medical-review date on any approved save (freshness cadence).
    const isApproved =
      (data.reviewStatus ?? existingRecord.reviewStatus) === "approved";

    const doc = await config.model.findByIdAndUpdate(
      params.id,
      {
        ...data,
        contentFlags: gate.contentFlags,
        ...(isApproved && data.lastReviewedAt == null
          ? { lastReviewedAt: new Date() }
          : {}),
      },
      { new: true },
    );
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
        `Can't delete "${doc.name}". It's used by ${inUse} clinic${
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
