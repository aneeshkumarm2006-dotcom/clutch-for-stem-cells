/**
 * Brute-force throttle for the staff sign-in (`authorize` in lib/auth/options).
 *
 * NextAuth owns `/api/auth/callback/credentials`, so this can't live in a route
 * handler like the other guards — it hooks into `authorize` instead.
 *
 * Counts **failures only**, across three buckets:
 *
 *   ip:<addr>       10 / 15 min   one machine guessing
 *   net:<subnet>    30 / 15 min   a rented /24 or /48 spreading the guesses
 *   acct:<email>    10 / 60 min   one account targeted from many addresses
 *
 * A successful sign-in clears all three, so a colleague who mistypes twice and
 * then gets in hasn't spent anything. Everything fails **open**: if Upstash is
 * unreachable the sign-in proceeds, because locking staff out of the admin
 * during a Redis blip is worse than the attempt it would have blocked.
 *
 * Note the account bucket keys on the submitted email whether or not that email
 * exists — checking existence first would leak which addresses are registered,
 * which `authorize` deliberately avoids.
 */
import { getClientIp, subnetKey } from "@/lib/net";
import { bumpCounter, clearCounters, peekCounter } from "@/lib/rate-limit";

const IP_LIMIT = 10;
const NET_LIMIT = 30;
const ACCOUNT_LIMIT = 10;

const SHORT_WINDOW = 15 * 60; // seconds
const ACCOUNT_WINDOW = 60 * 60; // seconds

/**
 * NextAuth hands `authorize` a `RequestInternal`, whose `headers` is a plain
 * object rather than a `Headers` instance. Adapt it to the shape `lib/net`
 * expects instead of duplicating the header precedence rules.
 */
export function ipFromAuthRequest(req: unknown): string {
  const headers = (req as { headers?: Record<string, string | undefined> })
    ?.headers;
  if (!headers) return "unknown";
  return getClientIp({
    get: (name: string) => headers[name] ?? headers[name.toLowerCase()] ?? null,
  } as never);
}

/** The counter keys an attempt from `ip` for `email` touches. */
function keysFor(ip: string, email: string): Array<[string, number, number]> {
  const keys: Array<[string, number, number]> = [
    [`login-fail:ip:${ip}`, IP_LIMIT, SHORT_WINDOW],
    [`login-fail:acct:${email.toLowerCase()}`, ACCOUNT_LIMIT, ACCOUNT_WINDOW],
  ];
  const net = subnetKey(ip);
  if (net) keys.push([`login-fail:net:${net}`, NET_LIMIT, SHORT_WINDOW]);
  return keys;
}

/** True when this attempt should be refused outright. Never throws. */
export async function throttleLogin(
  ip: string,
  email: string,
): Promise<boolean> {
  const keys = keysFor(ip, email);
  const states = await Promise.all(keys.map(([key]) => peekCounter(key)));
  return states.some((state, i) => state.count >= keys[i]![1]);
}

/** Record one failed attempt against every bucket. Never throws. */
export async function recordLoginFailure(
  ip: string,
  email: string,
): Promise<void> {
  await Promise.all(
    keysFor(ip, email).map(([key, , window]) => bumpCounter(key, window)),
  );
}

/** Wipe the buckets after a successful sign-in. Never throws. */
export async function clearLoginFailures(
  ip: string,
  email: string,
): Promise<void> {
  await clearCounters(keysFor(ip, email).map(([key]) => key));
}
