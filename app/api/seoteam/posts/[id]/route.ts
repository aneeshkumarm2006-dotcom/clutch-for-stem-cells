/**
 * Single blog post — `/api/seoteam/posts/[id]`.
 *  PATCH  — update fields / publish / unpublish (status → publishedAt kept in sync).
 *  DELETE — permanently remove the post.
 */
import { revalidatePath } from "next/cache";

import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withSeoAuth } from "@/lib/seoteam/api";
import { sanitizeBlogHtml } from "@/lib/seoteam/sanitize";
import { blogPostUpdateSchema } from "@/lib/validation/blog-post";
import { estimateReadingTime } from "@/lib/reading-time";
import { htmlToText } from "@/lib/seoteam/seo-checks";
import { BlogPost } from "@/models";

export const dynamic = "force-dynamic";

/** 24-char hex ObjectId guard — a malformed id is a clean 404, not a cast 500. */
const isObjectId = (id: string): boolean => /^[a-f\d]{24}$/i.test(id);

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withSeoAuth(async () => {
    if (!isObjectId(params.id)) return fail("Post not found.", 404);
    const parsed = await parseBody(req, blogPostUpdateSchema);
    if ("error" in parsed) return parsed.error;
    const data = parsed.data;

    await dbConnect();
    const post = await BlogPost.findById(params.id);
    if (!post) return fail("Post not found.", 404);
    const oldSlug = post.slug;

    if (data.slug && data.slug !== post.slug) {
      if (await BlogPost.exists({ slug: data.slug, _id: { $ne: post._id } })) {
        return fail("That slug is already taken.", 409);
      }
    }

    if (data.body != null) {
      const body = sanitizeBlogHtml(data.body);
      post.body = body;
      post.readingTime = estimateReadingTime(htmlToText(body));
    }

    // Apply the remaining fields. `body` (sanitized above) and `publishedAt`
    // (resolved below) are handled explicitly, so drop them from the bulk set —
    // in particular, keeping `publishedAt` out preserves the ORIGINAL stored date
    // for the comparison below.
    const rest = { ...data };
    delete rest.body;
    delete rest.publishedAt;
    post.set(rest);

    // Keep publishedAt consistent with visibility. Publishing with no explicit
    // date must NOT blindly reuse the existing date — if that date is in the
    // future (a scheduled post switched to Visible), reusing it would leave the
    // post hidden. So: explicit date wins; otherwise keep the existing date only
    // if it is already ≤ now (an already-live post keeps its original date),
    // else publish now.
    if (data.status === "published") {
      const now = new Date();
      const explicit = data.publishedAt ? new Date(data.publishedAt) : undefined;
      post.publishedAt =
        explicit ??
        (post.publishedAt && post.publishedAt <= now ? post.publishedAt : now);
    } else if (data.status === "draft") {
      post.publishedAt = null;
    }

    await post.save();

    // Refresh public pages so edits/unpublish take effect immediately.
    revalidatePath("/blog");
    revalidatePath(`/blog/${oldSlug}`);
    if (post.slug !== oldSlug) revalidatePath(`/blog/${post.slug}`);

    return ok({ id: String(post._id), slug: post.slug });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withSeoAuth(async () => {
    if (!isObjectId(params.id)) return fail("Post not found.", 404);
    await dbConnect();
    const deleted = await BlogPost.findByIdAndDelete(params.id);
    if (!deleted) return fail("Post not found.", 404);
    revalidatePath("/blog");
    revalidatePath(`/blog/${deleted.slug}`);
    return ok({ ok: true });
  });
}
