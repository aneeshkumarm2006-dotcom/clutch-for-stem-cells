/**
 * The pure request handler — the whole hub API behind one function. It takes a
 * plain {@link HubRequest} (method + URL-derived path segments + query + cookies
 * + parsed body) and a {@link HubContext} (store, clock, origin, client IP, and
 * the injected Users fetcher) and returns a plain {@link HubResponse}.
 *
 * Because it depends only on those plain inputs — never on Next internals,
 * Mongoose, or `server-only` — tests exercise the exact production dispatch with
 * an in-memory store and a fixed clock.
 */
import * as connect from "@/lib/analyticshub/connect";
import { getSecretStatus } from "@/lib/analyticshub/crypto";
import { dataRoute } from "@/lib/analyticshub/data";
import { googleOAuthConfigured } from "@/lib/analyticshub/env";
import { isHubError } from "@/lib/analyticshub/errors";
import { K } from "@/lib/analyticshub/keys";
import { hashPassword, verifyPassword } from "@/lib/analyticshub/password";
import {
  clearRateLimit,
  peekRateLimit,
  recordFailure,
} from "@/lib/analyticshub/ratelimit";
import {
  isAuthed,
  json,
  redirect,
  type HubContext,
  type HubRequest,
  type HubResponse,
} from "@/lib/analyticshub/respond";
import {
  HUB_COOKIE,
  createSessionToken,
  serializeCookie,
  sessionCookieOptions,
} from "@/lib/analyticshub/session";
import { getJSON, setJSON } from "@/lib/analyticshub/store";
import type {
  GadsConfig,
  GoogleConfig,
  HubStatusView,
  MetaConfig,
  ProjectConfig,
  SourceStatus,
  SourceStatusView,
} from "@/lib/analyticshub/types";
import { asRecord, str } from "@/lib/analyticshub/util";

const LOGIN_LIMIT = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

const DEFAULT_PROJECT: ProjectConfig = {
  name: "My Stem Cell Guide",
  primary: "#0e80cc",
  accent: "#e2f0fb",
};

const NOT_FOUND = { error: "Not found.", code: "not_found" } as const;

export async function handle(
  req: HubRequest,
  ctx: HubContext,
): Promise<HubResponse> {
  try {
    return await route(req, ctx);
  } catch (err) {
    if (isHubError(err)) {
      return json(err.httpStatus, { error: err.message, code: err.code });
    }
    // eslint-disable-next-line no-console
    console.error("[analyticshub] handler error:", err);
    return json(500, {
      error: "Something went wrong. Try again.",
      code: "internal",
    });
  }
}

async function route(
  req: HubRequest,
  ctx: HubContext,
): Promise<HubResponse> {
  const [head, ...rest] = req.segments;
  const m = req.method.toUpperCase();
  if (!head) return json(404, NOT_FOUND);

  // ── Public routes ──
  if (head === "status" && m === "GET") return statusRoute(req, ctx);
  if (head === "setup" && m === "POST") return setupRoute(req, ctx);
  if (head === "login" && m === "POST") return loginRoute(req, ctx);
  if (head === "logout" && m === "POST") return logoutRoute();

  // ── Google OAuth (browser GET redirects — gate but redirect on failure) ──
  if (head === "oauth" && rest[0] === "google") {
    if (!isAuthed(req, ctx)) {
      return redirect(`${ctx.origin}/analyticshub/settings?google=session`);
    }
    if (rest[1] === "start") return connect.googleStart(ctx);
    if (rest[1] === "callback") return connect.googleCallback(req, ctx);
    return json(404, NOT_FOUND);
  }

  // ── Everything below requires a valid session (JSON 401) ──
  if (!isAuthed(req, ctx)) {
    return json(401, { error: "Sign in to continue.", code: "unauthorized" });
  }

  switch (head) {
    case "project":
      if (m === "POST") return projectRoute(req, ctx);
      break;
    case "password":
      if (m === "POST") return passwordRoute(req, ctx);
      break;
    case "google":
      return googleSub(rest, req, ctx, m);
    case "meta":
      return metaSub(rest, req, ctx, m);
    case "gads":
      return gadsSub(rest, req, ctx, m);
    case "data":
      if (m === "GET") return dataRoute(rest, req, ctx);
      break;
  }
  return json(404, NOT_FOUND);
}

