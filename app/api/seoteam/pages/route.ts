/**
 * Composed-page collection — `/api/seoteam/pages`.
 *  GET  — list pages for the CMS.
 *  POST — create a page (draft by default; approval is gated).
 *
 * Same shape as the MatrixPage routes: sanitize → YMYL review gate → create →
 * revalidate. The gate sees the page's blocks projected into the flat
 * body/faqs shape it understands (`lib/blocks/server.ts`), so a claim typed into
 * any block is scanned exactly as one typed into a MatrixPage body would be.
 */
import { revalidatePath } from "next/cache";

import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withSeoAuth } from "@/lib/seoteam/api";
import { blocksFaqs, blocksScanText, sanitizeBlocks } from "@/lib/blocks/server";
import { reviewEditorialWrite } from "@/lib/content-review";
import { getAdminPages, isReservedSlug } from "@/lib/seoteam/page-data";
import { pageCreateSchema } from "@/lib/validation/page";
import { Page } from "@/models";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return withSeoAuth(async () => {
    const { searchParams } = new URL(req.url);
    const rows = await getAdminPages({
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });
    return ok({ pages: rows });
  });
}

export async function POST(req: Request): Promise<Response> {
  return withSeoAuth(async () => {
    const parsed = await parseBody(req, pageCreateSchema);
    if ("error" in parsed) return parsed.error;
    const data = parsed.data;

    if (isReservedSlug(data.slug)) {
      return fail(
        `"/${data.slug}" is reserved by an existing route. Pick another slug.`,
        422,
      );
    }

    await dbConnect();
    if (await Page.exists({ slug: data.slug })) {
      return fail("That slug is already taken.", 409);
    }

    const blocks = sanitizeBlocks(data.blocks);
    const gate = reviewEditorialWrite(null, {
      ...data,
      body: blocksScanText(blocks),
      faqs: blocksFaqs(blocks),
    });
    if (gate.error) return fail(gate.error, 422);

    const approved = data.reviewStatus === "approved";
    const page = await Page.create({
      ...data,
      blocks,
      contentFlags: gate.contentFlags,
      publishedAt: approved ? new Date() : null,
      lastReviewedAt: data.lastReviewedAt ?? (approved ? new Date() : null),
    });

    if (approved) revalidatePath(`/${page.slug}`);

    return ok({ id: String(page._id), slug: page.slug }, 201);
  });
}
