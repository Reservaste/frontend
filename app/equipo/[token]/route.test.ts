import { describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { GET } from "./route";
import { TEAM_INVITATION_TOKEN_TTL_SECONDS } from "@/lib/team-invitation-cookie";

vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://reservaste.test");

const TOKEN = "1VBg_WyDF5cEbMB-AbGsjbXB085kf_J4Pw2DdwJxdbs";

function get(token = TOKEN) {
  return GET({} as NextRequest, { params: Promise.resolve({ token }) });
}

describe("GET /equipo/[token]", () => {
  /**
   * The customer flow's production bug (2026-09-23), not to be repeated:
   * a cookie shorter than the token made a valid link "expire" while the
   * person was still signing up. This cookie is the only copy of the token.
   */
  it("keeps the token at least as long as the database will honour it", async () => {
    const response = await get();
    const cookie = response.cookies.get("team_invitation_token");

    expect(cookie?.value).toBe(TOKEN);
    expect(cookie?.maxAge).toBeGreaterThanOrEqual(TEAM_INVITATION_TOKEN_TTL_SECONDS);
  });

  it("uses its own cookie, scoped to /equipo, never the activation one", async () => {
    const response = await get();
    const cookie = response.cookies.get("team_invitation_token");

    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.path).toBe("/equipo");
    expect(response.cookies.get("activation_token")).toBeUndefined();
  });

  it("redirects to the confirmation screen without the token in the URL", async () => {
    const response = await get();

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://reservaste.test/equipo/continuar");
    expect(response.headers.get("location")).not.toContain(TOKEN);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("does not touch the database (link previews would consume it)", async () => {
    const supabase = await import("@/lib/supabase/server");
    const spy = vi.spyOn(supabase, "createClient");

    await get();

    expect(spy).not.toHaveBeenCalled();
  });
});
