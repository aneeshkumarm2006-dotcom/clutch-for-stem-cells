/**
 * Redirects read-layer (admin). Serializes the `Redirect` collection for the
 * admin table.
 */
import "server-only";

import { dbConnect } from "@/lib/db";
import { id, iso } from "@/lib/admin/serialize";
import { Redirect } from "@/models";
import type { RedirectStatusCode } from "@/lib/enums";

export interface RedirectRow {
  id: string;
  from: string;
  to: string;
  statusCode: RedirectStatusCode;
  hits: number;
  createdAt: string;
}

export async function getRedirects(q?: string): Promise<RedirectRow[]> {
  await dbConnect();

  const filter: Record<string, unknown> = {};
  if (q?.trim()) {
    // Escape the query so a user typing "/a+b" can't inject a regex.
    const safe = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { from: { $regex: safe, $options: "i" } },
      { to: { $regex: safe, $options: "i" } },
    ];
  }

  const rows = await Redirect.find(filter)
    .sort({ createdAt: -1 })
    .limit(500)
    .lean<
      {
        _id: unknown;
        from: string;
        to: string;
        statusCode: RedirectStatusCode;
        hits: number;
        createdAt: Date;
      }[]
    >();

  return rows.map((r) => ({
    id: id(r._id),
    from: r.from,
    to: r.to,
    statusCode: r.statusCode,
    hits: r.hits,
    createdAt: iso(r.createdAt) ?? "",
  }));
}
