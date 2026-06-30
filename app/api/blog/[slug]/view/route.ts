/**
 * View counter beacon — `POST /api/blog/[slug]/view`.
 *
 * Public + same-origin (CSRF guard in middleware). Fired once per visit by a
 * tiny client component so the public post page stays statically cacheable (ISR)
 * while view counts still increment. Lightly rate-limited per IP+slug; failures
 * are swallowed (monitoring metric, not critical state).
 */
import { incrementBlogViews } from "@/lib/seoteam/blog-data";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
): Promise<Response> {
  const slug = params.slug;
  try {
    const limit = await rateLimit(`blog-view:${clientIp(req)}:${slug}`, {
      limit: 5,
      windowSeconds: 60,
    });
    if (limit.success) {
      await incrementBlogViews(slug);
    }
  } catch {
    // Best-effort metric — never fail the request.
  }
  return new Response(null, { status: 204 });
}
