import assert from "node:assert/strict";
import { test } from "node:test";

process.env.ANALYTICSHUB_SECRET_KEY = Buffer.alloc(32, 7).toString("base64");

import {
  decrypt,
  encrypt,
  getSecretStatus,
} from "@/lib/analyticshub/crypto";

test("AES-GCM round-trips a value", () => {
  const secret = 'token with "quotes" and unicode ✓ 日本語';
  assert.equal(decrypt(encrypt(secret)), secret);
});

test("distinct ciphertexts for the same plaintext (random IV)", () => {
  assert.notEqual(encrypt("same"), encrypt("same"));
  assert.equal(decrypt(encrypt("same")), "same");
});

test("tampered ciphertext fails the GCM auth tag", () => {
  const ct = encrypt("secret");
  const parts = ct.split(".");
  // Flip a character in the ciphertext segment.
  const bad = parts[3]!.startsWith("A") ? "B" : "A";
  parts[3] = bad + parts[3]!.slice(1);
  assert.throws(() => decrypt(parts.join(".")));
});

test("malformed payload is rejected", () => {
  assert.throws(() => decrypt("not-a-real-ciphertext"));
});

test("getSecretStatus reports each failure mode by name", () => {
  const saved = process.env.ANALYTICSHUB_SECRET_KEY;

  assert.deepEqual(getSecretStatus(), { ok: true });

  delete process.env.ANALYTICSHUB_SECRET_KEY;
  const missing = getSecretStatus();
  assert.equal(missing.ok, false);
  assert.equal(missing.ok === false && missing.reason, "missing");

  process.env.ANALYTICSHUB_SECRET_KEY = Buffer.alloc(16, 1).toString("base64");
  const short = getSecretStatus();
  assert.equal(short.ok, false);
  assert.equal(short.ok === false && short.reason, "bad_length");
  assert.equal(
    short.ok === false && short.reason === "bad_length" && short.decodedLength,
    16,
  );

  process.env.ANALYTICSHUB_SECRET_KEY = "!!!not base64!!!";
  const bad = getSecretStatus();
  assert.equal(bad.ok, false);
  assert.equal(bad.ok === false && bad.reason, "not_base64");

  process.env.ANALYTICSHUB_SECRET_KEY = saved;
});
