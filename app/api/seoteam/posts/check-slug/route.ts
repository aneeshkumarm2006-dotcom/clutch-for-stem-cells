/**
 * Slug availability — `/api/seoteam/posts/check-slug?slug=…&id=…`.
 * Returns `{ available }` so the editor can warn before save. `id` (optional)
 * excludes the post being edited from the uniqueness check.
 */
import { dbConnect } from "@/lib/db";
import { ok, withSeoAuth } from "@/lib/seoteam/api";
import { slugify } from "@/lib/slug";
import { BlogPost } from "@/models";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return withSeoAuth(async () => {
    const { searchParams } = new URL(req.url);
    const slug = slugify(searchParams.get("slug") ?? "");
    const id = searchParams.get("id");
    if (!slug) return ok({ available: false, slug });

    await dbConnect();
    const filter: Record<string, unknown> = { slug };
    if (id && /^[a-f\d]{24}$/i.test(id)) filter._id = { $ne: id };
    const exists = await BlogPost.exists(filter);
    return ok({ available: !exists, slug });
  });
}
