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
 * A page's copy and its meta have separate homes, and this writes both: the
 * body fields go to the `PageContent` overlay, while `seo` is merged into this
 * path's row in `SiteSetting.pageSeo` — the store `/admin/seo` owns — so a
 * fixed route has exactly one title tag whichever screen edits it. Variants
 * (`/contact/listing`) render under their parent's URL and so have no metadata
 * of their own; sending `seo` for one is an error rather than a silent no-op.
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
import { withPageSeoRow } from "@/lib/admin/page-seo";
import { pageContentUpdateSchema } from "@/lib/validation/page-content";
import { editablePage } from "@/config/editable-pages";
import { normalizePagePath, staticPageMeta } from "@/config/static-pages";
import { PageContent, SiteSetting, GLOBAL_SETTINGS_KEY } from "@/models";

export const dynamic = "force-dynamic";

/** `["reviews","new"]` → `/reviews/new`, normalized the way the registry keys. */
function pathFrom(segments: string[]): string {
  return normalizePagePath("/" + segments.join("/"));
}

/**
 * Whether this route's metadata is editable here. It needs an entry in
 * `config/static-pages.ts` (that entry is what `pageMetadata` reads the
 * override back through) and it must not be a variant of another route.
 */
function ownsMetadata(path: string, variantOf?: string): boolean {
  return !variantOf && Boolean(staticPageMeta(path));
}

/** Replace this path's row in `SiteSetting.pageSeo`, leaving every other alone. */
async function savePageSeo(
  path: string,
  seo: Record<string, unknown>,
): Promise<void> {
  const settings = await SiteSetting.getGlobal();
  await SiteSetting.updateOne(
    { key: GLOBAL_SETTINGS_KEY },
    { $set: { pageSeo: withPageSeoRow(settings.pageSeo, path, seo) } },
    { upsert: true },
  );
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

    if ("seo" in data && !ownsMetadata(path, entry.variantOf)) {
      return fail(`"${path}" has no metadata of its own.`, 422);
    }

    await dbConnect();
    await PageContent.updateOne(
      { path },
      { $set: { ...update, path } },
      { upsert: true },
    );
    if ("seo" in data) {
      await savePageSeo(path, (data.seo ?? {}) as Record<string, unknown>);
    }

    revalidateFor(path, entry.variantOf);

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "content.page.update",
      entityType: "PageContent",
      entityId: path,
      after: {
        fields: [...Object.keys(update), ...("seo" in data ? ["seo"] : [])],
      },
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
    // "Restore the shipped copy" covers the meta too, so the reset button puts
    // the whole page back rather than leaving an orphan title tag behind.
    if (ownsMetadata(path, entry.variantOf)) await savePageSeo(path, {});

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
