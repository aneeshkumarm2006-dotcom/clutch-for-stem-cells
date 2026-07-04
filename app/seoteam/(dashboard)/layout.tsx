/**
 * SEO-team dashboard chrome — the authenticated header (nav + logout) shown on
 * every dashboard route. Kept in its OWN route group so sibling routes under
 * /seoteam (e.g. the full-page /seoteam/preview/[id]) can opt out of this chrome
 * and wear the real public navbar/footer instead, while still inheriting the
 * parent layout's `noindex` metadata and the middleware auth gate.
 *
 * The header renders only when authenticated, so the login screen (which lives
 * outside this group) stays clean. Middleware guarantees every route in this
 * group is authenticated.
 */
import { isSeoAuthenticated } from "@/lib/seoteam/auth";
import { SeoTeamHeader } from "@/components/seoteam/header";

export default async function SeoDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authed = await isSeoAuthenticated();
  return (
    <>
      {authed ? <SeoTeamHeader /> : null}
      {children}
    </>
  );
}
