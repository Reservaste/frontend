import { describe, expect, it } from "vitest";
import { expiresInLabel, isOpenInvitation, TEAM_INVITATION_STATUS } from "./team-invitation-status";

describe("team invitation status copy", () => {
  it("treats an expired link as a warning, not an error", () => {
    expect(TEAM_INVITATION_STATUS.EXPIRED.tone).toBe("warning");
  });

  it("only offers actions on invitations nobody used or cancelled", () => {
    expect(isOpenInvitation("PENDING")).toBe(true);
    expect(isOpenInvitation("EXPIRED")).toBe(true);
    expect(isOpenInvitation("REVOKED")).toBe(false);
    expect(isOpenInvitation("REDEEMED")).toBe(false);
  });
});

describe("expiresInLabel", () => {
  const now = Date.parse("2026-09-24T12:00:00Z");

  it("counts whole hours left", () => {
    expect(expiresInLabel("2026-09-25T11:30:00Z", now)).toBe("vence en 23 h");
  });

  it("never says 'en 0 h'", () => {
    expect(expiresInLabel("2026-09-24T12:40:00Z", now)).toBe("vence en menos de 1 h");
  });

  it("says it expired once the time is up", () => {
    expect(expiresInLabel("2026-09-24T11:00:00Z", now)).toBe("vencida");
  });
});
