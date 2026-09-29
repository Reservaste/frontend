import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// ADR-0040: the ?c=<nonce> continuation param is, for its 30-min life,
// equivalent to the activation token itself (ADR-0026 Sec 2.4's own threat
// model -- see docs/decisions.md ADR-0040 "Corrección post-review de
// seguridad"). It can arrive as a bare param on /activar/continuar, or
// embedded inside `returnTo` on /login and /signup (its whole trip through
// emailRedirectTo/OAuth `next` is as a substring of that value) -- so both
// shapes are checked. Caddy's global `?Referrer-Policy` only fills in a
// default when the app hasn't already sent one (see deploy/Caddyfile), so
// setting it here on these three routes -- and only when `?c=` is actually
// present -- doesn't touch the header on any other request.
const NO_REFERRER_PATHS = new Set(["/activar/continuar", "/login", "/signup"]);

function carriesActivationContinuationNonce(url: URL): boolean {
  if (url.searchParams.has("c")) return true;

  const returnTo = url.searchParams.get("returnTo");
  if (!returnTo) return false;

  try {
    return new URL(returnTo, "http://internal").searchParams.has("c");
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);

  if (
    NO_REFERRER_PATHS.has(request.nextUrl.pathname) &&
    carriesActivationContinuationNonce(request.nextUrl)
  ) {
    response.headers.set("Referrer-Policy", "no-referrer");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