function googleSub(
  rest: string[],
  req: HubRequest,
  ctx: HubContext,
  m: string,
): Promise<HubResponse> {
  const sub = rest[0];
  if (sub === "options" && m === "GET") return connect.googleOptions(ctx);
  if (sub === "select" && m === "POST") return connect.googleSelect(req, ctx);
  if (sub === "service-account" && m === "POST")
    return connect.googleServiceAccount(req, ctx);
  if (sub === "disconnect" && m === "POST")
    return connect.googleDisconnect(ctx);
  return Promise.resolve(json(404, NOT_FOUND));
}

function metaSub(
  rest: string[],
  req: HubRequest,
  ctx: HubContext,
  m: string,
): Promise<HubResponse> {
  const sub = rest[0];
  if (sub === "accounts" && m === "POST") return connect.metaAccounts(req);
  if (sub === "select" && m === "POST") return connect.metaSelect(req, ctx);
  if (sub === "disconnect" && m === "POST") return connect.metaDisconnect(ctx);
  return Promise.resolve(json(404, NOT_FOUND));
}

function gadsSub(
  rest: string[],
  req: HubRequest,
  ctx: HubContext,
  m: string,
): Promise<HubResponse> {
  const sub = rest[0];
  if (sub === "save" && m === "POST") return connect.gadsSave(req, ctx);
  if (sub === "disconnect" && m === "POST") return connect.gadsDisconnect(ctx);
  return Promise.resolve(json(404, NOT_FOUND));
}

/* ── Status ───────────────────────────────────────────────────────────────── */

function srcStatus(connected: boolean, health: boolean): SourceStatus {
  if (!connected) return "not_connected";
  return health ? "reconnect_needed" : "ok";
}

async function statusRoute(
  req: HubRequest,
  ctx: HubContext,
): Promise<HubResponse> {
  const secret = getSecretStatus();
  const authed = isAuthed(req, ctx);
  const problems: string[] = [];

  let dbOk = false;
  let setup = false;
  let project = DEFAULT_PROJECT;
  let google: GoogleConfig | null = null;
  let meta: MetaConfig | null = null;
  let gads: GadsConfig | null = null;
  let hGoogle = false;
  let hMeta = false;
  let hGads = false;

  if (!secret.ok) {
    problems.push(secret.message);
  } else {
    try {
      const pw = await ctx.store.get(K.password);
      dbOk = true;
      setup = pw !== null;
      project = (await getJSON<ProjectConfig>(ctx.store, K.project)) ?? project;
      google = await getJSON<GoogleConfig>(ctx.store, K.google);
      meta = await getJSON<MetaConfig>(ctx.store, K.meta);
      gads = await getJSON<GadsConfig>(ctx.store, K.gads);
      hGoogle = (await ctx.store.get(K.healthGoogle)) !== null;
      hMeta = (await ctx.store.get(K.healthMeta)) !== null;
      hGads = (await ctx.store.get(K.healthGads)) !== null;
    } catch (err) {
      problems.push(
        isHubError(err)
          ? err.message
          : "Database error while reading hub config.",
      );
    }
  }

  // Connection labels (property id / account) only leak to an authed owner.
  const label = (v?: string): string | undefined => (authed ? v : undefined);
  const sources: SourceStatusView[] = [
    { source: "users", status: dbOk ? "ok" : "error" },
    {
      source: "ga4",
      status: srcStatus(Boolean(google?.ga4PropertyId), hGoogle),
      label: label(google?.ga4PropertyId),
    },
    {
      source: "gsc",
      status: srcStatus(Boolean(google?.gscSiteUrl), hGoogle),
      label: label(google?.gscSiteUrl),
    },
    {
      source: "meta",
      status: srcStatus(Boolean(meta), hMeta),
      label: label(meta?.accountName ?? meta?.adAccountId),
    },
    {
      source: "gads",
      status: srcStatus(Boolean(gads), hGads),
      label: label(gads?.customerId),
    },
  ];

  const view: HubStatusView = {
    setup,
    authed,
    secretOk: secret.ok,
    dbOk,
    googleOAuthAvailable: googleOAuthConfigured(),
    project,
    sources,
    problems,
  };
  return json(200, view, { headers: { "Cache-Control": "no-store" } });
}

