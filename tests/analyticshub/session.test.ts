import assert from "node:assert/strict";
import { test } from "node:test";

process.env.ANALYTICSHUB_SECRET_KEY = Buffer.alloc(32, 9).toString("base64");

import {
  HUB_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  verifySessionToken,
} from "@/lib/analyticshub/session";

const NOW = 1_700_000_000_000;

test("mint + verify at the same instant", () => {
  assert.equal(verifySessionToken(createSessionToken(NOW), NOW), true);
});

test("token expires after the TTL", () => {
  const token = createSessionToken(NOW);
  assert.equal(
    verifySessionToken(token, NOW + SESSION_TTL_SECONDS * 1000 + 1000),
    false,
  );
  assert.equal(
    verifySessionToken(token, NOW + SESSION_TTL_SECONDS * 1000 - 1000),
    true,
  );
});

test("rejects a tampered signature", () => {
  const token = createSessionToken(NOW);
  const [body, sig] = token.split(".");
  const flipped = (sig!.startsWith("A") ? "B" : "A") + sig!.slice(1);
  assert.equal(verifySessionToken(`${body}.${flipped}`, NOW), false);
});

test("rejects empty / malformed tokens", () => {
  assert.equal(verifySessionToken(undefined, NOW), false);
  assert.equal(verifySessionToken("", NOW), false);
  assert.equal(verifySessionToken("nodot", NOW), false);
});

test("cookie name is namespaced", () => {
  assert.equal(HUB_COOKIE, "analyticshub_session");
});
