import { describe, expect, it } from "vitest";
import {
  TEAM_INVITATION_COOKIE_NAME,
  TEAM_INVITATION_COOKIE_PATH,
  TEAM_INVITATION_TOKEN_TTL_SECONDS,
  teamInvitationCookieClearOptions,
  teamInvitationCookieOptions,
} from "./team-invitation-cookie";
import { ACTIVATION_COOKIE_NAME, ACTIVATION_COOKIE_PATH } from "./activation-cookie";

describe("team invitation cookie policy (ADR-0034)", () => {
  it("is unreachable from client JS and scoped to the team flow", () => {
    const options = teamInvitationCookieOptions("production");

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe(TEAM_INVITATION_COOKIE_PATH);
    expect(TEAM_INVITATION_COOKIE_PATH).toBe("/equipo");
  });

  it("never shares name or path with the customer activation cookie", () => {
    // A customer who is also invited to the team must keep both tokens.
    expect(TEAM_INVITATION_COOKIE_NAME).not.toBe(ACTIVATION_COOKIE_NAME);
    expect(TEAM_INVITATION_COOKIE_PATH).not.toBe(ACTIVATION_COOKIE_PATH);
  });

  it("only travels over TLS in production", () => {
    expect(teamInvitationCookieOptions("production").secure).toBe(true);
    expect(teamInvitationCookieOptions("development").secure).toBe(false);
  });

  it("never expires before the token can (24h, ADR-0034 resolution 3)", () => {
    expect(TEAM_INVITATION_TOKEN_TTL_SECONDS).toBe(24 * 60 * 60);
    expect(teamInvitationCookieOptions("production").maxAge).toBeGreaterThanOrEqual(
      TEAM_INVITATION_TOKEN_TTL_SECONDS,
    );
  });

  it("clears the cookie at its own path, not at /", () => {
    const clear = teamInvitationCookieClearOptions("production");

    expect(clear.path).toBe(TEAM_INVITATION_COOKIE_PATH);
    expect(clear.maxAge).toBe(0);
    expect(clear.httpOnly).toBe(true);
    expect(clear.secure).toBe(true);
  });

  it("keeps the cookie name the server actions read", () => {
    expect(TEAM_INVITATION_COOKIE_NAME).toBe("team_invitation_token");
  });
});
