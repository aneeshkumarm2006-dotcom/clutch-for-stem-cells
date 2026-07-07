/**
 * Blog media bulk actions — `/api/seoteam/media/bulk`.
 *
 * `delete` removes each selected record + best-effort Cloudinary destroy;
 * `setFolder` moves the selection into a folder. Mirrors the clinics bulk
 * pattern, gated by the shared-password session.
 */
import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withSeoAuth } from "@/lib/seoteam/api";
import { destroyImage, MediaConfigError } from "@/lib/media";
import { mediaBulkSchema } from "@/lib/validation/media";
import { Media } from "@/models";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return withSeoAuth(async () => {
    const parsed = await parseBody(req, mediaBulkSchema);
    if ("error" in parsed) return parsed.error;
    const { ids, action, value } = parsed.data;

    await dbConnect();

    if (action === "setFolder") {
      const folder = (value ?? "").trim();
      if (!folder) return fail("Choose a folder to apply.", 422);
      const result = await Media.updateMany(
        { _id: { $in: ids } },
        { $set: { folder } },
      );
      return ok({ ok: true, count: result.modifiedCount ?? ids.length });
    }

    // action === "delete"
    const docs = await Media.find({ _id: { $in: ids } });
    await Promise.all(
      docs.map(async (doc) => {
        if (!doc.publicId) return;
        try {
          await destroyImage(doc.publicId);
        } catch (err) {
          if (!(err instanceof MediaConfigError)) {
            // eslint-disable-next-line no-console
            console.error("Cloudinary destroy failed:", err);
          }
        }
      }),
    );
    await Media.deleteMany({ _id: { $in: ids } });
    return ok({ ok: true, count: docs.length });
  });
}
