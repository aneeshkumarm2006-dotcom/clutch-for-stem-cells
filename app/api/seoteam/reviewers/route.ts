/**
 * MedicalReviewer collection — `/api/seoteam/reviewers`.
 *  POST — create a reviewer. Reviewers must be REAL credentialed people; they
 *  gate content approval, so a fabricated reviewer is a trust/legal liability.
 */
import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withSeoAuth } from "@/lib/seoteam/api";
import { medicalReviewerCreateSchema } from "@/lib/validation/medical-reviewer";
import { MedicalReviewer } from "@/models";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return withSeoAuth(async () => {
    const parsed = await parseBody(req, medicalReviewerCreateSchema);
    if ("error" in parsed) return parsed.error;
    const data = parsed.data;

    await dbConnect();
    if (await MedicalReviewer.exists({ slug: data.slug })) {
      return fail("That slug is already taken.", 409);
    }
    const doc = await MedicalReviewer.create(data);
    return ok({ id: String(doc._id) }, 201);
  });
}
