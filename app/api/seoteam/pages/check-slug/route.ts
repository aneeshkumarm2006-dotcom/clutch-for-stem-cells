/**
 * `GET /api/seoteam/pages/check-slug?slug=…&id=…` — live slug availability.
 *
 * Also reports reserved slugs (those owned by a real route), so an editor learns
 * the URL is unusable while typing rather than on save.
 */
import { ok, withSeoAuth } from "@/lib/seoteam/api";
import { isPageSlugAvailable, isReservedSlug } from "@/lib/seoteam/page-data";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return withSeoAuth(async () => {
    const { searchParams } = new URL(req.url);
    const slug = (searchParams.get("slug") ?? "").trim().toLowerCase();
    const id = searchParams.get("id") ?? undefined;

    if (!slug) return ok({ available: false, reserved: false });

    const reserved = isReservedSlug(slug);
    const available = reserved ? false : await isPageSlugAvailable(slug, id);

    return ok({ available, reserved });
  });
}
