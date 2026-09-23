import { describe, expect, it } from "vitest";
import {
  ACTIVATION_COOKIE_NAME,
  ACTIVATION_COOKIE_PATH,
  ACTIVATION_TOKEN_TTL_SECONDS,
  activationCookieClearOptions,
  activationCookieOptions,
} from "./activation-cookie";

/**
 * This cookie carries the activation token in the clear -- the database
 * only keeps its SHA-256 -- so its flags are the whole protection around
 * it, and widening its lifetime to 72h (2026-09-23 hotfix) is only
 * acceptable while they hold. `app/activar/[token]/route.test.ts` pins
 * what the route handler actually sends; this pins the policy itself,
 * including the two things that test cannot observe: `Secure` in
 * production (NODE_ENV is "test" there) and the clear options.
 */
describe("activation cookie policy", () => {
  it("is unreachable from client JS and scoped to the activation flow", () => {
    const options = activationCookieOptions("production");

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe(ACTIVATION_COOKIE_PATH);
    expect(ACTIVATION_COOKIE_PATH).toBe("/activar");
  });

  it("only travels over TLS in production", () => {
    // Sin `Secure` el token viajaría en claro ante cualquier downgrade a
    // http:// -- y quien lo lea puede activar la invitación como propia.
    expect(activationCookieOptions("production").secure).toBe(true);
    // Local dev is http://localhost, where a Secure cookie is simply
    // dropped and the flow cannot be exercised at all.
    expect(activationCookieOptions("development").secure).toBe(false);
  });

  it("never expires before the token can (72h, ADR-0026 resolution 8)", () => {
    expect(ACTIVATION_TOKEN_TTL_SECONDS).toBe(72 * 60 * 60);
    expect(activationCookieOptions("production").maxAge).toBeGreaterThanOrEqual(
      ACTIVATION_TOKEN_TTL_SECONDS,
    );
  });

  it("clears the cookie at its own path, not at /", () => {
    const clear = activationCookieClearOptions("production");

    // `cookies().delete(name)` targets path "/" -- a *different* cookie.
    // Con el path equivocado el token sobrevivía a su propio canje y se
    // quedaba 72h en el navegador (compartido, por ejemplo).
    expect(clear.path).toBe(ACTIVATION_COOKIE_PATH);
    expect(clear.maxAge).toBe(0);
    expect(clear.httpOnly).toBe(true);
    expect(clear.secure).toBe(true);
  });

  it("keeps the cookie name the server actions read", () => {
    expect(ACTIVATION_COOKIE_NAME).toBe("activation_token");
  });
});