/* ── Auth + project ───────────────────────────────────────────────────────── */

function parseProject(raw: unknown): ProjectConfig | null {
  const rec = asRecord(raw);
  const name = str(rec?.name);
  if (!name) return null;
  return {
    name,
    primary: str(rec?.primary) ?? DEFAULT_PROJECT.primary,
    accent: str(rec?.accent) ?? DEFAULT_PROJECT.accent,
  };
}

function authCookie(now: number): string[] {
  return [
    serializeCookie(HUB_COOKIE, createSessionToken(now), sessionCookieOptions()),
  ];
}

async function setupRoute(
  req: HubRequest,
  ctx: HubContext,
): Promise<HubResponse> {
  if ((await ctx.store.get(K.password)) !== null) {
    return json(409, { error: "Already set up. Sign in instead.", code: "already_setup" });
  }
  const body = asRecord(req.body) ?? {};
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8) {
    return json(422, {
      error: "Password must be at least 8 characters.",
      code: "bad_request",
    });
  }
  await ctx.store.set(K.password, hashPassword(password));
  const project = parseProject(body.project);
  if (project) await setJSON(ctx.store, K.project, project);
  return json(200, { ok: true }, { cookies: authCookie(ctx.now) });
}

async function loginRoute(
  req: HubRequest,
  ctx: HubContext,
): Promise<HubResponse> {
  const stored = await ctx.store.get(K.password);
  if (!stored) {
    return json(409, {
      error: "Not set up yet. Complete first-run setup.",
      code: "not_setup",
    });
  }
  const rlKey = `login:${ctx.clientIp}`;
  const peek = await peekRateLimit(ctx.store, rlKey, LOGIN_LIMIT, ctx.now);
  if (peek.blocked) {
    return json(
      429,
      {
        error: `Too many attempts. Try again in ${peek.retryAfterSeconds}s.`,
        code: "rate_limited",
      },
      { headers: { "Retry-After": String(peek.retryAfterSeconds) } },
    );
  }
  const password =
    typeof asRecord(req.body)?.password === "string"
      ? (asRecord(req.body)!.password as string)
      : "";
  if (!password || !verifyPassword(password, stored)) {
    await recordFailure(ctx.store, rlKey, LOGIN_WINDOW_MS, ctx.now);
    return json(401, { error: "Incorrect password.", code: "unauthorized" });
  }
  await clearRateLimit(ctx.store, rlKey);
  return json(200, { ok: true }, { cookies: authCookie(ctx.now) });
}

function logoutRoute(): HubResponse {
  return json(
    200,
    { ok: true },
    { cookies: [serializeCookie(HUB_COOKIE, "", sessionCookieOptions(0))] },
  );
}

async function projectRoute(
  req: HubRequest,
  ctx: HubContext,
): Promise<HubResponse> {
  const project = parseProject(req.body);
  if (!project) {
    return json(422, { error: "Project name is required.", code: "bad_request" });
  }
  await setJSON(ctx.store, K.project, project);
  return json(200, { ok: true, project });
}

async function passwordRoute(
  req: HubRequest,
  ctx: HubContext,
): Promise<HubResponse> {
  const body = asRecord(req.body) ?? {};
  const current = typeof body.current === "string" ? body.current : "";
  const next = typeof body.next === "string" ? body.next : "";
  const stored = await ctx.store.get(K.password);
  if (!stored || !verifyPassword(current, stored)) {
    return json(401, {
      error: "Current password is incorrect.",
      code: "unauthorized",
    });
  }
  if (next.length < 8) {
    return json(422, {
      error: "New password must be at least 8 characters.",
      code: "bad_request",
    });
  }
  await ctx.store.set(K.password, hashPassword(next));
  return json(200, { ok: true }, { cookies: authCookie(ctx.now) });
}
