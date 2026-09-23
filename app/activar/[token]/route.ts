import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/site-url";
import { ACTIVATION_COOKIE_NAME, activationCookieOptions } from "@/lib/activation-cookie";

/**
 * ADR-0026 Sec 2.4: the token is a secret, unlike ADR-0015's booking
 * intent (which travels unsigned in plain query params because it is
 * already public data). This is the one and only place the token is
 * allowed to sit in a URL -- it is the WhatsApp link itself, unavoidable.
 * From here on it moves through an httpOnly, Secure cookie, never through
 * a URL, never through client JS, never logged.
 *
 * `Cache-Control: no-store` and `Referrer-Policy: no-referrer` matter more
 * here than on a normal page: without them the token could end up in a
 * shared cache, or leak via the Referer header to any third-party
 * resource this page happens to load.
 *
 * This GET deliberately does not touch the database: it hands the token
 * over and redirects. WhatsApp (and every other chat client) fetches a
 * shared link to build its preview card before the person taps it, so
 * anything consumed here would be consumed by a crawler, and the human's
 * "first" click would find the link already used.
 *
 * The cookie's lifetime is the token's lifetime, not an arbitrary short
 * window -- see lib/activation-cookie.ts for why that is the whole ball
 * game in this flow.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const response = NextResponse.redirect(`${siteUrl()}/activar/continuar`, { status: 303 });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex");

  response.cookies.set(ACTIVATION_COOKIE_NAME, token, activationCookieOptions());

  return response;
}
