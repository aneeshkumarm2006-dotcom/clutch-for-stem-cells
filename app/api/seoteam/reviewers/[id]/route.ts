/**
 * MedicalReviewer item — `/api/seoteam/reviewers/[id]`.
 *  PATCH  — update a reviewer.
 *  DELETE — remove a reviewer (refused while still assigned to content).
 */
import { revalidatePath } from "next/cache";

import { dbConnect } from "@/lib/db";
import { fail, ok, parseBody, withSeoAuth } from "@/lib/seoteam/api";
import { medicalReviewerUpdateSchema } from "@/lib/validation/medical-reviewer";
import {
  Condition,
  MatrixPage,
  MedicalReviewer,
  Treatment,
  Location,
} from "@/models";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withSeoAuth(async () => {
    const parsed = await parseBody(req, medicalReviewerUpdateSchema);
    if ("error" in parsed) return parsed.error;
    const data = parsed.data;

    await dbConnect();
    if (data.slug) {
      const clash = await MedicalReviewer.exists({
        slug: data.slug,
        _id: { $ne: params.id },
      });
      if (clash) return fail("That slug is already taken.", 409);
    }
    const doc = await MedicalReviewer.findByIdAndUpdate(params.id, data, {
      new: true,
    });
    if (!doc) return fail("Not found.", 404);
    revalidatePath(`/reviewers/${doc.slug}`);
    return ok({ ok: true });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  return withSeoAuth(async () => {
    await dbConnect();
    const doc = await MedicalReviewer.findById(params.id);
    if (!doc) return fail("Not found.", 404);

    // Guard: refuse to delete a reviewer still credited on live/queued content.
    const [matrix, treatments, conditions, locations] = await Promise.all([
      MatrixPage.countDocuments({ reviewedBy: doc._id }),
      Treatment.countDocuments({ reviewedBy: doc._id }),
      Condition.countDocuments({ reviewedBy: doc._id }),
      Location.countDocuments({ reviewedBy: doc._id }),
    ]);
    const inUse = matrix + treatments + conditions + locations;
    if (inUse > 0) {
      return fail(
        `Can't delete. ${doc.name} is credited on ${inUse} page${
          inUse === 1 ? "" : "s"
        }. Reassign or deactivate instead.`,
        409,
      );
    }

    await doc.deleteOne();
    return ok({ ok: true });
  });
}
