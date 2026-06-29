/**
 * Media item API (PRD §8.11) — edit metadata / delete from library + provider.
 */
import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { destroyImage, MediaConfigError } from "@/lib/media";
import { mediaUpdateSchema } from "@/lib/validation/media";
import { Media } from "@/models";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withRole("editor", async (user) => {
    const parsed = await parseBody(req, mediaUpdateSchema);
    if ("error" in parsed) return parsed.error;

    await dbConnect();
    const doc = await Media.findByIdAndUpdate(params.id, parsed.data, {
      new: true,
    }).lean();
    if (!doc) return fail("Media not found.", 404);

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "media.update",
      entityType: "Media",
      entityId: params.id,
      after: parsed.data,
    });
    return ok({ ok: true });
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withRole("editor", async (user) => {
    await dbConnect();
    const doc = await Media.findById(params.id);
    if (!doc) return fail("Media not found.", 404);

    // Best-effort provider cleanup — never block the library delete on it.
    if (doc.publicId) {
      try {
        await destroyImage(doc.publicId);
      } catch (err) {
        if (!(err instanceof MediaConfigError)) {
          // eslint-disable-next-line no-console
          console.error("Cloudinary destroy failed:", err);
        }
      }
    }

    await doc.deleteOne();
    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "media.delete",
      entityType: "Media",
      entityId: params.id,
      before: { url: doc.url, publicId: doc.publicId },
    });
    return ok({ ok: true });
  });
}
