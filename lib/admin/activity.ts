/**
 * Humanize audit `action` strings ("review.approve") for the dashboard activity
 * feed and the audit log. Verb drives the status-dot tone.
 */
export type ActivityTone = "success" | "danger" | "info" | "neutral";

const VERB_TONE: Record<string, ActivityTone> = {
  approve: "success",
  publish: "success",
  verify: "success",
  restore: "success",
  activate: "success",
  create: "info",
  update: "info",
  assign: "info",
  note: "info",
  upload: "info",
  reorder: "info",
  unpublish: "neutral",
  tier: "neutral",
  reject: "danger",
  spam: "danger",
  delete: "danger",
  suspend: "danger",
  decline: "danger",
};

const VERB_LABEL: Record<string, string> = {
  approve: "approved",
  publish: "published",
  unpublish: "unpublished",
  verify: "verified",
  restore: "restored",
  reject: "rejected",
  spam: "marked spam",
  delete: "deleted",
  create: "created",
  update: "updated",
  suspend: "suspended",
  activate: "activated",
  assign: "assigned",
  note: "noted",
  upload: "uploaded",
  tier: "tier changed",
  role: "role changed",
  reorder: "reordered",
  decline: "declined",
  approveClaim: "claim approved",
};

const ENTITY_LABEL: Record<string, string> = {
  Clinic: "Clinic",
  Review: "Review",
  Lead: "Lead",
  Treatment: "Treatment",
  Condition: "Condition",
  CellSource: "Cell source",
  Accreditation: "Accreditation",
  Location: "Location",
  User: "User",
  Plan: "Plan",
  SiteSetting: "Settings",
  Media: "Media",
};

export function describeActivity(action: string): {
  label: string;
  tone: ActivityTone;
} {
  const [entityRaw, verbRaw = ""] = action.split(".");
  const entity =
    ENTITY_LABEL[entityRaw ?? ""] ??
    (entityRaw
      ? entityRaw.charAt(0).toUpperCase() + entityRaw.slice(1)
      : "Item");
  const verb = VERB_LABEL[verbRaw] ?? verbRaw;
  return {
    label: `${entity} ${verb}`.trim(),
    tone: VERB_TONE[verbRaw] ?? "neutral",
  };
}
