"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CreditCard,
  FileText,
  Flag,
  Image as ImageIcon,
  LayoutDashboard,
  ListTree,
  ScrollText,
  Send,
  Settings,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { roleAtLeast, type UserRole } from "@/lib/enums";

/** A nav entry, gated to `minRole` and higher. */
interface NavLeaf {
  type: "leaf";
  label: string;
  href: string;
  icon: LucideIcon;
  minRole: UserRole;
  /** Renders a count badge fed by the matching admin metric. */
  badge?: "reviews" | "reports";
}
interface NavGroup {
  type: "group";
  label: string;
  icon: LucideIcon;
  minRole: UserRole;
  basePath: string;
  children: { label: string; href: string }[];
}
type NavEntry = NavLeaf | NavGroup;

const NAV: NavEntry[][] = [
  [
    { type: "leaf", label: "Dashboard", href: "/admin", icon: LayoutDashboard, minRole: "editor" },
    { type: "leaf", label: "Clinics", href: "/admin/clinics", icon: Building2, minRole: "editor" },
    { type: "leaf", label: "Reviews", href: "/admin/reviews", icon: Star, minRole: "editor", badge: "reviews" },
    { type: "leaf", label: "Reports", href: "/admin/reports", icon: Flag, minRole: "editor", badge: "reports" },
    { type: "leaf", label: "Leads", href: "/admin/leads", icon: Send, minRole: "editor" },
    {
      type: "group",
      label: "Taxonomy",
      icon: ListTree,
      minRole: "editor",
      basePath: "/admin/taxonomy",
      children: [
        { label: "Treatments", href: "/admin/taxonomy/treatments" },
        { label: "Conditions", href: "/admin/taxonomy/conditions" },
        { label: "Cell sources", href: "/admin/taxonomy/cell-sources" },
        { label: "Accreditations", href: "/admin/taxonomy/accreditations" },
        { label: "Locations", href: "/admin/taxonomy/locations" },
      ],
    },
    {
      type: "group",
      label: "Content",
      icon: FileText,
      minRole: "editor",
      basePath: "/admin/content",
      children: [
        { label: "Articles", href: "/admin/content/articles" },
        { label: "Pages & homepage", href: "/admin/content/pages" },
      ],
    },
    { type: "leaf", label: "Media", href: "/admin/media", icon: ImageIcon, minRole: "editor" },
  ],
  [
    { type: "leaf", label: "Users", href: "/admin/users", icon: Users, minRole: "admin" },
    { type: "leaf", label: "Providers", href: "/admin/providers", icon: Building2, minRole: "admin" },
    { type: "leaf", label: "Plans", href: "/admin/plans", icon: CreditCard, minRole: "admin" },
    { type: "leaf", label: "Settings", href: "/admin/settings", icon: Settings, minRole: "admin" },
  ],
  [
    { type: "leaf", label: "Audit log", href: "/admin/audit-log", icon: ScrollText, minRole: "superadmin" },
  ],
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

function Leaf({
  item,
  pathname,
  pendingReviews,
  openReports,
  onNavigate,
}: {
  item: NavLeaf;
  pathname: string;
  pendingReviews: number;
  openReports: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);
  const badgeCount =
    item.badge === "reviews"
      ? pendingReviews
      : item.badge === "reports"
        ? openReports
        : 0;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] transition-colors",
        active
          ? "bg-background font-semibold text-azure-700"
          : "font-medium text-text-secondary hover:bg-surface-alt",
      )}
    >
      {active ? (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />
      ) : null}
      <Icon className={cn("size-4", active ? "text-azure-700" : "text-slate-500")} />
      <span className="flex-1">{item.label}</span>
      {item.badge && badgeCount > 0 ? (
        <span className="rounded-md bg-warning-bg px-1.5 py-0.5 text-[11px] font-semibold text-warning-fg">
          {badgeCount}
        </span>
      ) : null}
    </Link>
  );
}

function Group({
  item,
  pathname,
  onNavigate,
}: {
  item: NavGroup;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const groupActive = pathname.startsWith(item.basePath);
  const [open, setOpen] = React.useState(groupActive);
  React.useEffect(() => {
    if (groupActive) setOpen(true);
  }, [groupActive]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] transition-colors",
          groupActive
            ? "font-semibold text-azure-700"
            : "font-medium text-text-secondary hover:bg-surface-alt",
        )}
      >
        <Icon className={cn("size-4", groupActive ? "text-azure-700" : "text-slate-500")} />
        <span className="flex-1 text-left">{item.label}</span>
      </button>
      {open ? (
        <div className="ml-[26px] grid gap-0.5 border-l border-slate-100 pl-2.5 pt-0.5">
          {item.children.map((child) => {
            const active = isActive(pathname, child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors",
                  active
                    ? "font-semibold text-azure-700"
                    : "text-text-secondary hover:bg-surface-alt",
                )}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** The nav list — shared by the desktop sidebar and the mobile sheet. */
export function NavList({
  role,
  pendingReviews,
  openReports,
  onNavigate,
}: {
  role: UserRole;
  pendingReviews: number;
  openReports: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const sections = NAV.map((section) =>
    section.filter((entry) => roleAtLeast(role, entry.minRole)),
  ).filter((section) => section.length > 0);

  return (
    <nav className="grid gap-0.5">
      {sections.map((section, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <div className="my-2 border-t border-slate-100" /> : null}
          {section.map((entry) =>
            entry.type === "leaf" ? (
              <Leaf
                key={entry.href}
                item={entry}
                pathname={pathname}
                pendingReviews={pendingReviews}
                openReports={openReports}
                onNavigate={onNavigate}
              />
            ) : (
              <Group
                key={entry.basePath}
                item={entry}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ),
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

/** Desktop sidebar (240px, sticky). Hidden below `lg`. */
export function AdminSidebar({
  role,
  pendingReviews,
  openReports,
}: {
  role: UserRole;
  pendingReviews: number;
  openReports: number;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 flex-none flex-col overflow-y-auto border-r border-border bg-surface px-3 py-4 lg:flex">
      <div className="flex items-center gap-2 px-2 pb-4">
        <Logo size="sm" href="/admin" />
        <span className="rounded-md bg-surface-alt px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
          Admin
        </span>
      </div>
      <NavList
        role={role}
        pendingReviews={pendingReviews}
        openReports={openReports}
      />
    </aside>
  );
}
