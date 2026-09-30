import { NextResponse } from "next/server";
import type { createClient } from "@/lib/supabase/server";
import { safeReturnTo } from "@/lib/return-to";
import { ACTIVATION_COOKIE_NAME, activationCookieOptions } from "@/lib/activation-cookie";

export interface ActivationContinuationResult {
  /**
   * `next`, with `?c=` stripped and re-validated through `safeReturnTo`.
   * Always safe to append to `origin` and redirect to, whether or not a
   * nonce was present.
   */
  destination: string;
  /**
   * Set only when a nonce was present in `next` AND it redeemed
   * successfully: a ready-to-return redirect response, with the
   * `activation_token` cookie already planted and `Cache-Control: no-store`
   * set. Callers must return this response as-is instead of building their
   * own -- constructing a second redirect would drop the Set-Cookie.
   */
  response?: NextResponse;
}

/**
 * ADR-0040: `next` can carry a `?c=<nonce>` continuation param, minted by
 * `/activar/continuar` when the activation cookie survived in THIS context
 * but no session did. It travels embedded inside `next` (never as a
 * sibling query param of the caller's route, and never read from
 * `request.url` directly) precisely because `next` is the one thing every
 * hop in this chain -- login-form -> /signup -> emailRedirectTo/OAuth `next`
 * -- already forwards untouched end to end. Stripped here regardless of
 * outcome: it must never reach the final redirect URL, success or failure.
 *
 * ADR-0041 factored this logic out of `/auth/callback/route.ts` so it could
 * be shared with `/auth/confirm/route.ts` (the email-confirmation
 * `verifyOtp({ token_hash })` path). ADR-0043 removed `/auth/confirm`
 * entirely -- "Confirm email" is disabled, so no email/link exists to
 * confirm -- leaving `/auth/callback` (Google OAuth) as this function's only
 * caller. The mechanism itself is unchanged: OAuth still leaves WhatsApp's
 * embedded WebView for a real browser, the same context switch ADR-0040
 * introduced the nonce for. This is called only *after* the caller has
 * already established a session in the current browser context, which is
 * the precondition this function assumes.
 *
 * Callers must invoke this with the ALREADY safeReturnTo'd `next` (defence
 * in depth, same rule as every other returnTo hop) and their own `origin`
 * (never `request.url`'s origin -- see `lib/site-url.ts`).
 */
export async function redeemActivationContinuationIfPresent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  next: string,
  origin: string,
): Promise<ActivationContinuationResult> {
  const nextUrl = new URL(next, origin);
  const nonce = nextUrl.searchParams.get("c");
  nextUrl.searchParams.delete("c");
  // Re-validated after the round trip through URL: WHATWG dot-segment
  // normalisation can turn an allowed `next` like "/a/..//evil.com" into a
  // pathname of "//evil.com". Harmless today only because it is always
  // string-prefixed with `origin` by the caller -- this keeps it harmless
  // if that line is ever refactored to `new URL(destination, origin)`.
  const destination = safeReturnTo(`${nextUrl.pathname}${nextUrl.search}`);

  if (!nonce) {
    return { destination };
  }

  // Never logged, on purpose: for its 30-min life the nonce is equivalent
  // to the activation token itself (ADR-0040 "Corrección post-review de
  // seguridad") -- same rule that already keeps the token itself out of
  // every log on this path.
  const { data: token, error: redeemError } = await supabase.rpc(
    "redeem_activation_continuation",
    { p_nonce: nonce },
  );

  if (redeemError || !token) {
    // Invalid/expired/already-used nonce: not an error for the rest of
    // login. Fall through as if `?c=` had never been there --
    // /activar/continuar already knows how to say "no encontramos la
    // invitación en este navegador" when the cookie is missing.
    return { destination };
  }

  const response = NextResponse.redirect(`${origin}${destination}`);
  // Carries the activation token in Set-Cookie: never cacheable, same
  // header /activar/[token]/route.ts sends for the same reason.
  response.headers.set("Cache-Control", "no-store");
  // Same cookie, same attributes as /activar/[token]/route.ts -- this is
  // a second (now third) place planting it, not a new policy for it.
  response.cookies.set(ACTIVATION_COOKIE_NAME, token as string, activationCookieOptions());
  return { destination, response };
}
