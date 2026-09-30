import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeReturnTo } from "@/lib/return-to";
import { siteUrl } from "@/lib/site-url";
import { redeemActivationContinuationIfPresent } from "@/lib/activation-continuation";

/**
 * Handles the redirect back from Supabase Auth's PKCE code exchange for
 * Google OAuth. This used to also handle email confirmation links before
 * ADR-0041 moved those to `/auth/confirm` (`verifyOtp({ token_hash })`,
 * since PKCE needs the `code_verifier` cookie from the browser that started
 * the flow, which a link opened from Mail/WhatsApp in a different browser
 * never has) -- and ADR-0043 removed `/auth/confirm` altogether along with
 * email confirmation itself, leaving OAuth as the only thing this route
 * handles.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Not request.url's origin: behind the proxy that is the container's
  // internal address. See lib/site-url.ts.
  const origin = siteUrl();
  const code = searchParams.get("code");
  // Validated even though it is re-prefixed with our own origin below:
  // defence in depth, and the same rule as every other returnTo hop.
  const next = safeReturnTo(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
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
