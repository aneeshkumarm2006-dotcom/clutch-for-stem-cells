/**
 * Cron request authorization (Stage 9.1 / PRD §12).
 *
 * Vercel Cron invokes the scheduled routes with `Authorization: Bearer
 * $CRON_SECRET` (the secret is injected by the platform). We verify that header
 * so the recompute/sitemap endpoints can't be triggered by the public — they do
 * real work and must not be a free DoS lever.
 *
 * Graceful degradation (the project-wide convention): if `CRON_SECRET` is unset
 * (local dev), authorization is skipped so the routes are callable by hand. In
 * production the secret MUST be set — an unset secret in prod is treated as a
 * misconfiguration and the request is allowed only in development.
 */

/** Returns `null` when authorized, or a 401 `Response` to short-circuit. */
export function verifyCronRequest(req: Request): Response | null {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    // No secret configured: allow in dev, refuse in prod (fail closed).
    if (process.env.NODE_ENV === "production") {
      return Response.json(
        { error: "Cron is not configured." },
        { status: 503 },
      );
    }
    return null;
  }

  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return null;

  return Response.json({ error: "Unauthorized." }, { status: 401 });
}
