/**
 * AnalyticsHub cryptography — `node:crypto` only (no native deps, serverless-safe).
 *
 * One env secret, `ANALYTICSHUB_SECRET_KEY` (32-byte base64), is the root key.
 * Two subkeys are HKDF-derived from it with domain-separated `info` labels:
 *   - a 256-bit AES-GCM key that encrypts every value stored in the config
 *     collection (tokens, service-account keys, the password hash);
 *   - a 256-bit HMAC key that signs the session cookie (see `session.ts`).
 *
 * Deriving both from one root means the operator manages exactly one secret;
 * rotating it deliberately orphans everything previously stored. Env is read
 * lazily (never at module top-level) so a missing secret degrades to a clear
 * `/status` message rather than a build/boot crash.
 */
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { HubError } from "@/lib/analyticshub/errors";

const AES_INFO = "analyticshub/aes-256-gcm/v1";
const HMAC_INFO = "analyticshub/hmac-session/v1";
const HKDF_SALT = "analyticshub/hkdf-salt/v1";
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export type SecretStatus =
  | { ok: true }
  | { ok: false; reason: "missing"; message: string }
  | { ok: false; reason: "not_base64"; message: string }
  | { ok: false; reason: "bad_length"; decodedLength: number; message: string };

interface DerivedKeys {
  aes: Buffer;
  hmac: Buffer;
}

let cache: { root: string; derived: DerivedKeys } | null = null;

function inspectRoot():
  | { key: Buffer }
  | { status: Exclude<SecretStatus, { ok: true }> } {
  const raw = process.env.ANALYTICSHUB_SECRET_KEY;
  if (!raw || raw.trim().length === 0) {
    return {
      status: {
        ok: false,
        reason: "missing",
        message:
          "ANALYTICSHUB_SECRET_KEY is not set. Generate one with `openssl rand -base64 32`, add it to your environment, then redeploy (env vars only apply to new deployments).",
      },
    };
  }
  const trimmed = raw.trim();
  if (!BASE64_RE.test(trimmed)) {
    return {
      status: {
        ok: false,
        reason: "not_base64",
        message:
          "ANALYTICSHUB_SECRET_KEY is not valid base64. Paste the raw 44-character output of `openssl rand -base64 32` with no surrounding quotes.",
      },
    };
  }
  const key = Buffer.from(trimmed, "base64");
  if (key.length !== 32) {
    return {
      status: {
        ok: false,
        reason: "bad_length",
        decodedLength: key.length,
        message: `ANALYTICSHUB_SECRET_KEY must decode to 32 bytes but decoded to ${key.length}. Regenerate it with \`openssl rand -base64 32\`.`,
      },
    };
  }
  return { key };
}

/** Non-throwing check for `/status` (distinguishes each failure mode). */
export function getSecretStatus(): SecretStatus {
  const r = inspectRoot();
  return "key" in r ? { ok: true } : r.status;
}

function derive(): DerivedKeys {
  const r = inspectRoot();
  if ("status" in r) {
    const s = r.status;
    const code =
      s.reason === "missing"
        ? "secret_missing"
        : s.reason === "not_base64"
          ? "secret_not_base64"
          : "secret_bad_length";
    throw new HubError(code, s.message, 500);
  }
  const rootStr = r.key.toString("base64");
  if (cache && cache.root === rootStr) return cache.derived;
  const derived: DerivedKeys = {
    aes: Buffer.from(hkdfSync("sha256", r.key, HKDF_SALT, AES_INFO, 32)),
    hmac: Buffer.from(hkdfSync("sha256", r.key, HKDF_SALT, HMAC_INFO, 32)),
  };
  cache = { root: rootStr, derived };
  return derived;
}

/** The HKDF-derived key used to sign session cookies. Throws if secret bad. */
export function getSessionHmacKey(): Buffer {
  return derive().hmac;
}

/** AES-256-GCM encrypt → `v1.iv.tag.ciphertext` (base64url segments). */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derive().aes, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ct.toString("base64url"),
  ].join(".");
}

/** Inverse of {@link encrypt}; throws on tamper (GCM tag mismatch). */
export function decrypt(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new HubError("internal", "Malformed stored value.", 500);
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    derive().aes,
    Buffer.from(parts[1]!, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(parts[2]!, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(parts[3]!, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** Constant-time string compare (equal length required). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
