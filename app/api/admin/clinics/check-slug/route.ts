/**
 * Slug availability check `/api/admin/clinics/check-slug?slug=&excludeId=`
 * (PRD §8.2 — slug uniqueness validation). Editor+.
 */
import { dbConnect } from "@/lib/db";
import { ok, withRole } from "@/lib/admin/api";
import { Clinic } from "@/models";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return withRole("editor", async () => {
    const { searchParams } = new URL(req.url);
    const slug = (searchParams.get("slug") ?? "").trim().toLowerCase();
    const excludeId = searchParams.get("excludeId") ?? undefined;
    if (!slug) return ok({ available: false });

    await dbConnect();
    const filter: Record<string, unknown> = { slug };
    if (excludeId) filter._id = { $ne: excludeId };
    const exists = await Clinic.exists(filter);
    return ok({ available: !exists });
  });
}
