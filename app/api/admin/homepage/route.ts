/**
 * Homepage editor `/api/admin/homepage`. Editor+ — landing-page copy is content
 * work, so it sits at the same bar as `/api/admin/pages` and `/api/admin/page-seo`.
 *
 * Writes both halves of the landing page's storage in one request: the
 * `SiteSetting.homepage` overlay plus the four top-level fields that predate it
 * (`hero`, `popularSearches`, `featuredClinicIds`, `testimonials`). The meta
 * block is merged into the `/` row of `SiteSetting.pageSeo` — the same list
 * `/admin/seo` owns — so the homepage has exactly one title tag, whichever
 * screen you edit it from.
 *
 * Every key is optional: the form posts what it holds, and an absent key is left
 * untouched.
 */
import { dbConnect } from "@/lib/db";
import { ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { homepageUpdateSchema } from "@/lib/validation/homepage";
import { normalizePagePath } from "@/config/static-pages";
import { SiteSetting, GLOBAL_SETTINGS_KEY, toPlainObject } from "@/models";

export const dynamic = "force-dynamic";

const HOME_PATH = "/";

/** Content keys written verbatim; the meta block needs merging and is separate. */
const ALLOWED = [
  "homepage",
  "hero",
  "popularSearches",
  "featuredClinicIds",
  "testimonials",
] as const;

/** True once the override carries anything worth storing. */
function hasMeaning(seo: Record<string, unknown>): boolean {
  return Object.entries(seo).some(([key, value]) => {
    if (value === undefined || value === "") return false;
    if (key === "noindex") return value === true;
    if (key === "robots" && value && typeof value === "object") {
      return Object.values(value).some((v) => v !== undefined);
    }
    return true;
  });
}

export async function PATCH(req: Request): Promise<Response> {
  return withRole("editor", async (user) => {
    const parsed = await parseBody(req, homepageUpdateSchema);
    if ("error" in parsed) return parsed.error;

    const update: Record<string, unknown> = {};
    for (const key of ALLOWED) {
      if (key in parsed.data) {
        update[key] = (parsed.data as Record<string, unknown>)[key];
      }
    }

    await dbConnect();

    // The meta block replaces only the `/` row. Reading the list first keeps
    // overrides for every other fixed route intact — `/admin/seo` posts the
    // whole list, this screen must not.
    if ("seo" in parsed.data) {
      const settings = await SiteSetting.getGlobal();
      const others = (settings.pageSeo ?? [])
        .filter((row) => row?.path && normalizePagePath(row.path) !== HOME_PATH)
        .map((row) => toPlainObject(row));

      const seo = { ...(parsed.data.seo ?? {}) } as Record<string, unknown>;
      // A cleared override is a deletion, not an empty document.
      update.pageSeo = hasMeaning(seo)
        ? [...others, { ...seo, path: HOME_PATH }]
        : others;
    }

    await SiteSetting.updateOne(
      { key: GLOBAL_SETTINGS_KEY },
      { $set: update },
      { upsert: true },
    );

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "settings.homepage.update",
      entityType: "SiteSetting",
      entityId: GLOBAL_SETTINGS_KEY,
      after: { sections: Object.keys(update) },
    });

    return ok({ ok: true });
  });
}
