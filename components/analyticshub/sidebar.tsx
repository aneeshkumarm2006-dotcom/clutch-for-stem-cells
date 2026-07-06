"use client";

import {
  BarChart3,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  Search,
  Settings,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useHub } from "@/components/analyticshub/context";
import type { SourceId, SourceStatus } from "@/lib/analyticshub/types";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  source?: SourceId;
}

const NAV: NavItem[] = [
  { href: "/analyticshub", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/analyticshub/ga4", label: "Analytics", icon: BarChart3, source: "ga4" },
  { href: "/analyticshub/gsc", label: "Search Console", icon: Search, source: "gsc" },
  { href: "/analyticshub/meta", label: "Meta Ads", icon: Megaphone, source: "meta" },
  { href: "/analyticshub/gads", label: "Google Ads", icon: Target, source: "gads" },
  { href: "/analyticshub/users", label: "Users", icon: Users, source: "users" },
  { href: "/analyticshub/settings", label: "Settings", icon: Settings },
];

function dotClass(status?: SourceStatus): string {
  switch (status) {
    case "ok":
      return "bg-success";
    case "reconnect_needed":
      return "bg-warning";
    case "error":
      return "bg-danger";
    default:
      return "bg-border-strong";
  }
}

function useActive() {
  const pathname = usePathname();
  return (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

function useStatusFor() {
  const { status } = useHub();
  return (source?: SourceId): SourceStatus | undefined =>
    source ? status?.sources.find((s) => s.source === source)?.status : undefined;
}

export function DesktopSidebar({ projectName }: { projectName: string }) {
  const isActive = useActive();
  const statusFor = useStatusFor();
  return (
    <aside
      data-lenis-prevent
      className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface md:flex"
    >
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary font-display text-base font-bold text-primary-foreground">
          {projectName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate font-display text-sm font-semibold text-text-primary">
            {projectName}
          </div>
          <div className="text-[11px] text-text-muted">Analytics</div>
        </div>
      </div>
      <nav className="flex flex-col gap-0.5 px-2 py-2">
        {NAV.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-tint font-medium text-text-link"
                  : "text-text-secondary hover:bg-surface-alt hover:text-text-primary",
              )}
            >
              {active && (
                <span className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-primary" />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.source && (
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    dotClass(statusFor(item.source)),
                  )}
                />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileNav() {
  const isActive = useActive();
  const statusFor = useStatusFor();
  return (
    <nav
      data-lenis-prevent
      className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-3 py-2 md:hidden"
    >
      {NAV.map((item) => {
        const active = isActive(item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors",
              active
                ? "bg-tint font-medium text-text-link"
                : "text-text-secondary hover:bg-surface-alt",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
            {item.source && (
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  dotClass(statusFor(item.source)),
                )}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
