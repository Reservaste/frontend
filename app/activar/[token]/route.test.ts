import { describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { GET } from "./route";
import { ACTIVATION_TOKEN_TTL_SECONDS } from "@/lib/activation-cookie";

vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://reservaste.test");

const TOKEN = "1VBg_WyDF5cEbMB-AbGsjbXB085kf_J4Pw2DdwJxdbs";

function get(token = TOKEN) {
  return GET({} as NextRequest, { params: Promise.resolve({ token }) });
}

describe("GET /activar/[token]", () => {
  /**
   * The production bug this file exists for: the handler stashed the
   * token in a 15-minute cookie. The token is good for 72h (ADR-0026
   * resolution 8) and lives *nowhere else* -- the database keeps only its
   * hash -- so the 15 minutes, not the 72h, were the real lifetime of the
   * link. ADR-0026 is by definition the flow for someone who has no
   * account yet: they open the link, go create one, confirm it by email,
   * and come back. That takes longer than 15 minutes routinely, and when
   * it did, /activar/continuar found no cookie and told them the link had
   * "expired" -- on their first try, with the token still pending in the
   * database for another three days.
   */
  it("keeps the token at least as long as the database will honour it", async () => {
    const response = await get();
    const cookie = response.cookies.get("activation_token");

    expect(cookie?.value).toBe(TOKEN);
    expect(cookie?.maxAge).toBeGreaterThanOrEqual(ACTIVATION_TOKEN_TTL_SECONDS);
  });

  it("scopes the cookie to the activation flow and keeps it off client JS", async () => {
    const response = await get();
    const cookie = response.cookies.get("activation_token");

    expect(cookie?.httpOnly).toBe(true);
    // Lax, not Strict: the person arrives from WhatsApp and may come back
    // through an OAuth redirect -- both cross-site top-level navigations.
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.path).toBe("/activar");
  });

  it("redirects to the confirmation screen without the token in the URL", async () => {
    const response = await get();

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://reservaste.test/activar/continuar");
    expect(response.headers.get("location")).not.toContain(TOKEN);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  /**
   * WhatsApp fetches a shared link to build its preview card before the
   * human taps it. Anything this GET consumed would be consumed by that
   * crawler, and the person's first click would find the link already
   * used. Nothing here may reach the database -- the redemption happens
   * in a POST (the server action), on an explicit "Confirmar y activar".
   */
  it("does not touch the database", async () => {
    const supabase = await import("@/lib/supabase/server");
    const spy = vi.spyOn(supabase, "createClient");

    await get();

    expect(spy).not.toHaveBeenCalled();
  });
});
