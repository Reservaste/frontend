import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeReturnTo } from "@/lib/return-to";

/** Handles the redirect back from Supabase Auth (Google OAuth, email confirmation links). */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Validated even though it is re-prefixed with our own origin below:
  // defence in depth, and the same rule as every other returnTo hop.
  const next = safeReturnTo(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=No se pudo completar el inicio de sesión`);
}
