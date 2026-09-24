import { describe, expect, it } from "vitest";
import { buildWhatsAppTeamInvitationLink } from "./whatsapp-team-invitation-link";

describe("buildWhatsAppTeamInvitationLink", () => {
  const url = buildWhatsAppTeamInvitationLink({
    phone: "+598 99 123 456",
    organizationName: "Estudio Norte",
    invitationUrl: "https://reservaste.test/equipo/abc",
  });
  const parsed = new URL(url);

  it("targets api.whatsapp.com with the phone as bare digits", () => {
    expect(parsed.origin).toBe("https://api.whatsapp.com");
    expect(parsed.searchParams.get("phone")).toBe("59899123456");
  });

  it("names the organization and carries the invitation link", () => {
    const text = parsed.searchParams.get("text") ?? "";
    expect(text).toContain("Estudio Norte");
    expect(text).toContain("https://reservaste.test/equipo/abc");
    expect(text).toContain("equipo");
  });

  it("has no slot for the invited person's name or email", () => {
    // The builder does not accept them at all: a mistyped number must not
    // learn who was invited (docs/security.md, Fase 33).
    const text = parsed.searchParams.get("text") ?? "";
    expect(text).not.toMatch(/@/);
  });
});
