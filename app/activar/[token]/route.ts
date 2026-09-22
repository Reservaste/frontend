import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/site-url";

/**
 * ADR-0026 Sec 2.4: the token is a secret, unlike ADR-0015's booking
 * intent (which travels unsigned in plain query params because it is
 * already public data). This is the one and only place the token is
 * allowed to sit in a URL -- it is the WhatsApp link itself, unavoidable.
 * From here on it moves through a short-lived, httpOnly, Secure cookie,
 * never through a URL, never through client JS, never logged.
 *
 * `Cache-Control: no-store` and `Referrer-Policy: no-referrer` matter more
 * here than on a normal page: without them the token could end up in a
 * shared cache, or leak via the Referer header to any third-party
 * resource this page happens to load.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const response = NextResponse.redirect(`${siteUrl()}/activar/continuar`, { status: 303 });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex");

  response.cookies.set("activation_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/activar",
    maxAge: 60 * 15,
  });

  return response;
}
