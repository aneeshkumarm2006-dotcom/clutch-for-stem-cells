/**
 * Admin shell layout (Stage 6.1 / PRD §8).
 *
 * Server-gated to Editor+ via `requireRole` (defense-in-depth on top of the Edge
 * middleware; module pages re-check Admin/SuperAdmin where required). Renders the
 * persistent sidebar + mobile nav around each module. `noindex` — the admin must
 * never be crawled.
 */
import type { Metadata } from "next";

import { requireRole } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/sidebar";
import { MobileNav } from "@/components/admin/mobile-nav";
import { getPendingReviewCount } from "@/lib/admin/dashboard";
import { SITE_NAME } from "@/config/site";

export const metadata: Metadata = {
  title: { default: `Admin · ${SITE_NAME}`, template: `%s · Admin` },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("editor", "/admin");
  const pendingReviews = await getPendingReviewCount();
  const role = user.role ?? "editor";

  return (
    <div className="flex min-h-screen bg-surface-alt">
      <AdminSidebar role={role} pendingReviews={pendingReviews} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav role={role} pendingReviews={pendingReviews} />
        {children}
      </div>
    </div>
  );
}
