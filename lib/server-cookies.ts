import "server-only";

import { cookies } from "next/headers";
import { ACTIVATION_COOKIE_NAME } from "@/lib/activation-cookie";
import { TEAM_INVITATION_COOKIE_NAME } from "@/lib/team-invitation-cookie";

// Readers of httpOnly secret cookies, for SERVER COMPONENTS only.
//
// Rule: a helper that RETURNS a secret must never live in a "use server"
// module. Every export of such a module is registered as a server action,
// invocable by a plain POST with the `Next-Action` header -- so a same-origin
// XSS could call it and read a cookie that `httpOnly` is supposed to keep
// out of reach of JS. This module has no "use server" (nothing here is an
// action) and `server-only` makes importing it from a client component a
// build error.
//
// Server actions that need the token (the claim flows) read the cookie
// themselves and pass it straight to the RPC; they never return it.

/** Is there a live customer-activation token in flight (ADR-0026)? */
export async function readActivationToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ACTIVATION_COOKIE_NAME)?.value ?? null;
}

/** Is there a live team-invitation token in flight (ADR-0034)? */
export async function readTeamInvitationToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(TEAM_INVITATION_COOKIE_NAME)?.value ?? null;
}
