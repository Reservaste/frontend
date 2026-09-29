import { describe, expect, it } from "vitest";
import { unwrapConfirmNext } from "./confirm-next";

const ORIGIN = "https://reservaste.test";

// ADR-0041 F1: the confirmation email template hands /auth/confirm the
// ABSOLUTE emailRedirectTo (`${siteUrl()}/auth/callback?next=<returnTo>`),
// not a bare returnTo. These are the shapes that actually reach this route.

describe("unwrapConfirmNext", () => {
  it("unwraps next when it is /auth/callback on our own origin", () => {
    const raw = `${ORIGIN}/auth/callback?next=%2Factivar%2Fcontinuar`;
    expect(unwrapConfirmNext(raw, ORIGIN)).toBe("/activar/continuar");
  });

  it("unwraps the exact real-world shape, nonce and all", () => {
    // Decoded inner next: /activar/continuar?c=abc123nonce -- matches the
    // real mail captured in Mailpit during the ADR-0041 verification.
    const inner = "/activar/continuar?c=abc123nonce";
    const raw = `${ORIGIN}/auth/callback?next=${encodeURIComponent(inner)}`;
    expect(unwrapConfirmNext(raw, ORIGIN)).toBe(inner);
  });

  it("does not unwrap an absolute URL on another origin", () => {
    const raw = "https://evil.example/auth/callback?next=%2Fdashboard";
    // Not unwrapped: the whole absolute URL is handed to safeReturnTo(),
    // which rejects it (doesn't start with "/") and falls back.
    expect(unwrapConfirmNext(raw, ORIGIN)).toBe("/dashboard");
  });

  it("does not unwrap an absolute URL on our origin but a different path", () => {
    const raw = `${ORIGIN}/auth/confirm?next=%2Fdashboard`;
    expect(unwrapConfirmNext(raw, ORIGIN)).toBe("/dashboard");
  });

  it("leaves an already-relative next untouched (old PKCE-era links)", () => {
    expect(unwrapConfirmNext("/activar/continuar?c=abc123nonce", ORIGIN)).toBe(
      "/activar/continuar?c=abc123nonce",
    );
    expect(unwrapConfirmNext("/iron-gym/reservar/confirmar?slot=abc-123", ORIGIN)).toBe(
      "/iron-gym/reservar/confirmar?slot=abc-123",
    );
  });

  it("falls back when next is missing or empty, same as safeReturnTo alone", () => {
    expect(unwrapConfirmNext(null, ORIGIN)).toBe("/dashboard");
    expect(unwrapConfirmNext(undefined, ORIGIN)).toBe("/dashboard");
    expect(unwrapConfirmNext("", ORIGIN)).toBe("/dashboard");
  });

  it("never follows the absolute URL -- an open-redirect payload as the inner next is still rejected", () => {
    const raw = `${ORIGIN}/auth/callback?next=${encodeURIComponent("https://evil.example")}`;
    expect(unwrapConfirmNext(raw, ORIGIN)).toBe("/dashboard");
  });
});
