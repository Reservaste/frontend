import { afterEach, describe, expect, it, vi } from "vitest";
import { siteUrl } from "./site-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("siteUrl", () => {
  it("returns the configured origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://161-35-63-60.sslip.io");
    expect(siteUrl()).toBe("https://161-35-63-60.sslip.io");
  });

  it("strips trailing slashes", () => {
    // Otherwise the callback URL becomes "https://host//auth/callback",
    // which some redirect allowlists compare literally and reject.
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com///");
    expect(siteUrl()).toBe("https://example.com");
  });

  it("falls back to localhost in development", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("refuses to fall back to localhost in production", () => {
    // The whole point: a silent localhost fallback in production is what
    // made the OAuth redirect land nowhere while looking like it worked.
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => siteUrl()).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });
});
