/**
 * Shortlist sync `/api/account/shortlist` (Stage 5.11 / 5.13 — PRD §6.10, §7).
 *
 * Authenticated. Persists the member's saved clinics to `User.shortlist`. The
 * client keeps slugs (guest localStorage → synced on login); this endpoint
 * resolves slugs ↔ ObjectIds. Supports `set` (merge on login), `add`, `remove`.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { authErrorResponse, requireApiUser } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { Clinic, User } from "@/models";

export const dynamic = "force-dynamic";

// Slugs are short, lowercase, hyphenated; cap the merge list to a sane size.
const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9-]+$/i, "Invalid slug.");

const shortlistSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set"), slugs: z.array(slugSchema).max(200) }),
  z.object({ action: z.literal("add"), slug: slugSchema }),
  z.object({ action: z.literal("remove"), slug: slugSchema }),
]);

/** Current shortlist as clinic slugs. */
async function currentSlugs(userId: string): Promise<string[]> {
  const user = await User.findById(userId).select("shortlist").lean();
  if (!user?.shortlist?.length) return [];
  const clinics = await Clinic.find({ _id: { $in: user.shortlist } })
    .select("slug")
    .lean();
  return clinics.map((c) => c.slug);
}

export async function GET(): Promise<Response> {
  try {
    const sessionUser = await requireApiUser();
    await dbConnect();
    return NextResponse.json({ slugs: await currentSlugs(sessionUser.id) });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const sessionUser = await requireApiUser();

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const parsed = shortlistSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }
    const data = parsed.data;

    await dbConnect();

    if (data.action === "set") {
      const clinics = await Clinic.find({ slug: { $in: data.slugs } })
        .select("_id")
        .lean();
      await User.updateOne(
        { _id: sessionUser.id },
        { $set: { shortlist: clinics.map((c) => c._id) } },
      );
    } else if (data.action === "add") {
      const clinic = await Clinic.findOne({ slug: data.slug }).select("_id").lean();
      if (clinic) {
        await User.updateOne(
          { _id: sessionUser.id },
          { $addToSet: { shortlist: clinic._id } },
        );
      }
    } else {
      const clinic = await Clinic.findOne({ slug: data.slug }).select("_id").lean();
      if (clinic) {
        await User.updateOne(
          { _id: sessionUser.id },
          { $pull: { shortlist: clinic._id } },
        );
      }
    }

    return NextResponse.json({ slugs: await currentSlugs(sessionUser.id) });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}
