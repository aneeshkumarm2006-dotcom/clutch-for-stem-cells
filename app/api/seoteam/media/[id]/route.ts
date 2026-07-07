/**
 * Blog media item — `/api/seoteam/media/[id]`.
 *
 * `PATCH` edits metadata (alt/folder); `DELETE` removes the record and
 * best-effort destroys the Cloudinary asset. Mirrors `/api/admin/media/[id]`
 * but gated by the shared-password session (no per-user audit).
 */
import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withSeoAuth } from "@/lib/seoteam/api";
import { destroyImage, MediaConfigError } from "@/lib/media";
import { mediaUpdateSchema } from "@/lib/validation/media";
import { Media } from "@/models";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withSeoAuth(async () => {
    const parsed = await parseBody(req, mediaUpdateSchema);
    if ("error" in parsed) return parsed.error;

    await dbConnect();
    const doc = await Media.findByIdAndUpdate(params.id, parsed.data, {
      new: true,
    }).lean();
    if (!doc) return fail("Image not found.", 404);
    return ok({ ok: true });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withSeoAuth(async () => {
    await dbConnect();
    const doc = await Media.findById(params.id);
    if (!doc) return fail("Image not found.", 404);

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
    return ok({ ok: true });
  });
}
