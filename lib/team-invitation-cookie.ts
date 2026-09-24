/**
 * ADR-0034: the team-invitation token travels in a URL exactly once -- the
 * WhatsApp link itself -- and from then on lives only in this cookie:
 * httpOnly, Secure, never in client JS, never logged. Same design as the
 * customer activation cookie (`lib/activation-cookie.ts`), with its own
 * name, path and TTL on purpose.
 *
 * **Its own cookie, not `activation_token`.** Someone can be a customer of
 * the business *and* have been invited to its team (the receptionist who
 * also trains there is the normal case, not the rare one). If both flows
 * shared a cookie, one token would overwrite the other, and the clear token
 * cannot be recovered from the database -- only its SHA-256 is stored.
 *
 * **Its lifetime is the token's lifetime.** This is the lesson that broke
 * the customer flow in production (hotfix 2026-09-23): the cookie is the
 * only copy of the token the person has, and the normal path is open link
 * -> /login -> /signup -> confirm email -> come back, which routinely takes
 * far longer than a few minutes. The invariant:
 *
 *     the cookie must never expire before the token can.
 *
 * `TEAM_INVITATION_TOKEN_TTL_SECONDS` mirrors `interval '24 hours'` in
 * `issue_team_invitation()` (migration phase33, ADR-0034 resolution 3);
 * `backend/test/phase33.team-invitations.test.ts` pins the SQL side.
 */
export const TEAM_INVITATION_COOKIE_NAME = "team_invitation_token";

/** Must equal the TTL in `issue_team_invitation()`. See above. */
export const TEAM_INVITATION_TOKEN_TTL_SECONDS = 24 * 60 * 60;

/**
 * Scoped to the team flow: `/equipo/[token]` writes it and
 * `/equipo/continuar` (plus the server actions posted from it) reads it.
 * Never sent with any other request, and never collides with
 * `/activar`'s cookie.
 */
export const TEAM_INVITATION_COOKIE_PATH = "/equipo";

export interface TeamInvitationCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
}

/**
 * `sameSite: "lax"`, not "strict": the person arrives from WhatsApp and may
 * come back through an OAuth redirect -- both cross-site top-level
 * navigations, which "strict" would drop.
 */
export function teamInvitationCookieOptions(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): TeamInvitationCookieOptions {
  return {
    httpOnly: true,
    secure: nodeEnv === "production",
    sameSite: "lax",
    path: TEAM_INVITATION_COOKIE_PATH,
    maxAge: TEAM_INVITATION_TOKEN_TTL_SECONDS,
  };
}

/**
 * Clearing has to repeat the path: `cookies().delete(name)` targets the
 * cookie at path "/", which is a *different* cookie, and the token would
 * survive its own redemption.
 */
export function teamInvitationCookieClearOptions(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): TeamInvitationCookieOptions {
  return { ...teamInvitationCookieOptions(nodeEnv), maxAge: 0 };
}
