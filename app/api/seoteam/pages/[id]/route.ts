/**
 * Single composed page — `/api/seoteam/pages/[id]`.
 *  PATCH  — update (re-runs the YMYL gate against the merged final state).
 *  DELETE — remove the page.
 *
 * A slug change automatically records a 301 from the old URL, so a page an
 * editor renames doesn't quietly 404 for everyone who already linked to it.
 */
import { revalidatePath, revalidateTag } from "next/cache";
import { isValidObjectId } from "mongoose";

import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withSeoAuth } from "@/lib/seoteam/api";
import { blocksFaqs, blocksScanText, sanitizeBlocks } from "@/lib/blocks/server";
import { reviewEditorialWrite } from "@/lib/content-review";
import { isReservedSlug } from "@/lib/seoteam/page-data";
import { REDIRECTS_CACHE_TAG } from "@/lib/redirects";
import { pageUpdateSchema } from "@/lib/validation/page";
import { Page, Redirect } from "@/models";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withSeoAuth(async () => {
    if (!isValidObjectId(params.id)) return fail("Page not found.", 404);

    const parsed = await parseBody(req, pageUpdateSchema);
    if ("error" in parsed) return parsed.error;
    const data = parsed.data;

    await dbConnect();
    const page = await Page.findById(params.id);
    if (!page) return fail("Page not found.", 404);

    const previousSlug = page.slug;

    if (data.slug && data.slug !== previousSlug) {
      if (isReservedSlug(data.slug)) {
        return fail(
          `"/${data.slug}" is reserved by an existing route. Pick another slug.`,
          422,
        );
      }
      if (await Page.exists({ slug: data.slug, _id: { $ne: page._id } })) {
        return fail("That slug is already taken.", 409);
      }
    }

    // Sanitize only if blocks were part of this patch; otherwise keep what's stored.
    const blocks = data.blocks
      ? sanitizeBlocks(data.blocks)
      : (page.blocks as never[]);

    const gate = reviewEditorialWrite(
      page.toObject() as unknown as Record<string, unknown>,
      {
        ...data,
        body: blocksScanText(blocks),
        faqs: blocksFaqs(blocks),
      },
    );
    if (gate.error) return fail(gate.error, 422);

    const wasApproved = page.reviewStatus === "approved";

    page.set({
      ...data,
      ...(data.blocks ? { blocks } : {}),
      contentFlags: gate.contentFlags,
    });

    const nowApproved = page.reviewStatus === "approved";
    if (nowApproved && !wasApproved) {
      page.publishedAt ??= new Date();
      page.lastReviewedAt ??= new Date();
    }

    await page.save();

    // A renamed page must not orphan its old URL — record the 301 automatically.
    if (data.slug && data.slug !== previousSlug) {
      await Redirect.updateOne(
        { from: `/${previousSlug}` },
        { $set: { to: `/${page.slug}`, statusCode: 301 } },
        { upsert: true },
      );
      revalidateTag(REDIRECTS_CACHE_TAG);
      revalidatePath(`/${previousSlug}`);
    }

    if (nowApproved || wasApproved) revalidatePath(`/${page.slug}`);

    return ok({ id: String(page._id), slug: page.slug });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withSeoAuth(async () => {
    if (!isValidObjectId(params.id)) return fail("Page not found.", 404);

    await dbConnect();
    const page = await Page.findByIdAndDelete(params.id);
    if (!page) return fail("Page not found.", 404);

    revalidatePath(`/${page.slug}`);
    return ok({ ok: true });
  });
}
