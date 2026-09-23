/**
 * ADR-0026 Sec 2.4: the activation token travels in a URL exactly once --
 * the WhatsApp link itself -- and from that moment on it lives only in
 * this cookie: httpOnly, Secure, never in client JS, never logged.
 *
 * That design has one consequence that has to be stated out loud, because
 * getting it wrong is what broke the flow in production: **this cookie is
 * the only copy of the token the person has.** The clear token cannot be
 * recovered from the database (only its SHA-256 is stored), so if the
 * cookie dies before the person finishes authenticating, a perfectly
 * valid 72h link is gone as far as they are concerned -- and the
 * confirmation screen, seeing no cookie, tells them it "expired".
 *
 * And authenticating is not a detour we can skip: ADR-0026 exists
 * precisely for the customer who has *no account yet*, so the normal path
 * is open link -> /login -> /signup -> confirm email -> come back. That
 * round trip routinely takes far longer than a few minutes.
 *
 * Hence the invariant this module exists to hold:
 *
 *     the cookie must never expire before the token can.
 *
 * `ACTIVATION_TOKEN_TTL_SECONDS` mirrors `interval '72 hours'` in
 * `issue_customer_activation()` (migration 20260922190000, ADR-0026
 * resolution 8). Since the cookie is only written when the person opens
 * the link -- at most 72h after the token was issued -- giving it the full
 * token TTL guarantees the database is always the thing that decides
 * whether a link is still good. `backend/test/phase21.managed-customers.test.ts`
 * pins the SQL side to the same 72h so the two cannot drift apart in
 * silence.
 */
export const ACTIVATION_COOKIE_NAME = "activation_token";

/** Must equal the TTL in `issue_customer_activation()`. See above. */
export const ACTIVATION_TOKEN_TTL_SECONDS = 72 * 60 * 60;

/**
 * Scoped to the activation flow: the token is never needed anywhere else,
 * so it is not sent with every request to the rest of the site. Both
 * `/activar/[token]` (which writes it) and `/activar/continuar` (which
 * reads it, and the server actions posted from it) live under this path.
 */
export const ACTIVATION_COOKIE_PATH = "/activar";

export interface ActivationCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
}

/**
 * `sameSite: "lax"` and not "strict": the person arrives from WhatsApp,
 * and after logging in they may come back through an OAuth redirect --
 * both are cross-site top-level navigations, which "strict" would drop.
 */
export function activationCookieOptions(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): ActivationCookieOptions {
  return {
    httpOnly: true,
    secure: nodeEnv === "production",
    sameSite: "lax",
    path: ACTIVATION_COOKIE_PATH,
    maxAge: ACTIVATION_TOKEN_TTL_SECONDS,
  };
}

/**
 * Clearing has to repeat the path. `cookies().delete("name")` (and
 * `Set-Cookie` with no Path) targets the cookie at path "/", which is a
 * *different* cookie from this one -- so the token would quietly survive
 * a successful activation instead of being dropped.
 */
export function activationCookieClearOptions(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): ActivationCookieOptions {
  return { ...activationCookieOptions(nodeEnv), maxAge: 0 };
}
