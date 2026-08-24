/**
 * Client-IP and network-neighbourhood helpers.
 *
 * A per-address cap is free to evade: rent a /24 and every request arrives from
 * a "different" IP. Capping the *neighbourhood* as well is what makes rotation
 * cost money, so every abuse limit in this codebase keys on both the address
 * and its subnet (/24 for IPv4, /48 for IPv6).
 *
 * Pure and dependency-free so tests can call it directly.
 */

/** Header order Vercel/most proxies populate, most specific first. */
const IP_HEADERS = ["x-forwarded-for", "x-real-ip", "x-vercel-forwarded-for"];

/**
 * Best-effort client IP from proxy headers. Returns `"unknown"` when nothing
 * usable is present — callers key on that string rather than skipping the limit,
 * so header-stripped traffic shares one bucket instead of bypassing the cap.
 */
export function getClientIp(req: {
  headers: { get(name: string): string | null };
}): string {
  for (const header of IP_HEADERS) {
    const raw = req.headers.get(header);
    if (!raw) continue;
    // `x-forwarded-for` is a client→proxy chain; the client is leftmost.
    const first = raw.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }
  return "unknown";
}

/**
 * Strip a port and IPv6 brackets, lowercase, and unwrap IPv4-mapped IPv6
 * (`::ffff:1.2.3.4` → `1.2.3.4`) so one client can't occupy two buckets.
 */
export function normalizeIp(raw: string): string {
  let ip = raw.trim();
  if (!ip) return "unknown";

  // `[2001:db8::1]:443` → `2001:db8::1`
  if (ip.startsWith("[")) {
    const close = ip.indexOf("]");
    if (close > 0) ip = ip.slice(1, close);
  } else if (ip.includes(".") && ip.includes(":")) {
    // `1.2.3.4:5678` → `1.2.3.4` (a bare IPv6 has many colons and no dot).
    const colon = ip.lastIndexOf(":");
    if (!ip.slice(0, colon).includes(":")) ip = ip.slice(0, colon);
  }

  ip = ip.toLowerCase();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  if (mapped) return mapped[1]!;
  return ip;
}

/** True for a dotted-quad IPv4 literal with every octet in range. */
export function isIpv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

/**
 * The rate-limit key for an address's network neighbourhood: `/24` for IPv4,
 * `/48` for IPv6. Returns `null` when `ip` isn't a recognisable address (the
 * caller then limits on the address alone rather than inventing a bucket).
 */
export function subnetKey(ip: string): string | null {
  const addr = normalizeIp(ip);
  if (addr === "unknown") return null;

  if (isIpv4(addr)) {
    const [a, b, c] = addr.split(".");
    return `${a}.${b}.${c}.0/24`;
  }

  if (addr.includes(":")) {
    // A /48 is the first three hextets. `::` expands to zeroes, and since we
    // only need a prefix, an abbreviated address is padded rather than fully
    // expanded — `2001:db8::1` and `2001:0db8:0000::1` must land in one bucket.
    const [head] = addr.split("%"); // drop any zone id
    const expanded = expandIpv6Prefix(head!);
    if (!expanded) return null;
    return `${expanded}::/48`;
  }

  return null;
}

/** First three hextets of an IPv6 address, zero-padded and `::`-aware. */
function expandIpv6Prefix(addr: string): string | null {
  const doubleColon = addr.indexOf("::");
  let head: string[];

  if (doubleColon === -1) {
    head = addr.split(":");
  } else {
    const left = addr.slice(0, doubleColon).split(":").filter(Boolean);
    const right = addr.slice(doubleColon + 2).split(":").filter(Boolean);
    const zeroes = Math.max(0, 8 - left.length - right.length);
    head = [...left, ...Array<string>(zeroes).fill("0"), ...right];
  }

  const first3 = head.slice(0, 3);
  if (first3.length < 3) return null;
  if (!first3.every((h) => /^[0-9a-f]{1,4}$/.test(h))) return null;
  return first3.map((h) => h.padStart(4, "0")).join(":");
}
