/**
 * Image upload — `/api/seoteam/upload` (multipart). Reuses the project's
 * Cloudinary pipeline (lib/media.ts). Used for cover images and inline editor
 * images. Validated for MIME/size; falls back to a clear 503 when image hosting
 * isn't configured (the editor then offers a paste-URL field).
 */
import { fail, ok, withSeoAuth } from "@/lib/seoteam/api";
import {
  MediaConfigError,
  MediaValidationError,
  uploadImage,
} from "@/lib/media";
import { persistUploadedMedia } from "@/lib/seoteam/media-data";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return withSeoAuth(async () => {
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return fail("Expected a multipart upload.", 400);
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("No file provided.", 400);

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const uploaded = await uploadImage({
        data: buffer,
        contentType: file.type,
        filename: file.name,
        folder: "blog",
      });
      // Record it in the shared library so cover/inline uploads are browsable
      // and reusable from the gallery. A library-write hiccup must never fail
      // the actual upload the editor is waiting on.
      try {
        await persistUploadedMedia(uploaded, { filename: file.name });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Media library persist failed:", err);
      }
      return ok(
        {
          url: uploaded.url,
          alt: "",
          width: uploaded.width,
          height: uploaded.height,
        },
        201,
      );
    } catch (err) {
      if (err instanceof MediaValidationError) return fail(err.message, 422);
      if (err instanceof MediaConfigError) {
        return fail(
          "Image hosting isn't configured. Paste an image URL instead.",
          503,
        );
      }
      throw err;
    }
  });
}
