/**
 * SEO-team root shell — hard `noindex, nofollow` so nothing under /seoteam ever
 * appears in search results (paired with `Disallow: /seoteam` in robots.txt and
 * the middleware gate). Deliberately header-LESS: the authenticated dashboard
 * chrome lives in the `(dashboard)` route group, so sibling routes (the login
 * screen and the full-page /seoteam/preview/[id]) render without it — the
 * preview supplies the real public navbar/footer itself.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SEO Team",
  robots: { index: false, follow: false },
};

export default function SeoTeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
