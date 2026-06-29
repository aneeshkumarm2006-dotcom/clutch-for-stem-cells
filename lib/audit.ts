/**
 * Audit log writer — one entry per admin mutation (Stage 3.8 / PRD §5.9, §8.12).
 *
 * Call after a successful create/update/delete in an admin route or Server
 * Action. {@link recordAudit} is **resilient**: it never throws into the
 * caller's flow — a logging failure must not roll back a real mutation — and
 * returns the created entry or `null`. Pass `before`/`after` with `diffOnly` to
 * store just the changed fields (keeps the log compact and readable in
 * `/admin/audit-log`).
 */
import { Types } from "mongoose";

import { dbConnect } from "@/lib/db";
import { AuditLog } from "@/models";
import type { IAuditLog } from "@/models";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof Types.ObjectId)
  );
}

/**
 * Shallow field-level diff: for every key that differs (by value identity via
 * JSON), keep the old value under `before` and the new value under `after`.
 * Added keys appear only in `after`; removed keys only in `before`.
 */
export function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      if (key in before) changedBefore[key] = before[key];
      if (key in after) changedAfter[key] = after[key];
    }
  }
  return { before: changedBefore, after: changedAfter };
}

export interface RecordAuditInput {
  /** The signed-in actor (from the session). Null for system/cron actions. */
  actorUserId?: Types.ObjectId | string | null;
  /** Verb + entity, e.g. "clinic.publish", "review.approve", "user.suspend". */
  action: string;
  /** Collection/entity name, e.g. "Clinic", "Review", "SiteSetting". */
  entityType: string;
  /** Affected document id (or singleton key like "global"). */
  entityId?: Types.ObjectId | string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  /** When true and before/after are objects, store only the changed fields. */
  diffOnly?: boolean;
}

/**
 * Persist an audit entry. Swallows and logs any error so the surrounding
 * mutation is never affected. Returns the entry, or `null` on failure.
 */
export async function recordAudit(
  input: RecordAuditInput,
): Promise<IAuditLog | null> {
  try {
    await dbConnect();

    let before = input.before;
    let after = input.after;
    if (input.diffOnly && isPlainObject(before) && isPlainObject(after)) {
      const diff = computeDiff(before, after);
      before = diff.before;
      after = diff.after;
    }

    return await AuditLog.create({
      actorUserId: input.actorUserId
        ? new Types.ObjectId(String(input.actorUserId))
        : null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId != null ? String(input.entityId) : undefined,
      before,
      after,
      ip: input.ip,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Audit log write failed for "${input.action}":`, err);
    return null;
  }
}

/** Client IP from proxy headers, for the `ip` field on admin mutations. */
export function auditIpFromRequest(req: Request): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || undefined;
}

/**
 * Convenience wrapper that fills `ip` from the request headers.
 *
 *   await recordAuditFromRequest(req, {
 *     actorUserId: user.id, action: "clinic.update",
 *     entityType: "Clinic", entityId: clinic._id,
 *     before, after, diffOnly: true,
 *   });
 */
export function recordAuditFromRequest(
  req: Request,
  input: Omit<RecordAuditInput, "ip">,
): Promise<IAuditLog | null> {
  return recordAudit({ ...input, ip: auditIpFromRequest(req) });
}
