/**
 * Page-content overlay `/api/admin/page-content/{path}`. Editor+ — page copy is
 * content work, so it sits at the same bar as `/api/admin/homepage`.
 *
 *  PATCH  — upsert the overlay for one route.
 *  DELETE — drop the overlay, restoring the shipped copy.
 *
 * The route being edited is the URL path, so `/about` is
 * `PATCH /api/admin/page-content/about`. Only paths the registry declares are
 * writable: an unknown one is a 404 rather than a row nothing will ever read.
 *
 * Both handlers revalidate the shared `page-content` tag plus the affected
 * route, so an edit is live on the next request rather than after the 5-minute
 * cache window.
 */
import { revalidatePath, revalidateTag } from "next/cache";

import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { sanitizeBlocks } from "@/lib/blocks/server";
import { sanitizeBlogHtml } from "@/lib/seoteam/sanitize";
import { PAGE_CONTENT_TAG } from "@/lib/page-content";
import { pageContentUpdateSchema } from "@/lib/validation/page-content";
import { editablePage } from "@/config/editable-pages";
import { normalizePagePath } from "@/config/static-pages";
import { PageContent } from "@/models";

export const dynamic = "force-dynamic";

/** `["reviews","new"]` → `/reviews/new`, normalized the way the registry keys. */
function pathFrom(segments: string[]): string {
  return normalizePagePath("/" + segments.join("/"));
}

/** Refresh the caches an edit to `path` can affect. */
function revalidateFor(path: string, variantOf?: string): void {
  revalidateTag(PAGE_CONTENT_TAG);
  // A variant's copy renders on its parent route, not at its own URL.
  revalidatePath(variantOf ?? path);
}

export async function PATCH(
  req: Request,
  { params }: { params: { path: string[] } },
): Promise<Response> {
  return withRole("editor", async (user) => {
    const path = pathFrom(params.path);
    const entry = editablePage(path);
    if (!entry) return fail(`"${path}" is not an editable page.`, 404);

    const parsed = await parseBody(req, pageContentUpdateSchema);
    if ("error" in parsed) return parsed.error;
    const data = parsed.data;

    const update: Record<string, unknown> = {};
    if ("title" in data) update.title = data.title?.trim() ?? "";
    // The lead carries inline HTML so it can hold a link; same allow-list as
    // every other authored body on the site.
    if ("lead" in data) {
      update.lead = data.lead?.trim() ? sanitizeBlogHtml(data.lead) : "";
    }
    if ("updated" in data) update.updated = data.updated?.trim() ?? "";
    if ("legalReview" in data) update.legalReview = data.legalReview ?? null;
    if ("blocks" in data) update.blocks = sanitizeBlocks(data.blocks ?? []);
    if ("blocksAfter" in data) {
      update.blocksAfter = sanitizeBlocks(data.blocksAfter ?? []);
    }
    if ("extras" in data) {
      // Only registry-declared keys are stored, so a renamed extra cannot leave
      // an orphan string behind that nothing renders.
      const allowed = new Set(entry.extras.map((e) => e.key));
      update.extras = Object.fromEntries(
        Object.entries(data.extras ?? {})
          .filter(([key]) => allowed.has(key))
          .map(([key, value]) => [key, value.trim()]),
      );
    }

    await dbConnect();
    await PageContent.updateOne(
      { path },
      { $set: { ...update, path } },
      { upsert: true },
    );

    revalidateFor(path, entry.variantOf);

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "content.page.update",
      entityType: "PageContent",
      entityId: path,
      after: { fields: Object.keys(update) },
    });

    return ok({ ok: true });
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: { path: string[] } },
): Promise<Response> {
  return withRole("editor", async (user) => {
    const path = pathFrom(params.path);
    const entry = editablePage(path);
    if (!entry) return fail(`"${path}" is not an editable page.`, 404);

    await dbConnect();
    await PageContent.deleteOne({ path });

    revalidateFor(path, entry.variantOf);

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "content.page.reset",
      entityType: "PageContent",
      entityId: path,
    });

    return ok({ ok: true });
  });
}
