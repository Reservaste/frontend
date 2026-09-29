import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
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

/**
 * ADR-0040: mints a short-lived (30 min), one-time nonce that can ride the
 * one channel that survives a WhatsApp -> Mail/system-browser context
 * switch -- `emailRedirectTo`/OAuth `next` -- so a *second* browser context
 * can replant the `activation_token` cookie that this first one couldn't
 * carry along. Reads the token straight from the argument the caller
 * already pulled off the cookie (never a client-supplied value) and hands
 * it to the `issue_activation_continuation` RPC, which is the only place
 * that ever sees the token again after this.
 *
 * Returns `null` on any failure -- invalid/revoked/expired token, or the
 * RPC's own `TOO_MANY_CONTINUATIONS` guard -- and deliberately does not
 * distinguish which: this is a resilience mechanism, not a requirement.
 * The caller falls back to the plain `returnTo` without `?c=`, and
 * `claim_customer_activation()` / the cookie-miss messaging already on
 * `/activar/continuar` cover the rest exactly as they do today.
 */
export async function issueActivationContinuation(token: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_activation_continuation", {
    p_token: token,
  });

  if (error || !data) {
    return null;
  }

  return data as string;
}
