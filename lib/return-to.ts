/**
 * ADR-0015: the booking intent itself travels in plain query params and
 * is re-validated server-side on submit, so it needs no signing. The
 * real risk in this flow is the *destination*: a `returnTo` pointing at
 * another host would turn our login page into a phishing hop, landing
 * someone on an attacker's site right after they typed their password.
 *
 * So returnTo is validated as a destination, not as content: it must be
 * a path on this site and nothing else. Anything suspicious falls back
 * to a safe default rather than being "cleaned up" -- a rewrite-and-hope
 * approach is how these checks usually get bypassed.
 */
const SAFE_PATH = /^\/[A-Za-z0-9\-._~!$&'()*+,;=:@/?%]*$/;

export function safeReturnTo(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;

  // Must be site-relative: one leading slash, no scheme, no host.
  if (!raw.startsWith("/")) return fallback;
  // "//evil.com" is a protocol-relative URL -- a path to the browser's
  // parser only until it isn't.
  if (raw.startsWith("//")) return fallback;
  // Backslashes are normalised to slashes by some browsers, so "/\evil.com"
  // can escape the origin too.
  if (raw.includes("\\")) return fallback;
  if (!SAFE_PATH.test(raw)) return fallback;

  return raw;
}
