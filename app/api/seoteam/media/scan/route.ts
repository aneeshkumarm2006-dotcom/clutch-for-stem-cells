/**
 * Blog media backfill — `/api/seoteam/media/scan`.
 *
 * Scans every post for cover + inline images not yet in the library and creates
 * a `Media` record for each, so usage tracking works for images uploaded before
 * the gallery shipped. Idempotent (deduped by url).
 */
import { ok, withSeoAuth } from "@/lib/seoteam/api";
import { backfillBlogMedia } from "@/lib/seoteam/media-data";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  return withSeoAuth(async () => {
    return ok(await backfillBlogMedia(), 201);
  });
}
