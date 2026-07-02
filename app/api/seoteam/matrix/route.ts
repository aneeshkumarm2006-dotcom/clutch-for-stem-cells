/**
 * MatrixPage collection — `/api/seoteam/matrix`.
 *  GET  — list combination records for the dashboard (filter by status/kind, search).
 *  POST — create a combination record (draft by default; approval is gated).
 *
 * Approval runs through the same YMYL gate as taxonomy enrichment
 * (`lib/content-review.ts`): a record can't reach `approved` without a reviewer
 * and acknowledged flags. Approving triggers `revalidatePath` so the combo page
 * goes live without a redeploy.
 */
import { revalidatePath } from "next/cache";

import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withSeoAuth } from "@/lib/seoteam/api";
import { sanitizeBlogHtml } from "@/lib/seoteam/sanitize";
import { getAdminMatrixPages } from "@/lib/seoteam/matrix-data";
import { reviewEditorialWrite } from "@/lib/content-review";
import { matrixPagePath } from "@/lib/matrix";
import { matrixPageCreateSchema } from "@/lib/validation/matrix-page";
import { MatrixPage } from "@/models";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return withSeoAuth(async () => {
    const { searchParams } = new URL(req.url);
    const rows = await getAdminMatrixPages({
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      kind: searchParams.get("kind") ?? undefined,
    });
    return ok({ pages: rows });
  });
}

export async function POST(req: Request): Promise<Response> {
  return withSeoAuth(async () => {
    const parsed = await parseBody(req, matrixPageCreateSchema);
    if ("error" in parsed) return parsed.error;
    const data = parsed.data;

    await dbConnect();
    if (
      await MatrixPage.exists({
        kind: data.kind,
        slugA: data.slugA,
        slugB: data.slugB,
      })
    ) {
      return fail("A page for that combination already exists.", 409);
    }

    const body = sanitizeBlogHtml(data.body);
    const gate = reviewEditorialWrite(null, { ...data, body });
    if (gate.error) return fail(gate.error, 422);

    const approved = data.reviewStatus === "approved";
    const page = await MatrixPage.create({
      ...data,
      body,
      contentFlags: gate.contentFlags,
      publishedAt: approved ? new Date() : null,
      // Stamp the medical-review date on approval (drives the freshness cadence).
      lastReviewedAt: data.lastReviewedAt ?? (approved ? new Date() : null),
    });

    if (page.reviewStatus === "approved") {
      revalidatePath(matrixPagePath(page.kind, page.slugA, page.slugB));
    }

    return ok({ id: String(page._id) }, 201);
  });
}
