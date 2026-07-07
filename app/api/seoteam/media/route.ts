/**
 * Blog media library — `/api/seoteam/media`.
 *
 * `GET` lists/searches/paginates the gallery (with per-image usage annotation).
 * `POST` accepts either a multipart multi-file upload (each file → Cloudinary +
 * a `Media` record) or a JSON `{ urls: [...] }` bulk-import of pasted URLs.
 * Gated by the shared-password session; seoteam routes don't audit (single
 * shared principal), consistent with `/api/seoteam/posts`.
 */
import { fail, ok, parseBody, withSeoAuth } from "@/lib/seoteam/api";
import { parsePage } from "@/lib/admin/serialize";
import {
  MediaConfigError,
  MediaValidationError,
  uploadImage,
} from "@/lib/media";
import {
  getSeoMedia,
  importMediaUrls,
  persistUploadedMedia,
  type MediaSort,
  type SeoMediaQuery,
} from "@/lib/seoteam/media-data";
import { mediaUrlImportSchema } from "@/lib/validation/media";

export const dynamic = "force-dynamic";

const SORTS: MediaSort[] = ["newest", "name", "size", "usage"];

export async function GET(req: Request): Promise<Response> {
  return withSeoAuth(async () => {
    const sp = new URL(req.url).searchParams;
    const sortParam = sp.get("sort");
    const query: SeoMediaQuery = {
      q: sp.get("q") ?? undefined,
      folder: sp.get("folder") ?? undefined,
      sort: SORTS.includes(sortParam as MediaSort)
        ? (sortParam as MediaSort)
        : undefined,
      filter: sp.get("filter") === "unused" ? "unused" : undefined,
      page: parsePage(sp.get("page") ?? undefined),
    };
    return ok(await getSeoMedia(query));
  });
}

export async function POST(req: Request): Promise<Response> {
  return withSeoAuth(async () => {
    const contentType = req.headers.get("content-type") ?? "";

    // ── Multi-file upload ────────────────────────────────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const files = form
        .getAll("file")
        .filter((f): f is File => f instanceof File);
      if (files.length === 0) return fail("No files provided.", 400);

      let uploaded = 0;
      try {
        for (const file of files) {
          const buffer = Buffer.from(await file.arrayBuffer());
          const result = await uploadImage({
            data: buffer,
            contentType: file.type,
            filename: file.name,
            folder: "blog",
          });
          await persistUploadedMedia(result, { filename: file.name });
          uploaded++;
        }
      } catch (err) {
        if (err instanceof MediaValidationError) return fail(err.message, 422);
        if (err instanceof MediaConfigError) {
          return fail(
            "Image hosting isn't configured. Paste image URLs instead.",
            503,
          );
        }
        throw err;
      }
      return ok({ uploaded }, 201);
    }

    // ── Bulk URL import ──────────────────────────────────────────────────────
    const parsed = await parseBody(req, mediaUrlImportSchema);
    if ("error" in parsed) return parsed.error;
    const result = await importMediaUrls(parsed.data.urls);
    return ok(result, 201);
  });
}
