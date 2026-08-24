/**
 * Client-IP and subnet derivation.
 *
 * The /24 and /48 buckets are what make a rented subnet cost money instead of
 * being free to rotate through, so the grouping has to be exact: two addresses
 * in one neighbourhood must produce the SAME key, and two in different
 * neighbourhoods must not.
 *
 * Run: npx tsx --tsconfig tsconfig.test.json --test tests/spam/net.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { getClientIp, isIpv4, normalizeIp, subnetKey } from "@/lib/net";

function req(headers: Record<string, string>): {
  headers: { get(name: string): string | null };
} {
  return { headers: { get: (n: string) => headers[n] ?? null } };
}

test("takes the leftmost address from x-forwarded-for", () => {
  assert.equal(
    getClientIp(req({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" })),
    "203.0.113.7",
  );
});

test("falls back through the header list, then to 'unknown'", () => {
  assert.equal(getClientIp(req({ "x-real-ip": "198.51.100.4" })), "198.51.100.4");
  assert.equal(getClientIp(req({})), "unknown");
});

test("normalizes ports, brackets and IPv4-mapped IPv6", () => {
  assert.equal(normalizeIp("1.2.3.4:5678"), "1.2.3.4");
  assert.equal(normalizeIp("[2001:db8::1]:443"), "2001:db8::1");
  // One client must never occupy two buckets.
  assert.equal(normalizeIp("::ffff:203.0.113.7"), "203.0.113.7");
});

test("isIpv4 rejects out-of-range octets", () => {
  assert.equal(isIpv4("192.168.0.1"), true);
  assert.equal(isIpv4("999.1.1.1"), false);
  assert.equal(isIpv4("1.2.3"), false);
});

test("IPv4: a rented /24 is one bucket", () => {
  const a = subnetKey("203.0.113.7");
  const b = subnetKey("203.0.113.201");
  assert.equal(a, "203.0.113.0/24");
  assert.equal(a, b);
  // A different /24 must not collide.
  assert.notEqual(a, subnetKey("203.0.114.7"));
});

test("IPv6: a /48 is one bucket, however the address is abbreviated", () => {
  const compact = subnetKey("2001:db8::1");
  const padded = subnetKey("2001:0db8:0000:1234::99");
  assert.equal(compact, "2001:0db8:0000::/48");
  assert.equal(compact, padded);
  assert.notEqual(compact, subnetKey("2001:db9::1"));
});

test("IPv6 zone ids don't split a bucket", () => {
  assert.equal(subnetKey("fe80::1%eth0"), subnetKey("fe80::2"));
});

test("an unusable address yields no subnet rather than a junk bucket", () => {
  assert.equal(subnetKey("unknown"), null);
  assert.equal(subnetKey("not-an-ip"), null);
});
