import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./return-to";

// ADR-0015: returnTo is the one part of the booking-intent flow that is a
// real security boundary (the intent itself is re-validated server-side
// anyway). These are the shapes an open-redirect attempt actually takes.

describe("safeReturnTo", () => {
  it("keeps a normal site-relative path, query string and all", () => {
    expect(safeReturnTo("/iron-gym/reservar/confirmar?slot=abc-123")).toBe(
      "/iron-gym/reservar/confirmar?slot=abc-123",
    );
  });

  it("falls back when nothing was provided", () => {
    expect(safeReturnTo(undefined)).toBe("/dashboard");
    expect(safeReturnTo(null)).toBe("/dashboard");
    expect(safeReturnTo("")).toBe("/dashboard");
  });

  it("honours a custom fallback", () => {
    expect(safeReturnTo(null, "/onboarding")).toBe("/onboarding");
  });

  it("rejects absolute URLs to another host", () => {
    expect(safeReturnTo("https://evil.example/login")).toBe("/dashboard");
    expect(safeReturnTo("http://evil.example")).toBe("/dashboard");
  });

  it("rejects protocol-relative URLs, which look like paths but aren't", () => {
    expect(safeReturnTo("//evil.example/phish")).toBe("/dashboard");
  });

  it("rejects backslash variants some browsers normalise into //", () => {
    expect(safeReturnTo("/\\evil.example")).toBe("/dashboard");
    expect(safeReturnTo("\\\\evil.example")).toBe("/dashboard");
  });

  it("rejects anything that isn't rooted at /", () => {
    expect(safeReturnTo("dashboard")).toBe("/dashboard");
    expect(safeReturnTo("javascript:alert(1)")).toBe("/dashboard");
    expect(safeReturnTo("data:text/html,<script>alert(1)</script>")).toBe("/dashboard");
  });

  it("rejects control characters smuggled into an otherwise valid path", () => {
    expect(safeReturnTo("/ok\npath")).toBe("/dashboard");
    expect(safeReturnTo("/ok\tpath")).toBe("/dashboard");
  });
});
