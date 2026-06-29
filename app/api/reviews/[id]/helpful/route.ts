/**
 * "Helpful" vote `/api/reviews/[id]/helpful` (Stage 5.4 / PRD §6.4).
 *
 * Increments an approved review's `helpfulCount`. Rate-limited per IP to keep it
 * lightweight (no per-user dedupe in MVP — vote uniqueness is Phase 2).
 */
import { Types } from "mongoose";
import { NextResponse } from "next/server";

import { dbConnect } from "@/lib/db";
import { guardPublicForm } from "@/lib/public-form";
import { Review } from "@/models";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  if (!Types.ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const blocked = await guardPublicForm(req, {
    action: "helpful",
    requireCaptcha: false,
    limit: 30,
  });
  if (blocked) return blocked;

  await dbConnect();
  const updated = await Review.findOneAndUpdate(
    { _id: params.id, status: "approved", isDeleted: false },
    { $inc: { helpfulCount: 1 } },
    { new: true },
  )
    .select("helpfulCount")
    .lean();

  if (!updated) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, helpfulCount: updated.helpfulCount });
}
