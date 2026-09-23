import { afterEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows calls up to the limit within the window", () => {
    const key = `test-${crypto.randomUUID()}`;
    expect(checkRateLimit(key, 3, 1000).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 1000).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 1000).allowed).toBe(true);
  });

  it("rejects the call once the limit is reached within the window", () => {
    const key = `test-${crypto.randomUUID()}`;
    checkRateLimit(key, 2, 1000);
    checkRateLimit(key, 2, 1000);
    expect(checkRateLimit(key, 2, 1000).allowed).toBe(false);
  });

  it("keeps unrelated keys independent", () => {
    // One visitor exhausting their bucket must never affect another
    // visitor's bucket -- the entire point of keying by IP instead of a
    // single global counter.
    const keyA = `test-${crypto.randomUUID()}`;
    const keyB = `test-${crypto.randomUUID()}`;
    checkRateLimit(keyA, 1, 1000);
    expect(checkRateLimit(keyA, 1, 1000).allowed).toBe(false);
    expect(checkRateLimit(keyB, 1, 1000).allowed).toBe(true);
  });

  it("allows calls again once the window has fully elapsed", async () => {
    const key = `test-${crypto.randomUUID()}`;
    expect(checkRateLimit(key, 1, 20).allowed).toBe(true);
    expect(checkRateLimit(key, 1, 20).allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(checkRateLimit(key, 1, 20).allowed).toBe(true);
  });
});

describe("getVisitorIp", () => {
  afterEach(() => {
    vi.doUnmock("next/headers");
    vi.resetModules();
  });

  it("trusts the last hop of x-forwarded-for, since only Caddy can append to it", async () => {
    vi.resetModules();
    vi.doMock("next/headers", () => ({
      headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.5" }),
    }));
    const { getVisitorIp } = await import("./rate-limit");
    expect(await getVisitorIp()).toBe("10.0.0.5");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", async () => {
    vi.resetModules();
    vi.doMock("next/headers", () => ({
      headers: async () => new Headers({ "x-real-ip": "198.51.100.4" }),
    }));
    const { getVisitorIp } = await import("./rate-limit");
    expect(await getVisitorIp()).toBe("198.51.100.4");
  });

  it("returns null when no IP header is present, instead of blocking an unidentifiable visitor", async () => {
    vi.resetModules();
    vi.doMock("next/headers", () => ({
      headers: async () => new Headers(),
    }));
    const { getVisitorIp } = await import("./rate-limit");
    expect(await getVisitorIp()).toBeNull();
  });
});
