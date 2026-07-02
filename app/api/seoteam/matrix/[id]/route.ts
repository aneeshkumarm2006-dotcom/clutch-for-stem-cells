/**
 * MatrixPage item — `/api/seoteam/matrix/[id]`.
 *  PATCH  — update a combination record (identity kind/slugA/slugB is immutable).
 *  DELETE — remove a combination record.
 *
 * The approval gate scans the MERGED (existing + patch) state; approving or
 * editing a live page revalidates its path so changes publish without redeploy.
 */
import { revalidatePath } from "next/cache";

import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withSeoAuth } from "@/lib/seoteam/api";
import { sanitizeBlogHtml } from "@/lib/seoteam/sanitize";
import { reviewEditorialWrite } from "@/lib/content-review";
import { matrixPagePath } from "@/lib/matrix";
import { matrixPageUpdateSchema } from "@/lib/validation/matrix-page";
import { MatrixPage, type IMatrixPage } from "@/models";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withSeoAuth(async () => {
    const parsed = await parseBody(req, matrixPageUpdateSchema);
    if ("error" in parsed) return parsed.error;
    const data = parsed.data as Record<string, unknown>;

    await dbConnect();
    const existing = await MatrixPage.findById(params.id).lean<IMatrixPage>();
    if (!existing) return fail("Not found.", 404);

    // Sanitize any incoming body before it's scanned or persisted.
    if (typeof data.body === "string") {
      data.body = sanitizeBlogHtml(data.body);
    }

    const gate = reviewEditorialWrite(
      existing as unknown as Record<string, unknown>,
      data,
    );
    if (gate.error) return fail(gate.error, 422);

    // Stamp publishedAt on the first transition to approved; refresh the
    // medical-review date whenever an approved save happens (freshness cadence).
    const nowApproved =
      data.reviewStatus === "approved" && existing.reviewStatus !== "approved";
    const isApproved =
      (data.reviewStatus ?? existing.reviewStatus) === "approved";

    const doc = await MatrixPage.findByIdAndUpdate(
      params.id,
      {
        ...data,
        contentFlags: gate.contentFlags,
        ...(nowApproved ? { publishedAt: new Date() } : {}),
        ...(isApproved && data.lastReviewedAt == null
          ? { lastReviewedAt: new Date() }
          : {}),
      },
      { new: true },
    );
    if (!doc) return fail("Not found.", 404);

    // Revalidate whenever the (now-)approved page's content could have changed.
    if (
      doc.reviewStatus === "approved" ||
      existing.reviewStatus === "approved"
    ) {
      revalidatePath(matrixPagePath(doc.kind, doc.slugA, doc.slugB));
    }

    return ok({ ok: true });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withSeoAuth(async () => {
    await dbConnect();
    const doc = await MatrixPage.findById(params.id);
    if (!doc) return fail("Not found.", 404);
    const wasApproved = doc.reviewStatus === "approved";
    const path = matrixPagePath(doc.kind, doc.slugA, doc.slugB);
    await doc.deleteOne();
    if (wasApproved) revalidatePath(path);
    return ok({ ok: true });
  });
}
