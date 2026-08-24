/**
 * Public-form guard — rate limit + captcha in one call (Stage 3.7 / PRD §13).
 *
 * Wraps the anti-abuse checks every unauthenticated form needs (review, lead,
 * contact). Returns a `Response` to short-circuit the handler, or `null` to
 * proceed — the same shape as `authErrorResponse` in `lib/auth`, so handlers
 * read consistently:
 *
 *   const blocked = await guardPublicForm(req, { action: "review", captchaToken });
 *   if (blocked) return blocked;
 */
import { verifyCaptcha } from "@/lib/captcha";
import { getClientIp, subnetKey } from "@/lib/net";
import { rateLimitAll, rateLimitHeaders } from "@/lib/rate-limit";

// Re-exported for the handlers that already import it from here. The single
// implementation lives in `lib/net` so this guard and the spam guard can never
// disagree about which header the client IP comes from.
export { getClientIp };

export interface GuardOptions {
  /** Namespace for the limiter key, e.g. "review" | "lead" | "contact". */
  action: string;
  /** Captcha token from the form body (omit to skip the captcha check). */
  captchaToken?: string | null;
  /** Max submissions per window (default 5). */
  limit?: number;
  /** Window length in seconds (default 600 = 10 min). */
  windowSeconds?: number;
  /** Require a passing captcha even if the token is empty (default true). */
  requireCaptcha?: boolean;
}

/**
 * Enforce per-IP rate limiting then captcha. Resolves to `null` when the request
 * may proceed, or a JSON `Response` (429 / 400) to return immediately.
 */
export async function guardPublicForm(
  req: Request,
  opts: GuardOptions,
): Promise<Response | null> {
  const ip = getClientIp(req);
  const subnet = subnetKey(ip);
  const limit = opts.limit ?? 5;
  const windowSeconds = opts.windowSeconds ?? 600;

  // Address AND network neighbourhood: a per-address cap is free to evade with
  // a rented /24, so the subnet gets its own (looser) bucket over the same
  // window. Both counters increment on every call — see `rateLimitAll`.
  const limitResult = await rateLimitAll([
    { key: `ratelimit:${opts.action}:${ip}`, opts: { limit, windowSeconds } },
    ...(subnet
      ? [
          {
            key: `ratelimit:${opts.action}:net:${subnet}`,
            opts: { limit: limit * 6, windowSeconds },
          },
        ]
      : []),
  ]);
  if (!limitResult.success) {
    return Response.json(
      { error: "Too many requests. Please try again in a little while." },
      { status: 429, headers: rateLimitHeaders(limitResult) },
    );
  }

  if (opts.requireCaptcha !== false) {
    const captcha = await verifyCaptcha(opts.captchaToken, ip);
    if (!captcha.success) {
      return Response.json(
        { error: "Captcha verification failed. Please try again." },
        { status: 400 },
      );
    }
  }

  return null;
}
