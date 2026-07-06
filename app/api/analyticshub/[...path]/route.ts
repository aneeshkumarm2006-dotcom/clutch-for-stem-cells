/**
 * The entire AnalyticsHub API behind ONE catch-all serverless function.
 *
 * The sub-path is parsed from `req.url` (NOT the `[...path]` route param): on a
 * plain Vercel function those segments aren't reliably surfaced, and parsing the
 * URL is also what the handler tests do — so production and tests share the
 * exact same dispatch. Node runtime (needs `node:crypto` + Mongoose), always
 * dynamic, never indexed.
 */
import { NextResponse, type NextRequest } from "next/server";

import { originFromRequest } from "@/lib/analyticshub/env";
import { handle } from "@/lib/analyticshub/handler";
import { MongoStore } from "@/lib/analyticshub/mongo-store";
import type { HubRequest, HubResponse } from "@/lib/analyticshub/respond";
import { fetchUsersSource } from "@/lib/analyticshub/sources/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREFIX = "/api/analyticshub";

function segmentsFromPath(pathname: string): string[] {
  let p = pathname;
  const idx = p.indexOf(PREFIX);
  if (idx >= 0) p = p.slice(idx + PREFIX.length);
  return p
    .split("/")
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    })
    .filter(Boolean);
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function toResponse(r: HubResponse): NextResponse {
  const headers = new Headers();
  for (const [k, v] of Object.entries(r.headers ?? {})) headers.set(k, v);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  for (const cookie of r.cookies ?? []) headers.append("Set-Cookie", cookie);

  if (r.status >= 300 && r.status < 400 && r.headers?.Location) {
    return new NextResponse(null, { status: r.status, headers });
  }
  return NextResponse.json(r.body ?? {}, { status: r.status, headers });
}

async function dispatch(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);

  let body: unknown;
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      body = await req.json();
    } catch {
      body = undefined;
    }
  }

  const cookies: Record<string, string | undefined> = {};
  for (const c of req.cookies.getAll()) cookies[c.name] = c.value;

  const hubReq: HubRequest = {
    method: req.method,
    segments: segmentsFromPath(url.pathname),
    query: url.searchParams,
    cookies,
    body,
  };

  const response = await handle(hubReq, {
    store: new MongoStore(),
    now: Date.now(),
    origin: originFromRequest({ headers: req.headers, url: req.url }),
    clientIp: clientIp(req),
    fetchUsers: fetchUsersSource,
  });

  return toResponse(response);
}

export const GET = dispatch;
export const POST = dispatch;
