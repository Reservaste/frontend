import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/site-url";
import { TEAM_INVITATION_COOKIE_NAME, teamInvitationCookieOptions } from "@/lib/team-invitation-cookie";

/**
 * ADR-0034: a calque of `/activar/[token]`, for the same reasons (written
 * out in that handler and still valid here):
 *
 * - This is the one place the token may sit in a URL -- it *is* the
 *   WhatsApp link. From here on it only moves in an httpOnly cookie.
 * - `no-store` / `no-referrer` / `noindex`, so the token never lands in a
 *   shared cache, a Referer header or a search index.
 * - **The GET never touches the database.** WhatsApp fetches every shared
 *   link to build its preview card before the person taps it; anything
 *   consumed here would be consumed by that crawler. The redemption is a
 *   POST (server action) behind an explicit "Aceptar".
 * - The cookie lives as long as the token (24h) -- see
 *   lib/team-invitation-cookie.ts. Its own name and path, so a customer
 *   activation link in flight is never overwritten.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const response = NextResponse.redirect(`${siteUrl()}/equipo/continuar`, { status: 303 });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex");

  response.cookies.set(TEAM_INVITATION_COOKIE_NAME, token, teamInvitationCookieOptions());

  return response;
}
