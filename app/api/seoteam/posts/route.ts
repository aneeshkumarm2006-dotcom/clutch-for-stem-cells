/**
 * Blog posts collection — `/api/seoteam/posts`.
 *  GET  — list posts for the dashboard (filter by status, search by title).
 *  POST — create a draft or publish instantly (writes to DB; live on /blog).
 */
import { revalidatePath } from "next/cache";

import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withSeoAuth } from "@/lib/seoteam/api";
import { sanitizeBlogHtml } from "@/lib/seoteam/sanitize";
import { getAdminBlogPosts } from "@/lib/seoteam/blog-data";
import { blogPostCreateSchema } from "@/lib/validation/blog-post";
import { estimateReadingTime } from "@/lib/reading-time";
import { htmlToText } from "@/lib/seoteam/seo-checks";
import { BlogPost } from "@/models";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return withSeoAuth(async () => {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");
    const rows = await getAdminBlogPosts({
      q: searchParams.get("q") ?? undefined,
      status:
        statusParam === "draft" || statusParam === "published"
          ? statusParam
          : undefined,
    });
    return ok({ posts: rows });
  });
}

export async function POST(req: Request): Promise<Response> {
  return withSeoAuth(async () => {
    const parsed = await parseBody(req, blogPostCreateSchema);
    if ("error" in parsed) return parsed.error;
    const data = parsed.data;

    await dbConnect();
    if (await BlogPost.exists({ slug: data.slug })) {
      return fail("That slug is already taken.", 409);
    }

    const body = sanitizeBlogHtml(data.body);
    const post = await BlogPost.create({
      ...data,
      body,
      readingTime: estimateReadingTime(htmlToText(body)),
      publishedAt: data.status === "published" ? new Date() : null,
    });

    if (post.status === "published") {
      revalidatePath("/blog");
      revalidatePath(`/blog/${post.slug}`);
    }

    return ok({ id: String(post._id), slug: post.slug }, 201);
  });
}
