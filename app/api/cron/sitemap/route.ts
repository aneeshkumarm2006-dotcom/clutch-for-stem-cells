/**
 * Sitemap regeneration cron `/api/cron/sitemap` (Stage 9.1 / PRD §11, §12).
 *
 * `app/sitemap.ts` and `app/robots.ts` are ISR routes (`revalidate = 3600`), so
 * they refresh on their own. This cron forces an off-peak refresh so newly
 * published clinics/articles/taxonomy land in the sitemap promptly without
 * waiting for organic traffic to trigger revalidation. Gated by `CRON_SECRET`.
 */
import { revalidatePath } from "next/cache";

import { verifyCronRequest } from "@/lib/cron";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const unauthorized = verifyCronRequest(req);
  if (unauthorized) return unauthorized;

  try {
    revalidatePath("/sitemap.xml");
    revalidatePath("/robots.txt");

    return Response.json({ ok: true, revalidatedAt: new Date().toISOString() });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Cron sitemap regeneration failed:", err);
    return Response.json(
      { error: "Sitemap regeneration failed." },
      { status: 500 },
    );
  }
}
