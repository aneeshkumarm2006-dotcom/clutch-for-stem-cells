/**
 * AuditLog — append-only record of every admin mutation (PRD §5.9 / Stage 1.9).
 *
 * Written by `/lib/audit.ts` (Stage 3.8) and surfaced read-only in
 * `/admin/audit-log` (§8.12). `before`/`after` hold diff snapshots. Uses `at`
 * as the single timestamp (no `updatedAt` — entries are immutable).
 */
import { Schema, type Types } from "mongoose";
import { registerModel } from "@/models/_shared";

export interface IAuditLog {
  _id: Types.ObjectId;
  actorUserId?: Types.ObjectId | null;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  at: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, required: true, trim: true },
    entityType: { type: String, required: true, trim: true },
    // String (not ObjectId) so non-ObjectId keys (e.g. SiteSetting "global") fit.
    entityId: { type: String, trim: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    ip: { type: String, trim: true },
  },
  // `at` is the create time; entries are never updated.
  { timestamps: { createdAt: "at", updatedAt: false } },
);

AuditLogSchema.index({ at: -1 });
AuditLogSchema.index({ actorUserId: 1, at: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, at: -1 });

export const AuditLog = registerModel<IAuditLog>("AuditLog", AuditLogSchema);
export default AuditLog;
