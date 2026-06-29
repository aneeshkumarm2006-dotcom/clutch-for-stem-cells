/**
 * Shortlist sync `/api/account/shortlist` (Stage 5.11 / 5.13 — PRD §6.10, §7).
 *
 * Authenticated. Persists the member's saved clinics to `User.shortlist`. The
 * client keeps slugs (guest localStorage → synced on login); this endpoint
 * resolves slugs ↔ ObjectIds. Supports `set` (merge on login), `add`, `remove`.
 */
import { NextResponse } from "next/server";

import { authErrorResponse, requireApiUser } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { Clinic, User } from "@/models";

export const dynamic = "force-dynamic";

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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const { action, slug, slugs } = (body ?? {}) as {
      action?: string;
      slug?: string;
      slugs?: string[];
    };

    await dbConnect();

    const resolveIds = async (list: string[]) => {
      const clinics = await Clinic.find({ slug: { $in: list } })
        .select("_id")
        .lean();
      return clinics.map((c) => c._id);
    };

    if (action === "set") {
      const ids = await resolveIds(Array.isArray(slugs) ? slugs : []);
      await User.updateOne(
        { _id: sessionUser.id },
        { $set: { shortlist: ids } },
      );
    } else if (action === "add" && slug) {
      const clinic = await Clinic.findOne({ slug }).select("_id").lean();
      if (clinic) {
        await User.updateOne(
          { _id: sessionUser.id },
          { $addToSet: { shortlist: clinic._id } },
        );
      }
    } else if (action === "remove" && slug) {
      const clinic = await Clinic.findOne({ slug }).select("_id").lean();
      if (clinic) {
        await User.updateOne(
          { _id: sessionUser.id },
          { $pull: { shortlist: clinic._id } },
        );
      }
    } else {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    return NextResponse.json({ slugs: await currentSlugs(sessionUser.id) });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}
