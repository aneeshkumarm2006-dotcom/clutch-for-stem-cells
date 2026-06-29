/**
 * Global settings `/api/admin/settings` (PRD §8.10 / Stage 6.12). Admin+.
 * Writes the settings subset of `SiteSetting`; a ranking-weight change triggers
 * a full `sortScore` recompute so the directory order reflects it immediately.
 */
import { dbConnect } from "@/lib/db";
import { ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { recomputeAllSortScores } from "@/lib/ranking";
import { siteSettingUpdateSchema } from "@/lib/validation/site-setting";
import { SiteSetting, GLOBAL_SETTINGS_KEY } from "@/models";

export const dynamic = "force-dynamic";

const ALLOWED = [
  "rankingWeights",
  "seoDefaults",
  "contact",
  "social",
  "analytics",
  "featureFlags",
] as const;

export async function PATCH(req: Request): Promise<Response> {
  return withRole("admin", async (user) => {
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

    // Ranking weights feed every clinic's sortScore — re-rank now.
    if ("rankingWeights" in update) {
      await recomputeAllSortScores();
    }

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
