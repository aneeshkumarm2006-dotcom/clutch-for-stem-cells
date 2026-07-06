/**
 * The request/response contract the pure handler speaks. The catch-all route
 * adapter (Node) translates a real `NextRequest` into a {@link HubRequest} and a
 * {@link HubResponse} back into a `Response`; tests build these plain objects
 * directly, exercising the exact same dispatch.
 */
import { HUB_COOKIE, verifySessionToken } from "@/lib/analyticshub/session";
import type { HubStore } from "@/lib/analyticshub/store";
import type { DateRange, SourceResult } from "@/lib/analyticshub/types";

export interface HubRequest {
  method: string;
  /** Path segments after `/api/analyticshub/`, e.g. `["data", "ga4"]`. */
  segments: string[];
  query: URLSearchParams;
  cookies: Record<string, string | undefined>;
  body: unknown;
}

export interface HubContext {
  store: HubStore;
  now: number; // epoch ms
  origin: string; // absolute origin, for building the OAuth redirect URI
  clientIp: string;
  /**
   * The Users source touches the host Mongo `User` model (server-only), so it is
   * injected by the route adapter rather than imported by the pure handler.
   * Omitted in tests → an empty, zero-filled Users result is returned.
   */
  fetchUsers?: (range: DateRange) => Promise<SourceResult>;
}

export interface HubResponse {
  status: number;
  body: unknown; // JSON-serializable (null → empty body, e.g. redirects)
  headers?: Record<string, string>;
  cookies?: string[]; // raw Set-Cookie header values
}

export function json(
  status: number,
  body: unknown,
  extra?: Partial<HubResponse>,
): HubResponse {
  return { status, body, ...extra };
}

export function redirect(location: string, cookies?: string[]): HubResponse {
  return { status: 302, body: null, headers: { Location: location }, cookies };
}

/** True when the request carries a valid, unexpired session cookie. */
export function isAuthed(req: HubRequest, ctx: HubContext): boolean {
  return verifySessionToken(req.cookies[HUB_COOKIE], ctx.now);
}
