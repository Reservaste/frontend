import { headers } from "next/headers";

// Best-effort per-visitor rate limiting for anonymous server actions that
// relay a write to a Supabase RPC (see app/actions/contact.ts).
//
// Why this exists in addition to the RPC's own rate limit: the RPC's
// `origin_ip` dimension is whatever IP Supabase sees, which for traffic
// relayed through a Next.js server action is always the droplet's own IP
// (ADR-0021), not the visitor's. That makes the RPC's per-origin bucket a
// single shared bucket for *all* legitimate visitors of this site -- five
// submits from anyone exhausts it for everyone else for the rest of the
// window. This module adds a second limiter, keyed by the visitor's real
// IP as seen by Next.js (one hop behind Caddy), so individual visitors are
// distinguishable even though Supabase can't tell them apart. It
// complements the RPC's limiter, it doesn't replace it (docs/security.md).
//
// State lives in a module-level Map on purpose: this deploy is a single
// long-running droplet process, never serverless (ADR-0021), so a Map here
// actually persists for as long as it needs to. Known, accepted
// limitations: it resets on process restart/redeploy, and it would
// under-count if this ever moved to multiple app instances. Neither is a
// concern at current volume (single droplet, single client).

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
}

/**
 * Sliding-window limiter: allows at most `limit` calls per `windowMs` for a
 * given `key`. Callers choose the key (e.g. `"contact:" + ip`) so unrelated
 * limiters never collide in the same Map.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;
  const existing = buckets.get(key)?.timestamps ?? [];
  const recent = existing.filter((timestamp) => timestamp > windowStart);

  if (recent.length >= limit) {
    buckets.set(key, { timestamps: recent });
    return { allowed: false };
  }

  recent.push(now);
  buckets.set(key, { timestamps: recent });
  return { allowed: true };
}

/**
 * Best-effort real visitor IP for this deploy (ADR-0021: Caddy is the only
 * reverse proxy, directly facing the internet, in front of a single Next.js
 * process). Caddy's `reverse_proxy` appends the TCP peer address to
 * `X-Forwarded-For` automatically; because nothing sits in front of Caddy,
 * a visitor can prepend fake entries to that header but never control the
 * last one, so the last entry is the one to trust (same pattern already
 * used for `x-real-ip`/`x-forwarded-for` in the RPC itself, see
 * docs/security.md).
 *
 * Returns `null` if no usable IP header is present -- callers must treat
 * that as "can't identify this visitor" and skip the local limit rather
 * than block them, since the RPC's own limit still applies as a backstop.
 */
export async function getVisitorIp(): Promise<string | null> {
  const headerList = await headers();

  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) {
    const hops = forwardedFor
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    const lastHop = hops.at(-1);
    if (lastHop) return lastHop;
  }

  const realIp = headerList.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return null;
}
