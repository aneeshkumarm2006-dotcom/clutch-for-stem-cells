import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  ClinicStatus,
  ClinicTier,
  LeadStatus,
  ReportStatus,
  ReviewStatus,
  UserRole,
  UserStatus,
  ArticleStatus,
} from "@/lib/enums";

/**
 * Status / tier / role pills for admin tables (Design §10.5, §10.13). Maps each
 * domain enum to a `Badge` variant + sentence-case label in one place so every
 * module renders status consistently.
 */

type Variant = NonNullable<BadgeProps["variant"]>;

const CLINIC_STATUS: Record<ClinicStatus, [Variant, string]> = {
  published: ["success", "Published"],
  pending: ["warning", "Pending"],
  draft: ["neutral", "Draft"],
  archived: ["neutral", "Archived"],
};

const CLINIC_TIER: Record<ClinicTier, [Variant, string]> = {
  featured: ["featured", "Featured"],
  verified: ["verified", "Verified"],
  basic: ["neutral", "Basic"],
};

const REVIEW_STATUS: Record<ReviewStatus, [Variant, string]> = {
  approved: ["success", "Approved"],
  pending: ["warning", "Pending"],
  rejected: ["danger", "Rejected"],
  spam: ["danger", "Spam"],
};

const LEAD_STATUS: Record<LeadStatus, [Variant, string]> = {
  new: ["info", "New"],
  contacted: ["warning", "Contacted"],
  qualified: ["success", "Qualified"],
  closed: ["neutral", "Closed"],
  spam: ["danger", "Spam"],
};

const REPORT_STATUS: Record<ReportStatus, [Variant, string]> = {
  open: ["warning", "Open"],
  reviewing: ["info", "Reviewing"],
  resolved: ["success", "Resolved"],
  dismissed: ["neutral", "Dismissed"],
};

const USER_STATUS: Record<UserStatus, [Variant, string]> = {
  active: ["success", "Active"],
  suspended: ["danger", "Suspended"],
};

const USER_ROLE: Record<UserRole, [Variant, string]> = {
  superadmin: ["premier", "Super admin"],
  admin: ["info", "Admin"],
  editor: ["info", "Editor"],
  provider: ["neutral", "Provider"],
  member: ["neutral", "Member"],
};

const ARTICLE_STATUS: Record<ArticleStatus, [Variant, string]> = {
  published: ["success", "Published"],
  scheduled: ["warning", "Scheduled"],
  draft: ["neutral", "Draft"],
};

function Pill({
  pair,
  className,
}: {
  pair: [Variant, string];
  className?: string;
}) {
  return (
    <Badge variant={pair[0]} className={cn("whitespace-nowrap", className)}>
      {pair[1]}
    </Badge>
  );
}

export const ClinicStatusBadge = ({ status }: { status: ClinicStatus }) => (
  <Pill pair={CLINIC_STATUS[status]} />
);
export const ClinicTierBadge = ({ tier }: { tier: ClinicTier }) => (
  <Pill pair={CLINIC_TIER[tier]} />
);
export const ReviewStatusBadge = ({ status }: { status: ReviewStatus }) => (
  <Pill pair={REVIEW_STATUS[status]} />
);
export const LeadStatusBadge = ({ status }: { status: LeadStatus }) => (
  <Pill pair={LEAD_STATUS[status]} />
);
export const ReportStatusBadge = ({ status }: { status: ReportStatus }) => (
  <Pill pair={REPORT_STATUS[status]} />
);
export const UserStatusBadge = ({ status }: { status: UserStatus }) => (
  <Pill pair={USER_STATUS[status]} />
);
export const UserRoleBadge = ({ role }: { role: UserRole }) => (
  <Pill pair={USER_ROLE[role]} />
);
export const ArticleStatusBadge = ({ status }: { status: ArticleStatus }) => (
  <Pill pair={ARTICLE_STATUS[status]} />
);
