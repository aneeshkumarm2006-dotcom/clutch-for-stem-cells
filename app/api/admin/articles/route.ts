/**
 * Article create `/api/admin/articles` (PRD §8.6 / Stage 6.8). Editor+.
 */
import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { articleCreateSchema } from "@/lib/validation/article";
import { estimateReadingTime } from "@/lib/reading-time";
import { Article } from "@/models";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return withRole("editor", async (user) => {
    const parsed = await parseBody(req, articleCreateSchema);
    if ("error" in parsed) return parsed.error;
    const data = parsed.data;

    await dbConnect();
    if (await Article.exists({ slug: data.slug })) {
      return fail("That slug is already taken.", 409);
    }

    const publishedAt =
      data.status === "published"
        ? (data.publishedAt ?? new Date())
        : data.status === "draft"
          ? null
          : (data.publishedAt ?? null);

    const article = await Article.create({
      ...data,
      readingTime: data.readingTime ?? estimateReadingTime(data.body),
      publishedAt,
    });

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "article.create",
      entityType: "Article",
      entityId: article._id,
      after: { title: article.title, slug: article.slug, status: article.status },
    });

    return ok({ id: String(article._id), slug: article.slug }, 201);
  });
}
