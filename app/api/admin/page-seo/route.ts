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
import { pageSeoUpdateSchema } from "@/lib/validation/site-setting";
import { STATIC_PAGES, normalizePagePath } from "@/config/static-pages";
import { SiteSetting, GLOBAL_SETTINGS_KEY, toPlainObject } from "@/models";

export const dynamic = "force-dynamic";

const KNOWN_PATHS = new Set(STATIC_PAGES.map((p) => p.path));

/**
 * Fields this screen doesn't show. They're written elsewhere — the homepage
 * editor sets OG, canonical, Twitter and robots for `/` — so a save here has to
 * carry them across rather than drop them. Everything this form *does* edit is
 * taken from the request, blanks included, so clearing still deletes.
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

    return ok({ ok: true, count: pageSeo.length });
  });
}
