import { safeReturnTo } from "@/lib/return-to";

/**
 * ADR-0041 F1 (bug found by security-engineer's gate, 2026-09-29): `next`
 * arrives at `/auth/confirm` as the ABSOLUTE URL that `signUpWithPassword()`
 * builds for Supabase's `emailRedirectTo` --
 * `${siteUrl()}/auth/callback?next=<returnTo>` -- because the confirmation
 * email template embeds it verbatim as `next={{ .RedirectTo }}`. Handed to
 * `safeReturnTo()` as-is, that absolute URL fails the "must start with /"
 * check and silently falls back to `/dashboard`, dropping `returnTo` --
 * including ADR-0015's booking intent and ADR-0040's `?c=<nonce>` -- for
 * every password signup, not just customer activation.
 *
 * Fix: unwrap ONLY that exact shape -- an absolute URL, same origin as this
 * app, path exactly `/auth/callback` -- and take ITS inner `next` (already
 * relative) instead. Anything else (another origin, another path, already
 * relative, empty/invalid) is left untouched and handed to `safeReturnTo()`
 * unchanged -- today's behaviour, and what still serves an old-style PKCE
 * confirmation link (`next` already relative) still sitting in someone's
 * inbox during the ADR-0041 rollout.
 *
 * The absolute URL is only ever parsed to read one query param off it, then
 * discarded -- it is never followed, and never reaches a redirect.
 */
export function unwrapConfirmNext(raw: string | null | undefined, origin: string): string {
  let inner: string | null = null;

  try {
    const u = new URL(raw ?? "");
    if (u.origin === new URL(origin).origin && u.pathname === "/auth/callback") {
      inner = u.searchParams.get("next");
    }
  } catch {
    // `raw` isn't an absolute URL (relative, empty, or malformed): leave it
    // alone and let safeReturnTo() handle it exactly as it does today.
  }

  return safeReturnTo(inner ?? raw);
}
