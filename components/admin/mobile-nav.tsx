"use client";

import * as React from "react";
import { Menu } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NavList } from "@/components/admin/sidebar";
import type { UserRole } from "@/lib/enums";

/** Mobile admin nav bar (`lg:hidden`) — hamburger opens the sidebar in a Sheet. */
export function MobileNav({
  role,
  pendingReviews,
}: {
  role: UserRole;
  pendingReviews: number;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          className="inline-flex size-9 items-center justify-center rounded-md border border-border text-text-secondary"
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 overflow-y-auto p-4">
          <div className="flex items-center gap-2 px-1 pb-4">
            <Logo size="sm" href="/admin" />
            <span className="rounded-md bg-surface-alt px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
              Admin
            </span>
          </div>
          <NavList
            role={role}
            pendingReviews={pendingReviews}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
      <Logo size="sm" href="/admin" />
    </div>
  );
}
