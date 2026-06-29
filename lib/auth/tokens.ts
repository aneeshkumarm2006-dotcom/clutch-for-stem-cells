/**
 * One-time token helpers — Stage 2.2 (email verification + password reset).
 *
 * We email the *raw* token to the user but persist only its SHA-256 hash on the
 * User record, so a database leak never exposes a usable link. Verification
 * re-hashes the incoming token and matches on the stored hash + expiry.
 */
import { createHash, randomBytes } from "node:crypto";

/** Hours a verification / reset link stays valid. */
export const EMAIL_VERIFICATION_TTL_HOURS = 24;
export const PASSWORD_RESET_TTL_HOURS = 1;

export interface TokenPair {
  /** Sent to the user (URL-safe). Never stored. */
  token: string;
  /** Stored on the User record. */
  tokenHash: string;
}

/** SHA-256 a raw token for storage / lookup. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Generate a high-entropy URL-safe token and its storage hash. */
export function createToken(bytes = 32): TokenPair {
  const token = randomBytes(bytes).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

/** Expiry `Date` `hours` from now. */
export function expiryFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
