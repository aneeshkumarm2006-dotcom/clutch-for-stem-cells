/**
 * SEO-team login / logout.
 *
 *  POST   — verify the shared password (constant-time), mint a signed session
 *           cookie (httpOnly, SameSite=Lax, Secure in prod, ~7-day expiry).
 *           Rate-limited per IP to throttle brute force.
 *  DELETE — clear the session cookie (logout).
 *
 * Exempt from the middleware session gate (you can't be logged in yet), but the
 * same-origin CSRF guard still applies.
 */
import { fail, ok } from "@/lib/seoteam/api";
import {
  isDashboardConfigured,
  verifyDashboardPassword,
} from "@/lib/seoteam/auth";
import {
  SEOTEAM_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/seoteam/session";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 8;
const WINDOW_SECONDS = 15 * 60;

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: Request): Promise<Response> {
  if (!isDashboardConfigured()) {
    return fail(
      "Dashboard not configured. Set SEO_DASHBOARD_PASSWORD and SESSION_SECRET.",
      503,
    );
  }

  const limit = await rateLimit(`seoteam-login:${clientIp(req)}`, {
    limit: MAX_ATTEMPTS,
    windowSeconds: WINDOW_SECONDS,
  });
  if (!limit.success) {
    return new Response(
      JSON.stringify({ error: "Too many attempts. Try again later." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          ...rateLimitHeaders(limit),
        },
      },
    );
  }

  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return fail("Invalid request body.", 400);
  }

  if (!password || !verifyDashboardPassword(password)) {
    return fail("Incorrect password.", 401);
  }

  const token = await createSessionToken();
  const res = ok({ ok: true });
  res.headers.append(
    "Set-Cookie",
    serializeCookie(SEOTEAM_COOKIE, token, sessionCookieOptions()),
  );
  return res;
}

export async function DELETE(): Promise<Response> {
  const res = ok({ ok: true });
  res.headers.append(
    "Set-Cookie",
    serializeCookie(SEOTEAM_COOKIE, "", {
      ...sessionCookieOptions(),
      maxAge: 0,
    }),
  );
  return res;
}

/** Build a `Set-Cookie` header value (avoids depending on NextResponse cookies). */
function serializeCookie(
  name: string,
  value: string,
  opts: {
    httpOnly: boolean;
    sameSite: "lax";
    secure: boolean;
    path: string;
    maxAge: number;
  },
): string {
  const parts = [
    `${name}=${value}`,
    `Path=${opts.path}`,
    `Max-Age=${opts.maxAge}`,
    `SameSite=Lax`,
  ];
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}
