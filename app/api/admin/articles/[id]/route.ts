/**
 * Article update/delete `/api/admin/articles/[id]` (PRD §8.6 / Stage 6.8). Editor+.
 */
import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withRole } from "@/lib/admin/api";
import { recordAuditFromRequest } from "@/lib/audit";
import { articleUpdateSchema } from "@/lib/validation/article";
import { estimateReadingTime } from "@/lib/reading-time";
import { Article } from "@/models";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withRole("editor", async (user) => {
    const parsed = await parseBody(req, articleUpdateSchema);
    if ("error" in parsed) return parsed.error;
    const data = parsed.data;

    await dbConnect();
    const article = await Article.findById(params.id);
    if (!article) return fail("Article not found.", 404);

    if (data.slug && data.slug !== article.slug) {
      if (await Article.exists({ slug: data.slug, _id: { $ne: article._id } })) {
        return fail("That slug is already taken.", 409);
      }
    }

    article.set(data);
    if (data.body != null && data.readingTime == null) {
      article.readingTime = estimateReadingTime(data.body);
    }
    // Keep publishedAt consistent with status transitions.
    if (data.status === "published" && !article.publishedAt) {
      article.publishedAt = new Date();
    }
    if (data.status === "draft") {
      article.publishedAt = null;
    }

    await article.save();

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "article.update",
      entityType: "Article",
      entityId: article._id,
      after: { title: article.title, status: article.status },
      diffOnly: true,
    });

    return ok({ id: String(article._id), slug: article.slug });
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withRole("editor", async (user) => {
    await dbConnect();
    const article = await Article.findById(params.id);
    if (!article) return fail("Article not found.", 404);

    article.isDeleted = true;
    article.deletedAt = new Date();
    await article.save();

    await recordAuditFromRequest(req, {
      actorUserId: user.id,
      action: "article.delete",
      entityType: "Article",
      entityId: article._id,
      before: { title: article.title },
    });

    return ok({ ok: true });
  });
}
