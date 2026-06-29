/**
 * Delete account `/api/account/delete` (Stage 5.11 / PRD §6.10, §14 GDPR).
 *
 * Soft-deletes the member's user record and anonymizes the email so it can't be
 * reused to identify them, then the client signs out. Reviews/leads keep their
 * content (moderation history) but are no longer linked to a live account.
 */
import { NextResponse } from "next/server";

import { authErrorResponse, requireApiUser } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { User } from "@/models";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  try {
    const sessionUser = await requireApiUser();
    await dbConnect();

    const user = await User.findById(sessionUser.id);
    if (user && !user.isDeleted) {
      user.isDeleted = true;
      user.deletedAt = new Date();
      user.status = "suspended";
      user.shortlist = [];
      user.savedSearches = [];
      // Free the email + scrub credentials so the record can't sign in again.
      user.email = `deleted+${user._id}@deleted.invalid`;
      user.passwordHash = undefined;
      user.name = undefined;
      await user.save();
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}
