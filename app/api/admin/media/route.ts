/**
 * Media library API (PRD §8.11 / Stage 6.13).
 *  GET  — list/search the library (consumed by the library page + ImagePicker).
 *  POST — multipart upload (provider) OR JSON `{url,…}` manual entry.
 * Editor+; uploads validated for MIME/size and recorded in the audit log.
 */
import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import {
  MediaConfigError,
  MediaValidationError,
  uploadImage,
} from "@/lib/media";
import { mediaCreateSchema } from "@/lib/validation/media";
import { getAdminMedia } from "@/lib/admin/media";
import { Media } from "@/models";
import type { IMedia } from "@/models";

export const dynamic = "force-dynamic";

function serialize(d: IMedia) {
  return {
    id: String(d._id),
    url: d.url,
    publicId: d.publicId,
    alt: d.alt,
    filename: d.filename,
    folder: d.folder,
    format: d.format,
    width: d.width,
    height: d.height,
    bytes: d.bytes,
  };
}

export async function GET(req: Request): Promise<Response> {
  return withRole("editor", async () => {
    const { searchParams } = new URL(req.url);
    const data = await getAdminMedia({
      q: searchParams.get("q") ?? undefined,
      folder: searchParams.get("folder") ?? undefined,
      page: Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
      pageSize:
        Number.parseInt(searchParams.get("pageSize") ?? "24", 10) || 24,
    });
    return ok(data);
  });
}

export async function POST(req: Request): Promise<Response> {
  return withRole("editor", async (user) => {
    const contentType = req.headers.get("content-type") ?? "";

    // ── Provider upload (multipart) ──────────────────────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return fail("No file provided.", 400);
      const folder = (form.get("folder") as string) || "library";

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const uploaded = await uploadImage({
          data: buffer,
          contentType: file.type,
          filename: file.name,
          folder,
        });
        await dbConnect();
        const doc = await Media.create({
          ...uploaded,
          filename: file.name,
          folder,
          uploadedBy: user.id,
        });
        await recordAuditFromRequest(req, {
          actorUserId: user.id,
          action: "media.upload",
          entityType: "Media",
          entityId: doc._id,
          after: { url: doc.url, filename: doc.filename, folder: doc.folder },
        });
        return ok(serialize(doc), 201);
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
    }

    // ── Manual URL entry (JSON) ──────────────────────────────────────────────
    const parsed = await parseBody(req, mediaCreateSchema);
    if ("error" in parsed) return parsed.error;
    await dbConnect();
    const doc = await Media.create({ ...parsed.data, uploadedBy: user.id });
    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "media.create",
      entityType: "Media",
      entityId: doc._id,
      after: { url: doc.url },
    });
    return ok(serialize(doc), 201);
  });
}
