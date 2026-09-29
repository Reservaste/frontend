import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";
import { redeemActivationContinuationIfPresent } from "@/lib/activation-continuation";
import { unwrapConfirmNext } from "@/lib/confirm-next";

/**
 * ADR-0041: handles Supabase Auth's email confirmation link, `token_hash`-
 * based instead of the PKCE `code` that `/auth/callback` still handles for
 * Google OAuth. `exchangeCodeForSession(code)` (PKCE) needs the
 * `code_verifier` cookie planted by the browser that started the signup --
 * a link opened from Mail, or from a different browser than the one used
 * to sign up (the actual shape of an email confirmation link: tap a
 * WhatsApp/email link from wherever the mail client happens to open it),
 * never has that cookie, and the exchange fails before anything else runs.
 * `verifyOtp({ token_hash })` carries everything it needs in the link
 * itself, so it works from any browser/app that opens it.
 *
 * The email template Supabase Auth sends controls `type` -- confirmed by
 * backend-engineer live against local Supabase (real signup, real link in
 * Mailpit, real `/auth/v1/verify` redemption) to be literally `"email"`,
 * matching the ADR-0041 draft, and confirmed independently here too
 * (`verifyOtp({ token_hash, type: "email" })` against a `token_hash` minted
 * via the admin `generate_link` API for a real local signup). ADR-0041 F3:
 * the confirmation template is the only one that points here, and it always
 * sends `type=email` -- restricted to that literal value instead of
 * forwarding whatever `EmailOtpType` the query string carries, which would
 * otherwise turn this route into a generic OTP verifier for `recovery`,
 * `magiclink`, `email_change` or `invite` links too.
 *
 * ADR-0041 F1: `next` arrives here as the ABSOLUTE `emailRedirectTo` the
 * template embeds (`next={{ .RedirectTo }}`), not a bare returnTo --
 * `unwrapConfirmNext()` peels that back to the inner relative `next` before
 * it reaches `safeReturnTo()`. See `lib/confirm-next.ts`.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Not request.url's origin: behind the proxy that is the container's
  // internal address. See lib/site-url.ts.
  const origin = siteUrl();
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const type: EmailOtpType | null = rawType === "email" ? rawType : null;
  const next = unwrapConfirmNext(searchParams.get("next"), origin);

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      const { destination, response } = await redeemActivationContinuationIfPresent(
        supabase,
        next,
        origin,
      );
      return response ?? NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=No se pudo completar el inicio de sesión`);
}
