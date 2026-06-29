/**
 * Password hashing — Stage 2.1.
 *
 * bcryptjs (pure-JS) so it builds the same on Windows dev and the Vercel
 * serverless runtime without native bindings. Hashes live in `User.passwordHash`
 * (`select: false`) and never leave the server.
 */
import bcrypt from "bcryptjs";

/** Work factor — 12 rounds balances cost and serverless cold-start latency. */
const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
