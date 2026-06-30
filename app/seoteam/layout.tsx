/**
 * SEO-team dashboard shell — its own chrome (NOT the public navbar/footer) and
 * hard `noindex, nofollow` so the dashboard never appears in search results
 * (paired with the `Disallow: /seoteam` in robots.txt and the middleware gate).
 *
 * The header (with nav + logout) renders only when authenticated, so the login
 * screen stays clean. Middleware guarantees: /seoteam/login ⇒ unauthenticated,
 * every other /seoteam route ⇒ authenticated.
 */
import type { Metadata } from "next";

import { isSeoAuthenticated } from "@/lib/seoteam/auth";
import { SeoTeamHeader } from "@/components/seoteam/header";

export const metadata: Metadata = {
  title: "SEO Team",
  robots: { index: false, follow: false },
};

export default async function SeoTeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authed = await isSeoAuthenticated();
  return (
    <div className="min-h-screen bg-background">
      {authed ? <SeoTeamHeader /> : null}
      {children}
    </div>
  );
}
