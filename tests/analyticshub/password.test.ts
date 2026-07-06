import assert from "node:assert/strict";
import { test } from "node:test";

import { hashPassword, verifyPassword } from "@/lib/analyticshub/password";

test("scrypt hash verifies the correct password", () => {
  const hash = hashPassword("correct horse battery staple");
  assert.equal(verifyPassword("correct horse battery staple", hash), true);
});

test("scrypt hash rejects the wrong password", () => {
  const hash = hashPassword("hunter2hunter2");
  assert.equal(verifyPassword("hunter3hunter3", hash), false);
});

test("hashes are salted (two hashes of the same input differ)", () => {
  assert.notEqual(hashPassword("samepass1"), hashPassword("samepass1"));
});

test("a malformed stored hash returns false, never throws", () => {
  assert.equal(verifyPassword("x", "garbage"), false);
  assert.equal(verifyPassword("x", "scrypt.16384.8.1.only-four"), false);
});
