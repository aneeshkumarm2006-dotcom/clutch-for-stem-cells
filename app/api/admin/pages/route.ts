/**
 * Homepage & content config `/api/admin/pages` (PRD §8.7 / Stage 6.9). Editor+.
 * Writes the homepage/content subset of the `SiteSetting` singleton.
 */
import { dbConnect } from "@/lib/db";
import { ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { siteSettingUpdateSchema } from "@/lib/validation/site-setting";
import { SiteSetting, GLOBAL_SETTINGS_KEY } from "@/models";

export const dynamic = "force-dynamic";

const ALLOWED = [
  "hero",
  "popularSearches",
  "featuredClinicIds",
  "testimonials",
  "partnerLogos",
  "disclaimers",
] as const;

export async function PATCH(req: Request): Promise<Response> {
  return withRole("editor", async (user) => {
    const parsed = await parseBody(req, siteSettingUpdateSchema);
    if ("error" in parsed) return parsed.error;

    const update: Record<string, unknown> = {};
    for (const key of ALLOWED) {
      if (key in parsed.data) {
        update[key] = (parsed.data as Record<string, unknown>)[key];
      }
    }

    await dbConnect();
    await SiteSetting.updateOne(
      { key: GLOBAL_SETTINGS_KEY },
      { $set: update },
      { upsert: true },
    );

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "settings.update",
      entityType: "SiteSetting",
      entityId: GLOBAL_SETTINGS_KEY,
      after: update,
    });

    return ok({ ok: true });
  });
}
