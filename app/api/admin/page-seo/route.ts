/**
 * Per-route page SEO `/api/admin/page-seo`. Editor+ — meta copy is content
 * work, so this sits at the same bar as taxonomy SEO rather than at Settings'
 * admin-only bar.
 *
 * Replaces the whole `SiteSetting.pageSeo` list (the form posts every row), but
 * only for paths that exist in `config/static-pages.ts`: an override on an
 * unregistered path would never be read back by any page, so accepting it would
 * silently do nothing. Rows with nothing set are dropped rather than stored as
 * empty documents.
 */
import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { pingIndexNow } from "@/lib/indexnow";
import { pageSeoUpdateSchema } from "@/lib/validation/site-setting";
import { STATIC_PAGES, normalizePagePath } from "@/config/static-pages";
import { SiteSetting, GLOBAL_SETTINGS_KEY, toPlainObject } from "@/models";

export const dynamic = "force-dynamic";

const KNOWN_PATHS = new Set(STATIC_PAGES.map((p) => p.path));

/**
 * Fields this screen doesn't show. They're written elsewhere — the homepage
 * editor and the site-page editors each set OG, canonical, Twitter and robots
 * for their own route — so a save here has to carry them across rather than
 * drop them. Everything this form *does* edit is taken from the request, blanks
 * included, so clearing still deletes.
 */
const PRESERVED = [
  "ogTitle",
  "ogDescription",
  "ogImage",
  "canonicalUrl",
  "twitterCard",
  "focusKeyword",
  "robots",
] as const;

/**
 * Canonical form of one `pageSeo` row, used only to answer "did this row
 * actually change?" so the IndexNow submission carries the handful of URLs an
 * editor touched rather than all ~30 managed pages on every save. Key order,
 * `path`, and the subdocument's mongoose internals are all irrelevant to that
 * question; an `undefined` field is the same as an absent one.
 */
function seoFingerprint(entry: Record<string, unknown> | undefined): string {
  if (!entry) return "";
  const keys = Object.keys(entry)
    .filter(
      (k) =>
        k !== "_id" && k !== "__v" && k !== "path" && entry[k] !== undefined,
    )
    .sort();
  return JSON.stringify(keys.map((k) => [k, entry[k]]));
}

export async function PATCH(req: Request): Promise<Response> {
  return withRole("editor", async (user) => {
    const parsed = await parseBody(req, pageSeoUpdateSchema);
    if ("error" in parsed) return parsed.error;

    await dbConnect();
    const settings = await SiteSetting.getGlobal();
    const stored = new Map(
      (settings.pageSeo ?? [])
        .filter((entry) => entry?.path)
        .map((entry) => [
          normalizePagePath(entry.path),
          toPlainObject(entry) as Record<string, unknown>,
        ]),
    );

    const seen = new Set<string>();
    const pageSeo: Record<string, unknown>[] = [];
    /** Paths whose stored meta this save adds, edits, or clears. */
    const changedPaths = new Set<string>();

    for (const row of parsed.data.pageSeo) {
      const path = normalizePagePath(row.path);
      if (!KNOWN_PATHS.has(path)) {
        return fail(`"${row.path}" is not a managed page.`, 422);
      }
      if (seen.has(path)) return fail(`Duplicate entry for ${path}.`, 422);
      seen.add(path);

      const seo: Record<string, unknown> = { ...row };
      delete seo.path;
      const existing = stored.get(path);
      if (existing) {
        for (const key of PRESERVED) {
          if (existing[key] !== undefined) seo[key] = existing[key];
        }
      }
      // `blankToUndefined` in the shared seo schema already turned cleared
      // fields into `undefined`; an entry with nothing left is a deletion.
      const hasValue = Object.values(seo).some(
        (v) => v !== undefined && v !== false,
      );
      if (hasValue) pageSeo.push({ ...seo, path });

      if (
        seoFingerprint(hasValue ? seo : undefined) !== seoFingerprint(existing)
      ) {
        changedPaths.add(path);
      }
    }

    // A row the request omitted entirely is a deletion of that override, which
    // changes the rendered `<head>` just as much as an edit does.
    for (const path of stored.keys()) {
      if (!seen.has(path)) changedPaths.add(path);
    }

    await SiteSetting.updateOne(
      { key: GLOBAL_SETTINGS_KEY },
      { $set: { pageSeo } },
      { upsert: true },
    );

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "settings.pageSeo.update",
      entityType: "SiteSetting",
      entityId: GLOBAL_SETTINGS_KEY,
      after: { paths: pageSeo.map((p) => p.path) },
    });

    // These routes render their title/description from this record, so a saved
    // override is a content change on a live URL.
    if (changedPaths.size) pingIndexNow([...changedPaths]);

    return ok({ ok: true, count: pageSeo.length });
  });
}
