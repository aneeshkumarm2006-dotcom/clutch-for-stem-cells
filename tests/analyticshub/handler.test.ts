import assert from "node:assert/strict";
import { test } from "node:test";

process.env.ANALYTICSHUB_SECRET_KEY = Buffer.alloc(32, 3).toString("base64");

import { handle } from "@/lib/analyticshub/handler";
import type {
  HubContext,
  HubRequest,
  HubResponse,
} from "@/lib/analyticshub/respond";
import { MemoryStore } from "@/lib/analyticshub/store";

const NOW = 1_700_000_000_000;

function ctx(store: MemoryStore): HubContext {
  return { store, now: NOW, origin: "http://localhost:3000", clientIp: "1.2.3.4" };
}

/** Build a HubRequest by parsing the sub-path exactly like the route adapter. */
function req(
  method: string,
  path: string,
  opts: { body?: unknown; cookies?: Record<string, string | undefined> } = {},
): HubRequest {
  const [p, qs] = path.split("?");
  return {
    method,
    segments: p!.split("/").filter(Boolean),
    query: new URLSearchParams(qs ?? ""),
    cookies: opts.cookies ?? {},
    body: opts.body,
  };
}

function token(res: HubResponse): string {
  const raw = res.cookies?.[0] ?? "";
  return raw.split(";")[0]!.split("=").slice(1).join("=");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const body = (res: HubResponse) => res.body as any;

test("first-run flow: setup → authed status → data/all empty → login lockout", async () => {
  const store = new MemoryStore();

  // 1. Before setup.
  let res = await handle(req("GET", "status"), ctx(store));
  assert.equal(res.status, 200);
  assert.equal(body(res).setup, false);
  assert.equal(body(res).authed, false);
  assert.equal(body(res).secretOk, true);
  assert.equal(body(res).dbOk, true);

  // 2. Setup creates the password + mints the session cookie.
  res = await handle(
    req("POST", "setup", {
      body: { password: "supersecret", project: { name: "Acme" } },
    }),
    ctx(store),
  );
  assert.equal(res.status, 200);
  const authed = { analyticshub_session: token(res) };
  assert.ok(authed.analyticshub_session.length > 0);

  // 3. Authed status reflects setup + auth + the saved project.
  res = await handle(req("GET", "status", { cookies: authed }), ctx(store));
  assert.equal(body(res).setup, true);
  assert.equal(body(res).authed, true);
  assert.equal(body(res).project.name, "Acme");

  // 4. Setup is one-shot.
  res = await handle(
    req("POST", "setup", { body: { password: "again1234" } }),
    ctx(store),
  );
  assert.equal(res.status, 409);

  // 5. Missing cookie → unauthorized.
  res = await handle(req("GET", "data/all"), ctx(store));
  assert.equal(res.status, 401);

  // 6. data/all empty state: Users ok+empty, external sources not_connected.
  res = await handle(req("GET", "data/all", { cookies: authed }), ctx(store));
  assert.equal(res.status, 200);
  assert.equal(body(res).current.users.status, "ok");
  for (const s of ["ga4", "gsc", "meta", "gads"]) {
    assert.equal(body(res).current[s].status, "not_connected");
  }

  // 7. Login lockout after 8 failed attempts.
  for (let i = 0; i < 8; i++) {
    res = await handle(
      req("POST", "login", { body: { password: "wrong" } }),
      ctx(store),
    );
    assert.equal(res.status, 401);
  }
  res = await handle(
    req("POST", "login", { body: { password: "wrong" } }),
    ctx(store),
  );
  assert.equal(res.status, 429);

  // Even the correct password is blocked while locked out.
  res = await handle(
    req("POST", "login", { body: { password: "supersecret" } }),
    ctx(store),
  );
  assert.equal(res.status, 429);
});

test("login succeeds with the correct password (fresh store)", async () => {
  const store = new MemoryStore();
  await handle(
    req("POST", "setup", { body: { password: "letmein12" } }),
    ctx(store),
  );
  const res = await handle(
    req("POST", "login", { body: { password: "letmein12" } }),
    ctx(store),
  );
  assert.equal(res.status, 200);
  assert.ok(token(res).length > 0);
});

test("unknown paths 404 (when authed)", async () => {
  const store = new MemoryStore();
  const setup = await handle(
    req("POST", "setup", { body: { password: "abcdefgh" } }),
    ctx(store),
  );
  const authed = { analyticshub_session: token(setup) };
  const res = await handle(
    req("GET", "zzz/zzz", { cookies: authed }),
    ctx(store),
  );
  assert.equal(res.status, 404);
});
