/**
 * Audit log read-layer (PRD §8.12 / Stage 6.14). SuperAdmin, read-only.
 */
import "server-only";
import type { FilterQuery } from "mongoose";

import { dbConnect } from "@/lib/db";
import { id, iso, paginate, type Paginated } from "@/lib/admin/serialize";
import { AuditLog, User } from "@/models";
import type { IAuditLog } from "@/models";

export interface AdminAuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  actorName: string;
  ip?: string;
  at?: string;
  before?: unknown;
  after?: unknown;
}

export interface AuditQuery {
  q?: string;
  entityType?: string;
  page?: number;
  pageSize?: number;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getAdminAuditLog(
  query: AuditQuery = {},
): Promise<Paginated<AdminAuditRow> & { entityTypes: string[] }> {
  await dbConnect();
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 30;

  const filter: FilterQuery<IAuditLog> = {};
  if (query.entityType) filter.entityType = query.entityType;
  if (query.q) filter.action = new RegExp(escapeRegex(query.q), "i");

  const [docs, total, entityTypes] = await Promise.all([
    AuditLog.find(filter)
      .sort({ at: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    AuditLog.countDocuments(filter),
    AuditLog.distinct("entityType"),
  ]);

  const actorIds = [
    ...new Set(docs.map((d) => d.actorUserId).filter(Boolean).map(String)),
  ];
  const actors = actorIds.length
    ? await User.find({ _id: { $in: actorIds } }).select("name email").lean()
    : [];
  const actorMap = new Map(actors.map((u) => [id(u._id), u.name || u.email]));

  const rows: AdminAuditRow[] = docs.map((d) => ({
    id: id(d._id),
    action: d.action,
    entityType: d.entityType,
    entityId: d.entityId,
    actorName: d.actorUserId
      ? (actorMap.get(String(d.actorUserId)) ?? "Unknown")
      : "System",
    ip: d.ip,
    at: iso(d.at),
    before: d.before,
    after: d.after,
  }));

  return {
    ...paginate(rows, total, page, pageSize),
    entityTypes: (entityTypes as string[]).sort(),
  };
}
